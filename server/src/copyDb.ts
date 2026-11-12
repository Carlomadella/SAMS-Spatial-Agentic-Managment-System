import type { SqlDriver, SqlRunner, SqlValue } from "./sql";

/**
 * Copia tutti i dati di SAMS da un database a un altro (tipicamente il file SQLite di
 * `SAMS_DATA_DIR` → MySQL). Entrambi devono essere già migrati allo schema corrente.
 * La destinazione deve essere **vuota**: niente fusioni, così non si mescolano due storie.
 * Tutto in una transazione sulla destinazione: o arriva tutto, o niente.
 */
export const COPY_TABLES = [
  "users",
  "auth_sessions",
  "password_resets",
  "email_verifications",
  "invites",
  "routines",
  "agent_memory",
  "task_log",
  "chat_messages",
  "world_snapshot",
  "world_agents",
  "settings",
] as const;

/**
 * Tabelle che la destinazione può avere già piene senza bloccare la copia: `settings`
 * si riempie da sola al primo avvio su MySQL (import dal file). Lì si tiene quello che
 * c'è e la copia la salta.
 */
const KEEP_IF_PRESENT: ReadonlySet<string> = new Set(["settings"]);

/** Ordine delle righe da preservare: il roster del mondo si legge in ordine d'inserimento. */
const ORDER_BY: Partial<Record<(typeof COPY_TABLES)[number], { sqlite: string; mysql: string }>> = {
  world_agents: { sqlite: "rowid", mysql: "seq" },
  task_log: { sqlite: "id", mysql: "id" },
};

const BATCH = 200;

async function columns(db: SqlRunner, table: string): Promise<string[]> {
  const rows =
    db.dialect === "mysql"
      ? await db.all<{ name: string }>(
          `SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION`,
          [table],
        )
      : await db.all<{ name: string }>(`PRAGMA table_info(${table})`);
  return rows.map((r) => String(r.name));
}

/** Righe per tabella nella destinazione, per rifiutare una copia sopra dati esistenti. */
export async function nonEmptyTables(db: SqlRunner): Promise<string[]> {
  const out: string[] = [];
  for (const t of COPY_TABLES) {
    if (KEEP_IF_PRESENT.has(t)) continue;
    const row = await db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${t}`);
    if (Number(row?.n ?? 0) > 0) out.push(t);
  }
  return out;
}

export async function copyDatabase(src: SqlDriver, dst: SqlDriver): Promise<Record<string, number>> {
  const busy = await nonEmptyTables(dst);
  if (busy.length > 0) {
    throw new Error(`La destinazione non è vuota (${busy.join(", ")}): copia annullata, nessun dato toccato`);
  }
  const counts: Record<string, number> = {};
  await dst.transaction(async (tx) => {
    for (const table of COPY_TABLES) {
      if (KEEP_IF_PRESENT.has(table)) {
        const row = await tx.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`);
        if (Number(row?.n ?? 0) > 0) {
          counts[table] = 0;
          continue;
        }
      }
      // Solo le colonne che esistono da entrambe le parti (es. `seq` c'è solo in MySQL
      // e si rigenera da sola nell'ordine d'inserimento).
      const dstCols = new Set(await columns(tx, table));
      const cols = (await columns(src, table)).filter((c) => dstCols.has(c));
      const order = ORDER_BY[table];
      const rows = await src.all(
        `SELECT ${cols.map((c) => `\`${c}\``).join(", ")} FROM ${table}${order ? ` ORDER BY ${order[src.dialect]} ASC` : ""}`,
      );
      for (let i = 0; i < rows.length; i += BATCH) {
        const chunk = rows.slice(i, i + BATCH);
        const placeholders = chunk.map(() => `(${cols.map(() => "?").join(", ")})`).join(", ");
        const params: SqlValue[] = chunk.flatMap((r) => cols.map((c) => (r[c] ?? null) as SqlValue));
        await tx.run(`INSERT INTO ${table} (${cols.map((c) => `\`${c}\``).join(", ")}) VALUES ${placeholders}`, params);
      }
      counts[table] = rows.length;
    }
  });
  return counts;
}
