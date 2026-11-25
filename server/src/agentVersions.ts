// Versioni della configurazione degli agenti (idea 6 da Paperclip, scelta A del 25/11/2026).
//
// A ogni modifica di nome, colore, ruolo, modello, istruzioni, repo o squadra il server
// salva una versione (chi, quando, cosa). Il ripristino crea una versione nuova, non
// cancella le altre. Si tengono le ultime 50 per agente (scelta dell'utente).
// Le istruzioni si scrivono un tasto alla volta e ogni tasto arriva al server: le
// modifiche della stessa persona a pochi minuti l'una dall'altra finiscono nella stessa
// versione, altrimenti 50 versioni sparirebbero in una frase.

import type { SqlDriver, SqlRunner } from "./sql";

export const CONFIG_FIELDS = ["name", "color", "role", "model", "instructions", "repo", "squad"] as const;
export type ConfigField = (typeof CONFIG_FIELDS)[number];
export type AgentConfig = Record<ConfigField, string>;

export const FIELD_LABEL: Record<ConfigField, string> = {
  name: "Nome",
  color: "Colore",
  role: "Ruolo",
  model: "Modello",
  instructions: "Istruzioni",
  repo: "Repository",
  squad: "Squadra",
};

/** Versioni tenute per agente. */
export const MAX_VERSIONS = 50;
/** Modifiche della stessa persona entro questo tempo vanno nella stessa versione. */
export const COALESCE_MS = 2 * 60 * 1000;

export function configOf(a: Partial<Record<ConfigField, unknown>>): AgentConfig {
  const out = {} as AgentConfig;
  for (const f of CONFIG_FIELDS) out[f] = a[f] == null ? "" : String(a[f]);
  return out;
}

export function sameConfig(a: AgentConfig, b: AgentConfig): boolean {
  return CONFIG_FIELDS.every((f) => a[f] === b[f]);
}

export interface FieldChange {
  field: ConfigField;
  label: string;
  before: string;
  after: string;
}

/** Cosa cambia da `before` ad `after` (before null = agente appena creato). */
export function configDiff(before: AgentConfig | null, after: AgentConfig): FieldChange[] {
  return CONFIG_FIELDS.filter((f) => (before?.[f] ?? "") !== after[f]).map((f) => ({
    field: f,
    label: FIELD_LABEL[f],
    before: before?.[f] ?? "",
    after: after[f],
  }));
}

// --- database ----------------------------------------------------------------------

const SQLITE_DDL = `
  CREATE TABLE IF NOT EXISTS agent_versions (
    agent_id   TEXT    NOT NULL,
    n          INTEGER NOT NULL,
    config     TEXT    NOT NULL,
    created_by TEXT    NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    note       TEXT    NOT NULL DEFAULT '',
    PRIMARY KEY (agent_id, n)
  );
`;
const MYSQL_DDL = `
  CREATE TABLE IF NOT EXISTS agent_versions (
    agent_id   VARCHAR(191) NOT NULL,
    n          BIGINT       NOT NULL,
    config     TEXT         NOT NULL,
    created_by VARCHAR(255) NOT NULL DEFAULT '',
    created_at BIGINT       NOT NULL,
    note       VARCHAR(255) NOT NULL DEFAULT '',
    PRIMARY KEY (agent_id, n)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
`;

export async function ensureAgentVersionTables(db: SqlDriver): Promise<void> {
  await db.exec(db.dialect === "mysql" ? MYSQL_DDL : SQLITE_DDL);
}

export interface AgentVersion {
  n: number;
  config: AgentConfig;
  createdBy: string;
  createdAt: number;
  note: string;
}

interface VersionRow {
  n: number;
  config: string;
  who: string;
  at: number;
  note: string;
}

function toVersion(r: VersionRow): AgentVersion {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(String(r.config)) as Record<string, unknown>;
  } catch {
    /* riga rovinata: campi vuoti */
  }
  return { n: Number(r.n), config: configOf(parsed), createdBy: String(r.who ?? ""), createdAt: Number(r.at), note: String(r.note ?? "") };
}

const SELECT = `SELECT n, config, created_by AS who, created_at AS at, note FROM agent_versions`;

/** Versioni dell'agente, dalla più recente. */
export async function listVersions(db: SqlRunner, agentId: string): Promise<AgentVersion[]> {
  const rows = await db.all<VersionRow>(`${SELECT} WHERE agent_id = ? ORDER BY n DESC`, [agentId]);
  return rows.map(toVersion);
}

export async function getVersion(db: SqlRunner, agentId: string, n: number): Promise<AgentVersion | null> {
  const r = await db.get<VersionRow>(`${SELECT} WHERE agent_id = ? AND n = ?`, [agentId, n]);
  return r ? toVersion(r) : null;
}

/**
 * Registra la configurazione attuale dell'agente come versione. Niente di nuovo se è
 * uguale all'ultima; se l'ultima è della stessa persona da meno di COALESCE_MS (e non è
 * un ripristino) la si aggiorna invece di crearne un'altra. Tiene le ultime MAX_VERSIONS.
 */
export async function recordConfigVersion(
  db: SqlRunner,
  agentId: string,
  config: AgentConfig,
  by: string,
  now = Date.now(),
  note = "",
): Promise<void> {
  const last = (await db.get<VersionRow>(`${SELECT} WHERE agent_id = ? ORDER BY n DESC LIMIT 1`, [agentId])) ?? null;
  const prev = last ? toVersion(last) : null;
  if (prev && sameConfig(prev.config, config)) return;
  const json = JSON.stringify(config);
  const who = by.slice(0, 255);
  if (prev && !note && !prev.note && prev.createdBy === who && now - prev.createdAt < COALESCE_MS && prev.n > 1) {
    await db.run(`UPDATE agent_versions SET config = ?, created_at = ? WHERE agent_id = ? AND n = ?`, [json, now, agentId, prev.n]);
    return;
  }
  const n = (prev?.n ?? 0) + 1;
  await db.run(
    `INSERT INTO agent_versions (agent_id, n, config, created_by, created_at, note) VALUES (?, ?, ?, ?, ?, ?)`,
    [agentId, n, json, who, now, note.slice(0, 255)],
  );
  if (n > MAX_VERSIONS) await db.run(`DELETE FROM agent_versions WHERE agent_id = ? AND n <= ?`, [agentId, n - MAX_VERSIONS]);
}

/** Agente cancellato: via anche le sue versioni (istruzioni comprese). */
export async function deleteVersions(db: SqlRunner, agentId: string): Promise<void> {
  await db.run(`DELETE FROM agent_versions WHERE agent_id = ?`, [agentId]);
}
