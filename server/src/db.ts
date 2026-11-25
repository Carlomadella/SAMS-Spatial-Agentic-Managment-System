import type { Routine, RoutineInput } from "./routines";
import { emptyWorld, type WorldAgentSnapshot, type WorldSnapshot } from "./worldState";
import { MAX_CHAT_MESSAGES, type ChatMessage } from "./chat";
import type { User } from "./auth";
import { hashToken, type TokenRecord } from "./tokens";
import type { InvitableRole, InviteRecord, PendingInvite } from "./invites";
import type { Role } from "./roles";
import type { GardenState } from "./garden/model";
import { dataFile } from "./dataDir";
import { readFileSync } from "node:fs";
import { openMysql, openSqlite, type Dialect, type SqlDriver, type SqlRunner } from "./sql";
import { ensurePermissionTables } from "./permissions";

/**
 * Storage durevole del runtime. Le funzioni di dominio sono scritte **una volta** sopra
 * il driver asincrono di `sql.ts` e girano su:
 * - **SQLite** (`node:sqlite`, file in `SAMS_DATA_DIR`): default, sviluppo e test;
 * - **MySQL** quando c'è `SAMS_DB_URL`: produzione, dati fuori dal disco del server.
 * Le differenze di dialetto (DDL, upsert, ordine d'inserimento) stanno qui, guardando
 * `db.dialect`. Ogni helper prende il runner come primo argomento, così si testa
 * contro un database in memoria e si riusa dentro una transazione.
 */

export interface TaskLogEntry {
  agentId: string;
  agentName: string;
  title: string;
  branch: string;
  status: string;
  tokens: number;
  ts: number;
  /** riassunto finale dell'agente (per il Reparto revisioni); "" per i task vecchi */
  summary?: string;
}

export interface TaskStats {
  total: number;
  completed: number;
  tokens: number;
}

// --- schema ------------------------------------------------------------------

const SQLITE_SCHEMA = `
    CREATE TABLE IF NOT EXISTS task_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id   TEXT    NOT NULL,
      agent_name TEXT    NOT NULL,
      title      TEXT    NOT NULL,
      branch     TEXT    NOT NULL,
      status     TEXT    NOT NULL,
      tokens     INTEGER NOT NULL DEFAULT 0,
      ts         INTEGER NOT NULL,
      summary    TEXT    NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_task_log_ts ON task_log (ts DESC);

    CREATE TABLE IF NOT EXISTS agent_memory (
      agent_id   TEXT    NOT NULL,
      key        TEXT    NOT NULL,
      value      TEXT    NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (agent_id, key)
    );

    CREATE TABLE IF NOT EXISTS routines (
      id           TEXT    PRIMARY KEY,
      name         TEXT    NOT NULL,
      title        TEXT    NOT NULL,
      branch       TEXT    NOT NULL DEFAULT '',
      kind         TEXT    NOT NULL,
      interval_min INTEGER NOT NULL DEFAULT 60,
      at_hour      INTEGER NOT NULL DEFAULT 9,
      at_min       INTEGER NOT NULL DEFAULT 0,
      enabled      INTEGER NOT NULL DEFAULT 1,
      last_run     INTEGER NOT NULL DEFAULT 0,
      created_at   INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS world_snapshot (
      id         INTEGER PRIMARY KEY CHECK (id = 1),
      agents     TEXT    NOT NULL,
      version    INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0
    );

    -- Roster autorevole per-riga (Roadmap 4, frontiera #1 — opzione 1). Sostituisce
    -- il blob singolo di world_snapshot come sorgente degli agenti: una riga per
    -- agente, con rev (versione per-agente monotona) e deleted_at (tombstone) così
    -- la cancellazione è propagabile senza distruggere creazioni concorrenti. La
    -- riga world_snapshot resta come contatore di versione globale (CAS).
    CREATE TABLE IF NOT EXISTS world_agents (
      id           TEXT    PRIMARY KEY,
      name         TEXT    NOT NULL DEFAULT '',
      color        TEXT    NOT NULL DEFAULT '',
      role         TEXT    NOT NULL DEFAULT '',
      status       TEXT    NOT NULL DEFAULT 'idle',
      task         TEXT,
      progress     INTEGER NOT NULL DEFAULT 0,
      model        TEXT    NOT NULL DEFAULT '',
      instructions TEXT    NOT NULL DEFAULT '',
      repo         TEXT    NOT NULL DEFAULT '',
      xp           INTEGER NOT NULL DEFAULT 0,
      assigned_by  TEXT    NOT NULL DEFAULT '',
      squad        TEXT    NOT NULL DEFAULT '',
      rev          INTEGER NOT NULL DEFAULT 1,
      updated_at   INTEGER NOT NULL DEFAULT 0,
      deleted_at   INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_world_agents_deleted ON world_agents (deleted_at);

    CREATE TABLE IF NOT EXISTS chat_messages (
      id     TEXT    PRIMARY KEY,
      author TEXT    NOT NULL,
      text   TEXT    NOT NULL,
      ts     INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_chat_ts ON chat_messages (ts DESC);

    CREATE TABLE IF NOT EXISTS users (
      id             TEXT    PRIMARY KEY,
      email          TEXT    NOT NULL UNIQUE,
      name           TEXT    NOT NULL,
      pass_hash      TEXT    NOT NULL,
      role           TEXT    NOT NULL,
      created_at     INTEGER NOT NULL,
      email_verified INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS auth_sessions (
      token      TEXT    PRIMARY KEY,
      user_id    TEXT    NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions (user_id);

    -- Token monouso per reset password e verifica email (gestione password,
    -- doc di decisione 2026-07-15). La chiave è l'**hash** del token: il valore in
    -- chiaro vive solo nel link consegnato alla persona (vedi tokens.ts).
    CREATE TABLE IF NOT EXISTS password_resets (
      token_hash TEXT    PRIMARY KEY,
      user_id    TEXT    NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      used_at    INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets (user_id);

    CREATE TABLE IF NOT EXISTS email_verifications (
      token_hash TEXT    PRIMARY KEY,
      user_id    TEXT    NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      used_at    INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_email_verifications_user ON email_verifications (user_id);

    -- Inviti (D3-B): l'owner invita un'email con un ruolo. Come gli altri token, a
    -- riposo c'è solo l'hash; l'id separato serve alla UI per revocare senza esporlo.
    CREATE TABLE IF NOT EXISTS invites (
      id         TEXT    PRIMARY KEY,
      token_hash TEXT    NOT NULL UNIQUE,
      email      TEXT    NOT NULL,
      role       TEXT    NOT NULL,
      invited_by TEXT    NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      used_at    INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_invites_email ON invites (email);

    -- Impostazioni scelte da ⚙ che non sono segreti (provider, modello, repo…), una riga
    -- per campo, valore in JSON. Le chiavi e i token non ci finiscono mai (opzione C).
    -- Task in corso (simulazione 23/11): se il server si riavvia a metà, all'avvio questi
    -- diventano "interrotto" nello storico invece di sparire senza traccia.
    CREATE TABLE IF NOT EXISTS task_runs (
      agent_id   TEXT    PRIMARY KEY,
      agent_name TEXT    NOT NULL,
      title      TEXT    NOT NULL,
      branch     TEXT    NOT NULL,
      started_at INTEGER NOT NULL,
      server     TEXT    NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS settings (
      name       TEXT    PRIMARY KEY,
      value      TEXT    NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- Account GitHub collegato da ogni utente ("Accedi con GitHub"). Il token è cifrato
    -- con SAMS_SECRET_KEY (vedi githubAccounts.ts): nel DB non c'è mai in chiaro.
    CREATE TABLE IF NOT EXISTS github_links (
      user_id     TEXT    PRIMARY KEY,
      login       TEXT    NOT NULL,
      token_enc   TEXT    NOT NULL,
      repo        TEXT    NOT NULL DEFAULT '',
      base_branch TEXT    NOT NULL DEFAULT '',
      updated_at  INTEGER NOT NULL
    );

    -- Commit Garden: un giardino per login GitHub (minuscolo). Lo stato intero è JSON in
    -- \`data\`; \`waterings\` è a parte solo per ordinare la classifica.
    CREATE TABLE IF NOT EXISTS gardens (
      login      TEXT    PRIMARY KEY,
      waterings  INTEGER NOT NULL DEFAULT 0,
      data       TEXT    NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_gardens_waterings ON gardens (waterings);
`;

/**
 * Stesso schema in MySQL. Differenze rispetto a SQLite:
 * - chiavi e colonne indicizzate sono `VARCHAR(191)` (MySQL non indicizza un TEXT intero);
 * - i tempi in ms sono `BIGINT`; i testi lunghi `TEXT` (senza DEFAULT, che MySQL < 8.0.13
 *   non accetta: gli INSERT li valorizzano sempre);
 * - indici dentro la CREATE TABLE (MySQL non ha `CREATE INDEX IF NOT EXISTS`);
 * - `world_agents.seq` prende il posto del `rowid` di SQLite per l'ordine d'inserimento;
 * - collation **binaria**: confronti sensibili a maiuscole e accenti, come in SQLite.
 */
const MYSQL_TABLE_OPTS = "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin";
/**
 * Su TiDB (es. TiDB Cloud) gli AUTO_INCREMENT sono crescenti solo per singolo nodo:
 * AUTO_ID_CACHE=1 li rende crescenti su tutti i nodi, così `seq` resta l'ordine
 * d'inserimento. Il commento `/*T! … *\/` lo esegue solo TiDB; MySQL lo ignora.
 */
const TIDB_ORDERED_AUTO_ID = "/*T![auto_id_cache] AUTO_ID_CACHE=1 */";
const MYSQL_SCHEMA = `
    CREATE TABLE IF NOT EXISTS task_log (
      id         BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
      agent_id   VARCHAR(191) NOT NULL,
      agent_name VARCHAR(255) NOT NULL,
      title      TEXT         NOT NULL,
      branch     VARCHAR(255) NOT NULL,
      status     VARCHAR(32)  NOT NULL,
      tokens     BIGINT       NOT NULL DEFAULT 0,
      ts         BIGINT       NOT NULL,
      summary    TEXT         NULL,
      INDEX idx_task_log_ts (ts)
    ) ${MYSQL_TABLE_OPTS};

    CREATE TABLE IF NOT EXISTS agent_memory (
      agent_id   VARCHAR(191) NOT NULL,
      \`key\`      VARCHAR(100) NOT NULL,
      value      TEXT         NOT NULL,
      updated_at BIGINT       NOT NULL,
      PRIMARY KEY (agent_id, \`key\`)
    ) ${MYSQL_TABLE_OPTS};

    CREATE TABLE IF NOT EXISTS routines (
      id           VARCHAR(64)  NOT NULL PRIMARY KEY,
      name         VARCHAR(255) NOT NULL,
      title        VARCHAR(255) NOT NULL,
      branch       VARCHAR(255) NOT NULL DEFAULT '',
      kind         VARCHAR(16)  NOT NULL,
      interval_min INT          NOT NULL DEFAULT 60,
      at_hour      INT          NOT NULL DEFAULT 9,
      at_min       INT          NOT NULL DEFAULT 0,
      enabled      TINYINT      NOT NULL DEFAULT 1,
      last_run     BIGINT       NOT NULL DEFAULT 0,
      created_at   BIGINT       NOT NULL
    ) ${MYSQL_TABLE_OPTS};

    CREATE TABLE IF NOT EXISTS world_snapshot (
      id         INT        NOT NULL PRIMARY KEY CHECK (id = 1),
      agents     MEDIUMTEXT NOT NULL,
      version    BIGINT     NOT NULL DEFAULT 0,
      updated_at BIGINT     NOT NULL DEFAULT 0
    ) ${MYSQL_TABLE_OPTS};

    CREATE TABLE IF NOT EXISTS world_agents (
      id           VARCHAR(64)  NOT NULL PRIMARY KEY,
      seq          BIGINT       NOT NULL AUTO_INCREMENT,
      name         VARCHAR(255) NOT NULL DEFAULT '',
      color        VARCHAR(64)  NOT NULL DEFAULT '',
      role         VARCHAR(255) NOT NULL DEFAULT '',
      status       VARCHAR(32)  NOT NULL DEFAULT 'idle',
      task         TEXT,
      progress     INT          NOT NULL DEFAULT 0,
      model        VARCHAR(255) NOT NULL DEFAULT '',
      instructions TEXT         NOT NULL,
      repo         VARCHAR(255) NOT NULL DEFAULT '',
      xp           BIGINT       NOT NULL DEFAULT 0,
      assigned_by  VARCHAR(255) NOT NULL DEFAULT '',
      squad        VARCHAR(64)  NOT NULL DEFAULT '',
      rev          BIGINT       NOT NULL DEFAULT 1,
      updated_at   BIGINT       NOT NULL DEFAULT 0,
      deleted_at   BIGINT       NULL,
      UNIQUE KEY uq_world_agents_seq (seq),
      INDEX idx_world_agents_deleted (deleted_at)
    ) ${MYSQL_TABLE_OPTS} ${TIDB_ORDERED_AUTO_ID};

    CREATE TABLE IF NOT EXISTS chat_messages (
      id     VARCHAR(64)  NOT NULL PRIMARY KEY,
      author VARCHAR(255) NOT NULL,
      text   TEXT         NOT NULL,
      ts     BIGINT       NOT NULL,
      INDEX idx_chat_ts (ts)
    ) ${MYSQL_TABLE_OPTS};

    CREATE TABLE IF NOT EXISTS users (
      id             VARCHAR(64)  NOT NULL PRIMARY KEY,
      email          VARCHAR(191) NOT NULL,
      name           VARCHAR(255) NOT NULL,
      pass_hash      VARCHAR(255) NOT NULL,
      role           VARCHAR(16)  NOT NULL,
      created_at     BIGINT       NOT NULL,
      email_verified TINYINT      NOT NULL DEFAULT 0,
      UNIQUE KEY uq_users_email (email)
    ) ${MYSQL_TABLE_OPTS};

    CREATE TABLE IF NOT EXISTS auth_sessions (
      token      VARCHAR(128) NOT NULL PRIMARY KEY,
      user_id    VARCHAR(64)  NOT NULL,
      created_at BIGINT       NOT NULL,
      expires_at BIGINT       NOT NULL,
      INDEX idx_auth_sessions_user (user_id)
    ) ${MYSQL_TABLE_OPTS};

    CREATE TABLE IF NOT EXISTS password_resets (
      token_hash VARCHAR(128) NOT NULL PRIMARY KEY,
      user_id    VARCHAR(64)  NOT NULL,
      created_at BIGINT       NOT NULL,
      expires_at BIGINT       NOT NULL,
      used_at    BIGINT       NULL,
      INDEX idx_password_resets_user (user_id)
    ) ${MYSQL_TABLE_OPTS};

    CREATE TABLE IF NOT EXISTS email_verifications (
      token_hash VARCHAR(128) NOT NULL PRIMARY KEY,
      user_id    VARCHAR(64)  NOT NULL,
      created_at BIGINT       NOT NULL,
      expires_at BIGINT       NOT NULL,
      used_at    BIGINT       NULL,
      INDEX idx_email_verifications_user (user_id)
    ) ${MYSQL_TABLE_OPTS};

    CREATE TABLE IF NOT EXISTS invites (
      id         VARCHAR(64)  NOT NULL PRIMARY KEY,
      token_hash VARCHAR(128) NOT NULL,
      email      VARCHAR(191) NOT NULL,
      role       VARCHAR(16)  NOT NULL,
      invited_by VARCHAR(255) NOT NULL,
      created_at BIGINT       NOT NULL,
      expires_at BIGINT       NOT NULL,
      used_at    BIGINT       NULL,
      UNIQUE KEY uq_invites_token (token_hash),
      INDEX idx_invites_email (email)
    ) ${MYSQL_TABLE_OPTS};

    CREATE TABLE IF NOT EXISTS task_runs (
      agent_id   VARCHAR(191) NOT NULL PRIMARY KEY,
      agent_name VARCHAR(255) NOT NULL,
      title      TEXT         NOT NULL,
      branch     VARCHAR(255) NOT NULL,
      started_at BIGINT       NOT NULL,
      server     VARCHAR(255) NOT NULL DEFAULT ''
    ) ${MYSQL_TABLE_OPTS};

    CREATE TABLE IF NOT EXISTS settings (
      name       VARCHAR(64)  NOT NULL PRIMARY KEY,
      value      TEXT         NOT NULL,
      updated_at BIGINT       NOT NULL
    ) ${MYSQL_TABLE_OPTS};

    CREATE TABLE IF NOT EXISTS github_links (
      user_id     VARCHAR(64)  NOT NULL PRIMARY KEY,
      login       VARCHAR(255) NOT NULL,
      token_enc   TEXT         NOT NULL,
      repo        VARCHAR(255) NOT NULL DEFAULT '',
      base_branch VARCHAR(255) NOT NULL DEFAULT '',
      updated_at  BIGINT       NOT NULL
    ) ${MYSQL_TABLE_OPTS};

    CREATE TABLE IF NOT EXISTS gardens (
      login      VARCHAR(100) NOT NULL PRIMARY KEY,
      waterings  INT          NOT NULL DEFAULT 0,
      data       TEXT         NOT NULL,
      updated_at BIGINT       NOT NULL,
      INDEX idx_gardens_waterings (waterings)
    ) ${MYSQL_TABLE_OPTS};
`;

/** Crea le tabelle mancanti e applica le migrazioni idempotenti. Ritorna lo stesso driver. */
export async function migrate(db: SqlDriver): Promise<SqlDriver> {
  await db.exec(db.dialect === "mysql" ? MYSQL_SCHEMA : SQLITE_SCHEMA);
  await ensureWorldAgentColumns(db);
  await ensureTaskLogColumns(db);
  await ensureTaskRunColumns(db);
  await ensurePermissionTables(db);
  await ensureUserColumns(db);
  await migrateWorldAgents(db);
  return db;
}

/** Open (and migrate) a SQLite database at `location`. Use ":memory:" in tests. */
export async function openDb(location: string): Promise<SqlDriver> {
  return migrate(openSqlite(location));
}

/** Nomi delle colonne di una tabella, nei due dialetti. */
async function columnNames(db: SqlRunner, table: string): Promise<Set<string>> {
  const rows =
    db.dialect === "mysql"
      ? await db.all<{ name: string }>(
          `SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
          [table],
        )
      : await db.all<{ name: string }>(`PRAGMA table_info(${table})`);
  return new Set(rows.map((c) => String(c.name)));
}

/**
 * Aggiunge `users.email_verified` in modo idempotente. **Retro-compatibilità**: su un DB
 * preesistente gli account vengono marcati **verificati** nella stessa transazione in cui
 * la colonna nasce. È deliberato — chi ieri entrava non deve trovarsi chiuso fuori oggi
 * perché abbiamo aggiunto la verifica; il gate vale da qui in avanti, per i nuovi account.
 * Su un DB nuovo la tabella è vuota → l'UPDATE non tocca nulla.
 */
async function ensureUserColumns(db: SqlDriver): Promise<void> {
  const cols = await columnNames(db, "users");
  if (!cols.has("email_verified")) {
    const type = db.dialect === "mysql" ? "TINYINT" : "INTEGER";
    await db.exec(`ALTER TABLE users ADD COLUMN email_verified ${type} NOT NULL DEFAULT 0`);
    await db.exec(`UPDATE users SET email_verified = 1`);
  }
}

/**
 * Aggiunge in modo idempotente le colonne config/xp (opzione B2) a un
 * `world_agents` preesistente creato prima della loro introduzione. Su un DB nuovo
 * la `CREATE TABLE` le ha già → no-op; su uno vecchio le aggiunge via ALTER.
 */
/** `task_log.summary` (Reparto revisioni, 21/11) su un DB creato prima: idempotente. */
async function ensureTaskLogColumns(db: SqlDriver): Promise<void> {
  const cols = await columnNames(db, "task_log");
  if (cols.has("summary")) return;
  // MySQL/TiDB non accettano DEFAULT su TEXT: la colonna resta nullable e si legge con COALESCE.
  if (db.dialect === "mysql") {
    await db.exec(`ALTER TABLE task_log ADD COLUMN summary TEXT NULL`);
  } else {
    await db.exec(`ALTER TABLE task_log ADD COLUMN summary TEXT NOT NULL DEFAULT ''`);
  }
}

/** `task_runs.server` (25/11): quale server fa girare il task. Idempotente. */
async function ensureTaskRunColumns(db: SqlDriver): Promise<void> {
  const cols = await columnNames(db, "task_runs");
  if (cols.has("server")) return;
  const type = db.dialect === "mysql" ? "VARCHAR(255)" : "TEXT";
  await db.exec(`ALTER TABLE task_runs ADD COLUMN server ${type} NOT NULL DEFAULT ''`);
}

async function ensureWorldAgentColumns(db: SqlDriver): Promise<void> {
  const cols = await columnNames(db, "world_agents");
  const my = db.dialect === "mysql";
  const add = async (name: string, sqliteDdl: string, mysqlDdl: string): Promise<void> => {
    if (!cols.has(name)) await db.exec(`ALTER TABLE world_agents ADD COLUMN ${my ? mysqlDdl : sqliteDdl}`);
  };
  await add("model", "model TEXT NOT NULL DEFAULT ''", "model VARCHAR(255) NOT NULL DEFAULT ''");
  await add("instructions", "instructions TEXT NOT NULL DEFAULT ''", "instructions TEXT NOT NULL");
  await add("repo", "repo TEXT NOT NULL DEFAULT ''", "repo VARCHAR(255) NOT NULL DEFAULT ''");
  await add("xp", "xp INTEGER NOT NULL DEFAULT 0", "xp BIGINT NOT NULL DEFAULT 0");
  await add("assigned_by", "assigned_by TEXT NOT NULL DEFAULT ''", "assigned_by VARCHAR(255) NOT NULL DEFAULT ''");
  await add("squad", "squad TEXT NOT NULL DEFAULT ''", "squad VARCHAR(64) NOT NULL DEFAULT ''");
}

/**
 * Migrazione una-tantum: semina `world_agents` dal vecchio blob `world_snapshot`,
 * così gli agenti durevoli sopravvivono al passaggio al versioning per-riga +
 * tombstone (Roadmap 4, frontiera #1 — opzione 1). Gira a ogni apertura ma è un
 * no-op se la tabella per-riga è già popolata.
 */
async function migrateWorldAgents(db: SqlDriver): Promise<void> {
  const n = Number((await db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM world_agents`))?.n ?? 0);
  if (n > 0) return;
  const row = await db.get<{ agents: string }>(`SELECT agents FROM world_snapshot WHERE id = 1`);
  if (!row) return;
  let agents: WorldAgentSnapshot[] = [];
  try {
    const parsed = JSON.parse(row.agents);
    if (Array.isArray(parsed)) agents = parsed as WorldAgentSnapshot[];
  } catch {
    return; // blob corrotto → niente da migrare
  }
  const now = Date.now();
  const ignore = db.dialect === "mysql" ? "INSERT IGNORE" : "INSERT OR IGNORE";
  for (const a of agents) {
    if (!a || typeof a.id !== "string" || !a.id) continue;
    await db.run(
      `${ignore} INTO world_agents (id, name, color, role, status, task, progress, model, instructions, repo, xp, rev, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, NULL)`,
      [
        a.id, a.name ?? "", a.color ?? "", a.role ?? "", a.status ?? "idle", a.task ?? null, Number(a.progress) || 0,
        a.model ?? "", a.instructions ?? "", a.repo ?? "", Number(a.xp) || 0, now,
      ],
    );
  }
}

/**
 * Clausola di upsert nei due dialetti: `ON CONFLICT … DO UPDATE` (SQLite) o
 * `ON DUPLICATE KEY UPDATE` (MySQL). `set` sono le colonne da sovrascrivere col valore
 * in arrivo; `extra` assegnazioni letterali aggiuntive (es. `deleted_at = NULL`).
 */
function onConflictUpdate(dialect: Dialect, keys: string[], set: string[], extra: string[] = []): string {
  if (dialect === "mysql") {
    return `ON DUPLICATE KEY UPDATE ${[...set.map((c) => `${c} = VALUES(${c})`), ...extra].join(", ")}`;
  }
  return `ON CONFLICT (${keys.join(", ")}) DO UPDATE SET ${[...set.map((c) => `${c} = excluded.${c}`), ...extra].join(", ")}`;
}

// --- task in corso ---------------------------------------------------------------

export interface TaskRunRow {
  agentId: string;
  agentName: string;
  title: string;
  branch: string;
  startedAt: number;
  /** Il server che lo fa girare (vedi serverName in interruptedRuns.ts); "" = riga vecchia. */
  server: string;
}

/** Un task è partito (uno per agente: un nuovo inizio sostituisce il precedente). */
export async function saveTaskRun(db: SqlRunner, r: TaskRunRow): Promise<void> {
  await db.run(
    `INSERT INTO task_runs (agent_id, agent_name, title, branch, started_at, server) VALUES (?, ?, ?, ?, ?, ?)
     ${onConflictUpdate(db.dialect, ["agent_id"], ["agent_name", "title", "branch", "started_at", "server"])}`,
    [r.agentId, r.agentName, r.title.slice(0, 4000), r.branch, r.startedAt, r.server.slice(0, 255)],
  );
}

/** Il task dell'agente è finito (bene, male o annullato). */
export async function deleteTaskRun(db: SqlRunner, agentId: string): Promise<void> {
  await db.run(`DELETE FROM task_runs WHERE agent_id = ?`, [agentId]);
}

export async function listTaskRuns(db: SqlRunner): Promise<TaskRunRow[]> {
  const rows = await db.all<TaskRunRow>(
    `SELECT agent_id AS agentId, agent_name AS agentName, title, branch, started_at AS startedAt, server FROM task_runs`,
  );
  return rows.map((r) => ({ ...r, agentId: String(r.agentId), startedAt: Number(r.startedAt), server: String(r.server ?? "") }));
}

// --- impostazioni non segrete -------------------------------------------------

/** Le righe di `settings` come nome → valore (testo JSON, lo decodifica config.ts). */
export async function loadSettingRows(db: SqlRunner): Promise<Record<string, string>> {
  const rows = await db.all<{ name: string; value: string }>(`SELECT name, value FROM settings`);
  const out: Record<string, string> = {};
  for (const r of rows) out[String(r.name)] = String(r.value);
  return out;
}

/** Scrive (upsert) i campi in `set` e toglie quelli in `remove`, tutto in una transazione. */
export async function saveSettingRows(
  db: SqlDriver,
  set: Record<string, string>,
  remove: ReadonlyArray<string> = [],
  now = Date.now(),
): Promise<void> {
  await db.transaction(async (tx) => {
    for (const [name, value] of Object.entries(set)) {
      await tx.run(
        `INSERT INTO settings (name, value, updated_at) VALUES (?, ?, ?)
         ${onConflictUpdate(tx.dialect, ["name"], ["value", "updated_at"])}`,
        [name, value, now],
      );
    }
    for (const name of remove) await tx.run(`DELETE FROM settings WHERE name = ?`, [name]);
  });
}

// --- Commit Garden -------------------------------------------------------------

/** Il giardino di un login GitHub (senza badare alle maiuscole), o null. */
export async function getGarden(db: SqlRunner, login: string): Promise<GardenState | null> {
  const r = await db.get<{ data: string }>(`SELECT data FROM gardens WHERE login = ?`, [login.toLowerCase()]);
  return r ? (JSON.parse(String(r.data)) as GardenState) : null;
}

/** Salva (upsert) lo stato di un giardino. */
export async function putGarden(db: SqlRunner, g: GardenState, now = Date.now()): Promise<void> {
  await db.run(
    `INSERT INTO gardens (login, waterings, data, updated_at) VALUES (?, ?, ?, ?)
     ${onConflictUpdate(db.dialect, ["login"], ["waterings", "data", "updated_at"])}`,
    [g.user.toLowerCase(), g.waterings, JSON.stringify(g), now],
  );
}

/** I giardini più annaffiati, per la classifica. */
export async function topGardens(db: SqlRunner, limit: number): Promise<GardenState[]> {
  const rows = await db.all<{ data: string }>(
    `SELECT data FROM gardens ORDER BY waterings DESC, login ASC LIMIT ?`,
    [Math.max(1, Math.min(100, Math.floor(limit)))],
  );
  return rows.map((r) => JSON.parse(String(r.data)) as GardenState);
}

// --- chat di workspace helpers (mondo condiviso) ---------------------------

/** The most recent chat messages, oldest-first (ready to render top-to-bottom). */
export async function listChatMessages(db: SqlRunner, limit = MAX_CHAT_MESSAGES): Promise<ChatMessage[]> {
  const rows = await db.all(`SELECT id, author, text, ts FROM chat_messages ORDER BY ts DESC, id DESC LIMIT ?`, [
    Math.max(1, Math.min(MAX_CHAT_MESSAGES, limit)),
  ]);
  return rows
    .map((r) => ({ id: String(r.id), author: String(r.author), text: String(r.text), ts: Number(r.ts) }))
    .reverse();
}

/** Persist one chat message, then prune anything past the newest MAX_CHAT_MESSAGES. */
export async function insertChatMessage(db: SqlRunner, msg: ChatMessage): Promise<void> {
  // REPLACE INTO esiste identico in SQLite e MySQL.
  await db.run(`REPLACE INTO chat_messages (id, author, text, ts) VALUES (?, ?, ?, ?)`, [
    msg.id,
    msg.author,
    msg.text,
    msg.ts,
  ]);
  // Il messaggio più vecchio da tenere; tutto ciò che viene prima (stesso ordine ts, id)
  // si cancella. Niente `NOT IN (SELECT … LIMIT)`: MySQL non lo supporta.
  const cut = await db.get<{ ts: number; id: string }>(
    `SELECT ts, id FROM chat_messages ORDER BY ts DESC, id DESC LIMIT 1 OFFSET ?`,
    [MAX_CHAT_MESSAGES - 1],
  );
  if (cut) {
    await db.run(`DELETE FROM chat_messages WHERE ts < ? OR (ts = ? AND id < ?)`, [
      Number(cut.ts),
      Number(cut.ts),
      String(cut.id),
    ]);
  }
}

// --- world helpers (stato autorevole: roster per-riga + tombstone) ----------
//
// Il roster autorevole vive nella tabella `world_agents` (una riga per agente,
// con rev per-agente e tombstone). La riga `world_snapshot` (id=1) resta solo
// come **contatore di versione globale** per il CAS. Il merge server-side è ciò
// che rende sicura la cancellazione (Roadmap 4, frontiera #1 — opzione 1).

/** Età oltre la quale `pruneWorldTombstones` può potare un tombstone (non lo chiama più nessuno in automatico, 25/11). */
export const TOMBSTONE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 giorni

interface WorldAgentRow {
  id: string;
  name: string;
  color: string;
  role: string;
  status: string;
  task: string | null;
  progress: number;
  model: string;
  instructions: string;
  repo: string;
  xp: number;
  assigned_by: string;
  squad: string;
  rev: number;
  deleted_at: number | null;
}

/** Colonne del roster lette in giro (senza rev/updated_at/deleted_at ove non servono). */
const AGENT_COLS = "id, name, color, role, status, task, progress, model, instructions, repo, xp, assigned_by, squad";

/** Ordine d'inserimento: il `rowid` implicito di SQLite, la colonna `seq` in MySQL. */
const insertOrder = (d: Dialect): string => (d === "mysql" ? "seq" : "rowid");

/** Versione globale + updatedAt (contatore CAS); zeri se mai scritto. */
async function loadWorldVersion(db: SqlRunner): Promise<{ version: number; updatedAt: number }> {
  const row = await db.get<{ version: number; updated_at: number }>(
    `SELECT version, updated_at FROM world_snapshot WHERE id = 1`,
  );
  return row ? { version: Number(row.version), updatedAt: Number(row.updated_at) } : { version: 0, updatedAt: 0 };
}

/** Incrementa la versione globale monotona e timbra updatedAt. */
async function bumpWorldVersion(db: SqlRunner): Promise<{ version: number; updatedAt: number }> {
  const version = (await loadWorldVersion(db)).version + 1;
  const updatedAt = Date.now();
  await db.run(
    `INSERT INTO world_snapshot (id, agents, version, updated_at) VALUES (1, '[]', ?, ?)
     ${onConflictUpdate(db.dialect, ["id"], ["version", "updated_at"])}`,
    [version, updatedAt],
  );
  return { version, updatedAt };
}

const rowToAgent = (r: WorldAgentRow): WorldAgentSnapshot => ({
  id: String(r.id),
  name: String(r.name),
  color: String(r.color),
  role: String(r.role),
  status: String(r.status),
  task: r.task == null ? null : String(r.task),
  progress: Number(r.progress),
  model: String(r.model ?? ""),
  instructions: String(r.instructions ?? ""),
  repo: String(r.repo ?? ""),
  xp: Number(r.xp ?? 0),
  assignedBy: String(r.assigned_by ?? ""),
  squad: String(r.squad ?? ""),
  ...(r.deleted_at != null ? { deleted: true } : {}),
});

/**
 * Tutti gli agenti del roster autorevole, **tombstone inclusi** (col flag
 * `deleted`), in ordine d'inserimento. I client ne hanno bisogno per rimuovere
 * gli agenti cancellati; potati via `pruneWorldTombstones`.
 */
export async function loadWorldAgents(db: SqlRunner): Promise<WorldAgentSnapshot[]> {
  const rows = await db.all<WorldAgentRow>(
    `SELECT ${AGENT_COLS}, rev, deleted_at FROM world_agents ORDER BY ${insertOrder(db.dialect)} ASC`,
  );
  return rows.map(rowToAgent);
}

/** The durable authoritative world snapshot, or an empty one if never saved. */
export async function loadWorldSnapshot(db: SqlRunner): Promise<WorldSnapshot> {
  const { version, updatedAt } = await loadWorldVersion(db);
  if (version === 0) return emptyWorld();
  return { agents: await loadWorldAgents(db), version, updatedAt };
}

const agentUnchanged = (prev: WorldAgentRow, a: WorldAgentSnapshot): boolean =>
  prev.deleted_at == null &&
  String(prev.name) === a.name &&
  String(prev.color) === a.color &&
  String(prev.role) === a.role &&
  String(prev.status) === a.status &&
  (prev.task == null ? null : String(prev.task)) === a.task &&
  Number(prev.progress) === a.progress &&
  String(prev.model ?? "") === (a.model ?? "") &&
  String(prev.instructions ?? "") === (a.instructions ?? "") &&
  String(prev.repo ?? "") === (a.repo ?? "") &&
  Number(prev.xp ?? 0) === (a.xp ?? 0) &&
  String(prev.assigned_by ?? "") === (a.assignedBy ?? "") &&
  String(prev.squad ?? "") === (a.squad ?? "");

/** Esito di una fusione: lo snapshot autorevole + se ha davvero cambiato qualcosa. */
export interface WorldMergeResult extends WorldSnapshot {
  /** true se la fusione ha modificato il roster (create/update/tombstone); false = no-op. */
  changed: boolean;
}

/**
 * Fonde il roster completo in arrivo riga per riga; bumpa la versione globale
 * **solo se qualcosa è cambiato**.
 *
 * - upsert di ogni agente in arrivo (rev++ se cambiato); un id già cancellato si
 *   **ignora**: la cancellazione è definitiva (25/11);
 * - **tombstone-by-absence**: ogni riga *viva* assente dal roster in arrivo viene
 *   marcata cancellata. È sicuro **solo** perché il gestore ammette questa scrittura
 *   unicamente se CAS-fresca (`baseVersion === current`): il client aveva adottato
 *   l'ultimo roster, quindi un'assenza è una cancellazione voluta, non una vista
 *   stantìa. Una creazione concorrente non-ancora-pushata avrebbe fatto 409.
 * - **no-op**: se nulla cambia (la vista che ha appena adottato rispinge un roster
 *   identico a quello salvato) non si bumpa la versione né si forza un broadcast —
 *   si evita il ping-pong (bump + echo) e i 409 a vuoto tra viste convergenti.
 *
 * - una voce in arrivo marcata `deleted` (uno snapshot riletto e risalvato) **non**
 *   resuscita l'agente: conta come assente.
 * - `allowDelete: false` (push di chi non è owner, 24/11): niente tombstone per assenza,
 *   gli agenti mancanti restano vivi. Cancellare è solo dell'owner.
 *
 * Ritorna lo snapshot autorevole (agenti vivi **+ tombstone**) e il flag `changed`.
 */
export async function saveWorldAgents(
  db: SqlDriver,
  all: WorldAgentSnapshot[],
  { allowDelete = true }: { allowDelete?: boolean } = {},
): Promise<WorldMergeResult> {
  const now = Date.now();
  const incoming = all.filter((a) => !a.deleted);
  const incomingIds = new Set(incoming.map((a) => a.id));
  const upsertSql = `INSERT INTO world_agents (id, name, color, role, status, task, progress, model, instructions, repo, xp, assigned_by, squad, rev, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
     ${onConflictUpdate(
       db.dialect,
       ["id"],
       ["name", "color", "role", "status", "task", "progress", "model", "instructions", "repo", "xp", "assigned_by", "squad", "rev", "updated_at"],
       ["deleted_at = NULL"],
     )}`;

  // Tutto in una transazione: upsert, tombstone e bump di versione o tutti o nessuno.
  // Senza, un errore a metà lascerebbe righe nuove sotto la versione vecchia — e il CAS
  // ottimistico di POST /api/world si fida proprio della versione.
  return db.transaction(async (tx) => {
    const existing = new Map<string, WorldAgentRow>(
      (await tx.all<WorldAgentRow>(`SELECT ${AGENT_COLS}, rev, deleted_at FROM world_agents`)).map((r) => [
        String(r.id),
        r,
      ]),
    );
    let changed = false;
    for (const a of incoming) {
      const prev = existing.get(a.id);
      // Cancellare è definitivo (25/11): una pagina che ha ancora l'agente in memoria non lo
      // fa tornare. Gli agenti nuovi hanno sempre un id nuovo.
      if (prev && prev.deleted_at != null) continue;
      if (prev && agentUnchanged(prev, a)) continue; // nessun cambiamento → niente scrittura né rev
      const rev = prev ? Number(prev.rev) + 1 : 1;
      await tx.run(upsertSql, [
        a.id, a.name, a.color, a.role, a.status, a.task, a.progress, a.model ?? "", a.instructions ?? "", a.repo ?? "",
        a.xp ?? 0, a.assignedBy ?? "", a.squad ?? "", rev, now,
      ]);
      changed = true;
    }
    for (const [id, r] of existing) {
      if (allowDelete && !incomingIds.has(id) && r.deleted_at == null) {
        await tx.run(
          `UPDATE world_agents SET rev = rev + 1, updated_at = ?, deleted_at = ? WHERE id = ? AND deleted_at IS NULL`,
          [now, now, id],
        );
        changed = true;
      }
    }

    // I tombstone NON si potano più qui (25/11): senza la riga, una pagina nuova che parte
    // coi sei agenti di default li ricreava dopo 7 giorni. Una riga per agente cancellato
    // pesa pochissimo.

    const { version, updatedAt } = changed ? await bumpWorldVersion(tx) : await loadWorldVersion(tx);
    return { agents: await loadWorldAgents(tx), version, updatedAt, changed };
  });
}

/**
 * Cancella **subito** un agente dal roster (tombstone) e bumpa la versione, senza
 * aspettare il prossimo push dell'intero mondo: chi cancella e ricarica la pagina non
 * deve rivederlo. Idempotente: un agente già cancellato o sconosciuto → `changed: false`.
 */
export async function tombstoneWorldAgent(db: SqlDriver, id: string): Promise<WorldMergeResult> {
  const now = Date.now();
  return db.transaction(async (tx) => {
    const res = await tx.run(
      `UPDATE world_agents SET rev = rev + 1, updated_at = ?, deleted_at = ? WHERE id = ? AND deleted_at IS NULL`,
      [now, now, id],
    );
    const changed = res.changes > 0;
    const { version, updatedAt } = changed ? await bumpWorldVersion(tx) : await loadWorldVersion(tx);
    return { agents: await loadWorldAgents(tx), version, updatedAt, changed };
  });
}

/** Pota i tombstone più vecchi di `ttlMs`. Ritorna quante righe ha rimosso. */
export async function pruneWorldTombstones(db: SqlRunner, ttlMs: number, now = Date.now()): Promise<number> {
  const res = await db.run(`DELETE FROM world_agents WHERE deleted_at IS NOT NULL AND deleted_at < ?`, [now - ttlMs]);
  return res.changes;
}

// --- routine helpers (trigger temporali) -----------------------------------

function rowToRoutine(r: Record<string, unknown>): Routine {
  return {
    id: String(r.id),
    name: String(r.name),
    title: String(r.title),
    branch: String(r.branch ?? ""),
    kind: r.kind === "daily" ? "daily" : "interval",
    intervalMin: Number(r.interval_min),
    atHour: Number(r.at_hour),
    atMin: Number(r.at_min),
    enabled: Number(r.enabled) !== 0,
    lastRun: Number(r.last_run),
  };
}

/** All routines, oldest first. */
export async function listRoutines(db: SqlRunner): Promise<Routine[]> {
  const rows = await db.all(`SELECT * FROM routines ORDER BY created_at ASC`);
  return rows.map(rowToRoutine);
}

/** Insert a new routine (id generated by the caller) and return it. */
export async function insertRoutine(db: SqlRunner, id: string, input: RoutineInput): Promise<Routine> {
  await db.run(
    `INSERT INTO routines (id, name, title, branch, kind, interval_min, at_hour, at_min, enabled, last_run, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    [
      id,
      input.name,
      input.title,
      input.branch,
      input.kind,
      input.intervalMin,
      input.atHour,
      input.atMin,
      input.enabled ? 1 : 0,
      Date.now(),
    ],
  );
  return { ...input, id, lastRun: 0 };
}

export async function deleteRoutine(db: SqlRunner, id: string): Promise<void> {
  await db.run(`DELETE FROM routines WHERE id = ?`, [id]);
}

export async function setRoutineEnabled(db: SqlRunner, id: string, enabled: boolean): Promise<void> {
  await db.run(`UPDATE routines SET enabled = ? WHERE id = ?`, [enabled ? 1 : 0, id]);
}

/**
 * Prenota l'esecuzione di una routine dovuta (25/11): Render e il PC usano lo stesso
 * database e vedrebbero entrambi la routine "dovuta". Il timbro si scrive solo se
 * `last_run` è ancora quello letto: il database lo lascia fare al primo che ci prova,
 * per l'altro non cambia nessuna riga e la routine la salta. true = tocca a te.
 */
export async function claimRoutineRun(db: SqlRunner, id: string, seenLastRun: number, ts: number): Promise<boolean> {
  const { changes } = await db.run(`UPDATE routines SET last_run = ? WHERE id = ? AND last_run = ?`, [ts, id, seenLastRun]);
  return changes > 0;
}

// --- agent memory helpers ---------------------------------------------------
// `key` è una parola riservata in MySQL: va sempre tra backtick (che SQLite accetta).

export interface MemoryEntry { key: string; value: string; updatedAt: number }

export async function setMemory(db: SqlRunner, agentId: string, key: string, value: string): Promise<void> {
  await db.run(
    `INSERT INTO agent_memory (agent_id, \`key\`, value, updated_at) VALUES (?, ?, ?, ?)
     ${onConflictUpdate(db.dialect, ["agent_id", "`key`"], ["value", "updated_at"])}`,
    [agentId, key.slice(0, 100), value.slice(0, 2000), Date.now()],
  );
}

export async function getMemory(db: SqlRunner, agentId: string, key: string): Promise<string | null> {
  const row = await db.get<{ value: string }>(`SELECT value FROM agent_memory WHERE agent_id = ? AND \`key\` = ?`, [
    agentId,
    key,
  ]);
  return row?.value ?? null;
}

export async function listMemory(db: SqlRunner, agentId: string): Promise<MemoryEntry[]> {
  const rows = await db.all<MemoryEntry>(
    `SELECT \`key\`, value, updated_at AS updatedAt FROM agent_memory WHERE agent_id = ? ORDER BY updated_at DESC LIMIT 30`,
    [agentId],
  );
  return rows.map((r) => ({ key: String(r.key), value: String(r.value), updatedAt: Number(r.updatedAt) }));
}

export async function clearMemory(db: SqlRunner, agentId: string): Promise<void> {
  await db.run(`DELETE FROM agent_memory WHERE agent_id = ?`, [agentId]);
}

/** Append one finished task to the log. */
export async function insertTask(db: SqlRunner, e: TaskLogEntry): Promise<void> {
  await db.run(
    `INSERT INTO task_log (agent_id, agent_name, title, branch, status, tokens, ts, summary)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [e.agentId, e.agentName, e.title, e.branch, e.status, e.tokens, e.ts, (e.summary ?? "").slice(0, 4000)],
  );
}

/** I task che hanno lavorato su questi branch, dal più recente (Reparto revisioni). */
export async function tasksOnBranches(db: SqlRunner, branches: string[], limit = 30): Promise<TaskLogEntry[]> {
  const list = [...new Set(branches.filter(Boolean))];
  if (list.length === 0) return [];
  const rows = await db.all<TaskLogEntry>(
    `SELECT agent_id AS agentId, agent_name AS agentName, title, branch, status, tokens, ts, COALESCE(summary, '') AS summary
     FROM task_log WHERE branch IN (${list.map(() => "?").join(", ")}) ORDER BY ts DESC LIMIT ?`,
    [...list, limit],
  );
  return rows.map((r) => ({ ...r, tokens: Number(r.tokens), ts: Number(r.ts), summary: String(r.summary ?? "") }));
}

/** L'ultimo task di ogni agente nello storico (per lo stato in /api/world dopo un riavvio). */
export async function latestTaskPerAgent(db: SqlRunner): Promise<Map<string, { status: string; title: string; ts: number }>> {
  const rows = await db.all<{ agentId: string; status: string; title: string; ts: number }>(
    `SELECT t.agent_id AS agentId, t.status, t.title, t.ts
     FROM task_log t JOIN (SELECT agent_id, MAX(ts) AS m FROM task_log GROUP BY agent_id) x
       ON t.agent_id = x.agent_id AND t.ts = x.m`,
  );
  const out = new Map<string, { status: string; title: string; ts: number }>();
  for (const r of rows) out.set(String(r.agentId), { status: String(r.status), title: String(r.title), ts: Number(r.ts) });
  return out;
}

/** Most recent tasks, newest first. */
export async function recentTasks(db: SqlRunner, limit = 20): Promise<TaskLogEntry[]> {
  const rows = await db.all<TaskLogEntry>(
    `SELECT agent_id AS agentId, agent_name AS agentName, title, branch, status, tokens, ts, COALESCE(summary, '') AS summary
     FROM task_log ORDER BY ts DESC LIMIT ?`,
    [limit],
  );
  // Il riassunto serve alla Cronologia, che apre la riga sul risultato (collaudo 21/11).
  return rows.map((r) => ({ ...r, tokens: Number(r.tokens), ts: Number(r.ts), summary: String(r.summary ?? "") }));
}

/** Cumulative counts across the whole log. */
export async function taskStats(db: SqlRunner): Promise<TaskStats> {
  const row = await db.get<{ total: number; completed: number | null; tokens: number }>(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN status IN ('review', 'done') THEN 1 ELSE 0 END) AS completed,
            COALESCE(SUM(tokens), 0) AS tokens
     FROM task_log`,
  );
  return { total: Number(row?.total ?? 0), completed: Number(row?.completed ?? 0), tokens: Number(row?.tokens ?? 0) };
}

// --- auth: utenti + sessioni (frontiera #3) --------------------------------

function rowToUser(row: Record<string, unknown> | undefined): User | null {
  if (!row) return null;
  return {
    id: String(row.id),
    email: String(row.email),
    name: String(row.name),
    passHash: String(row.pass_hash),
    role: String(row.role) as Role,
    createdAt: Number(row.created_at),
    emailVerified: Number(row.email_verified ?? 0) === 1,
  };
}

/** Quanti account esistono (il primo registrato diventa owner). */
export async function countUsers(db: SqlRunner): Promise<number> {
  return Number((await db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM users`))?.n ?? 0);
}

/** Crea un utente. Lancia se l'email esiste già (vincolo UNIQUE). */
export async function createUser(db: SqlRunner, u: User): Promise<void> {
  await db.run(
    `INSERT INTO users (id, email, name, pass_hash, role, created_at, email_verified) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [u.id, u.email, u.name, u.passHash, u.role, u.createdAt, u.emailVerified ? 1 : 0],
  );
}

export async function getUserByEmail(db: SqlRunner, email: string): Promise<User | null> {
  return rowToUser(await db.get(`SELECT * FROM users WHERE email = ?`, [email]));
}

export async function getUserById(db: SqlRunner, id: string): Promise<User | null> {
  return rowToUser(await db.get(`SELECT * FROM users WHERE id = ?`, [id]));
}

/** Tutti gli utenti (senza hash), più vecchi prima. Per la gestione ruoli dell'owner. */
export async function listUsers(
  db: SqlRunner,
): Promise<Array<{ email: string; name: string; role: Role; createdAt: number; emailVerified: boolean }>> {
  const rows = await db.all(`SELECT email, name, role, created_at, email_verified FROM users ORDER BY created_at ASC`);
  return rows.map((r) => ({
    email: String(r.email),
    name: String(r.name),
    role: String(r.role) as Role,
    createdAt: Number(r.created_at),
    emailVerified: Number(r.email_verified ?? 0) === 1,
  }));
}

/** Quanti owner esistono (per non lasciare il workspace senza owner). */
export async function countOwners(db: SqlRunner): Promise<number> {
  return Number((await db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM users WHERE role = 'owner'`))?.n ?? 0);
}

/** Cambia il ruolo di un utente (per email). Ritorna true se una riga è stata aggiornata. */
export async function setUserRole(db: SqlRunner, email: string, role: Role): Promise<boolean> {
  return (await db.run(`UPDATE users SET role = ? WHERE email = ?`, [role, email])).changes > 0;
}

/**
 * Crea una sessione (token → utente) con scadenza. Nel DB finisce solo l'**hash** del
 * token, come per i link di reset: chi legge una copia del database non può entrare
 * con le sessioni che ci trova (revisione di sicurezza 20/11/2026).
 */
export async function createAuthSession(db: SqlRunner, token: string, userId: string, expiresAt: number): Promise<void> {
  await db.run(`INSERT INTO auth_sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`, [
    hashToken(token),
    userId,
    Date.now(),
    expiresAt,
  ]);
}

/** L'utente dietro un token di sessione **valido** (non scaduto), o null. */
export async function getSessionUser(db: SqlRunner, token: string, now = Date.now()): Promise<User | null> {
  if (!token) return null;
  const row = await db.get(
    `SELECT u.* FROM auth_sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > ?`,
    [hashToken(token), now],
  );
  return rowToUser(row);
}

export async function deleteAuthSession(db: SqlRunner, token: string): Promise<void> {
  await db.run(`DELETE FROM auth_sessions WHERE token = ?`, [hashToken(token)]);
}

/** Aggiorna l'hash password di un utente. */
export async function updateUserPassword(db: SqlRunner, userId: string, passHash: string): Promise<void> {
  await db.run(`UPDATE users SET pass_hash = ? WHERE id = ?`, [passHash, userId]);
}

/**
 * Invalida tutte le sessioni dell'utente **tranne** una (quella corrente): dopo un cambio
 * password gli altri dispositivi vengono sloggati, quello che l'ha cambiata resta attivo.
 */
export async function deleteUserSessionsExcept(db: SqlRunner, userId: string, keepToken: string): Promise<void> {
  await db.run(`DELETE FROM auth_sessions WHERE user_id = ? AND token != ?`, [userId, hashToken(keepToken)]);
}

/** Rimuove le sessioni scadute (GC). Ritorna quante ne ha tolte. */
export async function pruneAuthSessions(db: SqlRunner, now = Date.now()): Promise<number> {
  return (await db.run(`DELETE FROM auth_sessions WHERE expires_at <= ?`, [now])).changes;
}

/** Invalida **tutte** le sessioni di un utente. Dopo un reset password nessun
 *  dispositivo entrato con la vecchia password deve restare dentro. */
export async function deleteAllUserSessions(db: SqlRunner, userId: string): Promise<number> {
  return (await db.run(`DELETE FROM auth_sessions WHERE user_id = ?`, [userId])).changes;
}

/** Marca l'indirizzo di un utente come confermato. */
export async function setEmailVerified(db: SqlRunner, userId: string, verified: boolean): Promise<void> {
  await db.run(`UPDATE users SET email_verified = ? WHERE id = ?`, [verified ? 1 : 0, userId]);
}

// --- token monouso: reset password + verifica email -------------------------
// Le due tabelle hanno forma identica, quindi le funzioni sono parametrizzate sul
// nome della tabella invece di essere duplicate. `Table` è un'unione chiusa (non una
// stringa qualsiasi) così il nome non può mai arrivare dall'esterno: interpolarlo in
// SQL è sicuro solo perché il compilatore garantisce che sia uno di questi due.

type TokenTable = "password_resets" | "email_verifications";

function rowToToken(row: Record<string, unknown> | undefined): TokenRecord | null {
  if (!row) return null;
  return {
    tokenHash: String(row.token_hash),
    userId: String(row.user_id),
    createdAt: Number(row.created_at),
    expiresAt: Number(row.expires_at),
    usedAt: row.used_at === null || row.used_at === undefined ? null : Number(row.used_at),
  };
}

/**
 * Registra un token monouso. Prima cancella gli **altri token non usati** dello stesso
 * utente sulla stessa tabella: chiedere un nuovo link invalida il precedente, così non
 * restano in giro più link validi in parallelo (se qualcuno chiede il reset due volte,
 * vale solo l'ultimo).
 */
export async function createToken(db: SqlRunner, table: TokenTable, rec: TokenRecord): Promise<void> {
  await db.run(`DELETE FROM ${table} WHERE user_id = ? AND used_at IS NULL`, [rec.userId]);
  await db.run(`INSERT INTO ${table} (token_hash, user_id, created_at, expires_at, used_at) VALUES (?, ?, ?, ?, ?)`, [
    rec.tokenHash,
    rec.userId,
    rec.createdAt,
    rec.expiresAt,
    rec.usedAt,
  ]);
}

/** Legge un token dal suo hash (la spendibilità la giudica `isTokenUsable`). */
export async function getToken(db: SqlRunner, table: TokenTable, tokenHash: string): Promise<TokenRecord | null> {
  return rowToToken(await db.get(`SELECT * FROM ${table} WHERE token_hash = ?`, [tokenHash]));
}

/**
 * Marca un token come speso. Ritorna `true` solo se è stata questa chiamata a spenderlo
 * (`used_at IS NULL` nella WHERE): il DB è l'arbitro, quindi due richieste in corsa con
 * lo stesso token non possono riuscire entrambe.
 */
export async function consumeToken(
  db: SqlRunner,
  table: TokenTable,
  tokenHash: string,
  now = Date.now(),
): Promise<boolean> {
  return (await db.run(`UPDATE ${table} SET used_at = ? WHERE token_hash = ? AND used_at IS NULL`, [now, tokenHash]))
    .changes > 0;
}

/** GC dei token scaduti o già spesi (le due tabelle non crescono all'infinito). */
export async function pruneTokens(db: SqlRunner, table: TokenTable, now = Date.now()): Promise<number> {
  return (await db.run(`DELETE FROM ${table} WHERE expires_at <= ? OR used_at IS NOT NULL`, [now])).changes;
}

// --- inviti (D3-B) ------------------------------------------------------------

function rowToInvite(row: Record<string, unknown> | undefined): InviteRecord | null {
  if (!row) return null;
  return {
    id: String(row.id),
    tokenHash: String(row.token_hash),
    email: String(row.email),
    role: String(row.role) as InvitableRole,
    invitedBy: String(row.invited_by),
    createdAt: Number(row.created_at),
    expiresAt: Number(row.expires_at),
    usedAt: row.used_at === null || row.used_at === undefined ? null : Number(row.used_at),
  };
}

/** Registra un invito; uno nuovo alla stessa email sostituisce quelli non ancora usati. */
export async function createInvite(db: SqlRunner, rec: InviteRecord): Promise<void> {
  await db.run(`DELETE FROM invites WHERE email = ? AND used_at IS NULL`, [rec.email]);
  await db.run(
    `INSERT INTO invites (id, token_hash, email, role, invited_by, created_at, expires_at, used_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [rec.id, rec.tokenHash, rec.email, rec.role, rec.invitedBy, rec.createdAt, rec.expiresAt, rec.usedAt],
  );
}

export async function getInviteByHash(db: SqlRunner, tokenHash: string): Promise<InviteRecord | null> {
  return rowToInvite(await db.get(`SELECT * FROM invites WHERE token_hash = ?`, [tokenHash]));
}

/** Spende l'invito: true solo per la chiamata che lo spende davvero (arbitro: il DB). */
export async function consumeInvite(db: SqlRunner, tokenHash: string, now = Date.now()): Promise<boolean> {
  return (await db.run(`UPDATE invites SET used_at = ? WHERE token_hash = ? AND used_at IS NULL`, [now, tokenHash]))
    .changes > 0;
}

/** Inviti ancora spendibili, i più recenti prima (per la gestione utenti dell'owner). */
export async function listPendingInvites(db: SqlRunner, now = Date.now()): Promise<PendingInvite[]> {
  const rows = await db.all(
    `SELECT id, email, role, created_at, expires_at FROM invites
     WHERE used_at IS NULL AND expires_at > ? ORDER BY created_at DESC`,
    [now],
  );
  return rows.map((r) => ({
    id: String(r.id),
    email: String(r.email),
    role: String(r.role) as InvitableRole,
    createdAt: Number(r.created_at),
    expiresAt: Number(r.expires_at),
  }));
}

/** Revoca un invito ancora in attesa. Un invito già usato resta come traccia. */
export async function revokeInvite(db: SqlRunner, id: string): Promise<boolean> {
  return (await db.run(`DELETE FROM invites WHERE id = ? AND used_at IS NULL`, [id])).changes > 0;
}

/** GC degli inviti scaduti o spesi. */
export async function pruneInvites(db: SqlRunner, now = Date.now()): Promise<number> {
  return (await db.run(`DELETE FROM invites WHERE expires_at <= ? OR used_at IS NOT NULL`, [now])).changes;
}

// --- singleton condiviso ------------------------------------------------------

let _db: SqlDriver | null = null;
let _opening: Promise<SqlDriver> | null = null;

/**
 * Il certificato CA per il TLS verso MySQL: il PEM stesso (anche con `\n` letterali,
 * comodo nelle variabili d'ambiente dei pannelli di hosting) o il percorso di un file.
 */
export function resolveSslCa(raw: string | undefined): string | undefined {
  const v = (raw ?? "").trim();
  if (!v) return undefined;
  if (v.includes("BEGIN CERTIFICATE")) return v.replace(/\\n/g, "\n");
  return readFileSync(v, "utf8");
}

/** Che backend userà `initDb` con queste variabili (per i log di avvio). */
export function dbBackend(env: NodeJS.ProcessEnv = process.env): "mysql" | "sqlite" {
  return (env.SAMS_DB_URL ?? "").trim() ? "mysql" : "sqlite";
}

/**
 * Apre e migra il database condiviso: MySQL se c'è `SAMS_DB_URL`, altrimenti il file
 * SQLite in `SAMS_DATA_DIR`. Va atteso **prima** di servire richieste. Se MySQL è
 * configurato ma non risponde, lancia: niente ripiego silenzioso su SQLite, che
 * scriverebbe i dati nel posto sbagliato.
 */
export function initDb(env: NodeJS.ProcessEnv = process.env): Promise<SqlDriver> {
  if (_db) return Promise.resolve(_db);
  if (!_opening) {
    const url = (env.SAMS_DB_URL ?? "").trim();
    _opening = (
      url
        ? openMysql({ url, sslCa: resolveSslCa(env.SAMS_DB_SSL_CA) }).then(migrate)
        : // Percorso calcolato qui e non al caricamento del modulo: così SAMS_DATA_DIR
          // del .env è già letto qualunque sia l'ordine degli import.
          openDb(dataFile(".sams-data.db"))
    ).then(
      (d) => (_db = d),
      (err) => {
        _opening = null;
        throw err;
      },
    );
  }
  return _opening;
}

/** Il database condiviso. Lancia se `initDb()` non è ancora stato atteso all'avvio. */
export function db(): SqlDriver {
  if (!_db) throw new Error("Database non inizializzato: attendi initDb() all'avvio");
  return _db;
}

/** Best-effort append of a finished task to the durable log (never throws). */
export async function logTask(e: TaskLogEntry): Promise<void> {
  try {
    await insertTask(db(), e);
  } catch (err) {
    console.warn("task log write failed:", (err as Error).message);
  }
}

// --- account GitHub collegati ------------------------------------------------

export interface GithubLinkRow {
  userId: string;
  login: string;
  /** Token cifrato (AES-256-GCM): si decifra solo in githubAccounts.ts. */
  tokenEnc: string;
  repo: string;
  baseBranch: string;
  updatedAt: number;
}

/** Il collegamento GitHub di un utente, o null se non l'ha fatto. */
export async function getGithubLink(db: SqlRunner, userId: string): Promise<GithubLinkRow | null> {
  const r = await db.get(`SELECT * FROM github_links WHERE user_id = ?`, [userId]);
  if (!r) return null;
  return {
    userId: String(r.user_id),
    login: String(r.login),
    tokenEnc: String(r.token_enc),
    repo: String(r.repo ?? ""),
    baseBranch: String(r.base_branch ?? ""),
    updatedAt: Number(r.updated_at),
  };
}

/**
 * Salva (o rinnova) il collegamento dopo l'autorizzazione su GitHub. Se l'utente ricollega
 * lo **stesso** account la repo scelta resta; se collega un account diverso si azzera,
 * perché la repo di prima potrebbe non essere accessibile al nuovo token.
 */
export async function saveGithubLink(
  db: SqlDriver,
  userId: string,
  login: string,
  tokenEnc: string,
  now = Date.now(),
): Promise<void> {
  await db.transaction(async (tx) => {
    const prev = await getGithubLink(tx, userId);
    const kept = prev && prev.login.toLowerCase() === login.toLowerCase() ? prev : null;
    await tx.run(
      `INSERT INTO github_links (user_id, login, token_enc, repo, base_branch, updated_at) VALUES (?, ?, ?, ?, ?, ?)
       ${onConflictUpdate(tx.dialect, ["user_id"], ["login", "token_enc", "repo", "base_branch", "updated_at"])}`,
      [userId, login, tokenEnc, kept?.repo ?? "", kept?.baseBranch ?? "", now],
    );
  });
}

/** Imposta la repo (owner/repo) e il branch base scelti dall'utente. */
export async function setGithubRepo(
  db: SqlRunner,
  userId: string,
  repo: string,
  baseBranch: string,
  now = Date.now(),
): Promise<boolean> {
  const r = await db.run(`UPDATE github_links SET repo = ?, base_branch = ?, updated_at = ? WHERE user_id = ?`, [
    repo,
    baseBranch,
    now,
    userId,
  ]);
  return r.changes > 0;
}

/**
 * Elimina un account e ciò che è legato solo a quella persona (GDPR, diritto alla
 * cancellazione — pagina Privacy, 20/11/2026): sessioni, link monouso, GitHub collegato,
 * inviti in sospeso mandati da lei o a lei. Agenti, task e chat sono del workspace e
 * restano. Tutto in una transazione: o sparisce tutto o niente.
 */
export async function deleteUserAccount(db: SqlDriver, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const row = await tx.get<{ email: string }>(`SELECT email FROM users WHERE id = ?`, [userId]);
    await tx.run(`DELETE FROM auth_sessions WHERE user_id = ?`, [userId]);
    await tx.run(`DELETE FROM password_resets WHERE user_id = ?`, [userId]);
    await tx.run(`DELETE FROM email_verifications WHERE user_id = ?`, [userId]);
    await tx.run(`DELETE FROM github_links WHERE user_id = ?`, [userId]);
    await tx.run(`DELETE FROM invites WHERE used_at IS NULL AND invited_by = ?`, [userId]);
    if (row) await tx.run(`DELETE FROM invites WHERE used_at IS NULL AND email = ?`, [row.email]);
    await tx.run(`DELETE FROM users WHERE id = ?`, [userId]);
  });
}

/** Scollega GitHub per un utente. */
export async function deleteGithubLink(db: SqlRunner, userId: string): Promise<void> {
  await db.run(`DELETE FROM github_links WHERE user_id = ?`, [userId]);
}
