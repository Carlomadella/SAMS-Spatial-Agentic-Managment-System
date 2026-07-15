import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Routine, RoutineInput } from "./routines";
import { emptyWorld, type WorldAgentSnapshot, type WorldSnapshot } from "./worldState";
import { MAX_CHAT_MESSAGES, type ChatMessage } from "./chat";
import type { User } from "./auth";
import type { TokenRecord } from "./tokens";
import type { Role } from "./roles";

/**
 * Durable storage for the runtime, backed by SQLite (Node's built-in
 * `node:sqlite` — no native dependency to compile). For now it holds a
 * task-completion log so observability survives restarts; the helpers are
 * parameterized by a `DatabaseSync` so they can be unit-tested against an
 * in-memory database.
 */

const DB_FILE = path.join(process.cwd(), ".sams-data.db");

export interface TaskLogEntry {
  agentId: string;
  agentName: string;
  title: string;
  branch: string;
  status: string;
  tokens: number;
  ts: number;
}

export interface TaskStats {
  total: number;
  completed: number;
  tokens: number;
}

/** Open (and migrate) a database at `location`. Use ":memory:" in tests. */
export function openDb(location: string): DatabaseSync {
  const db = new DatabaseSync(location);
  db.exec(`
    CREATE TABLE IF NOT EXISTS task_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id   TEXT    NOT NULL,
      agent_name TEXT    NOT NULL,
      title      TEXT    NOT NULL,
      branch     TEXT    NOT NULL,
      status     TEXT    NOT NULL,
      tokens     INTEGER NOT NULL DEFAULT 0,
      ts         INTEGER NOT NULL
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
  `);
  ensureWorldAgentColumns(db);
  ensureUserColumns(db);
  migrateWorldAgents(db);
  return db;
}

/**
 * Aggiunge `users.email_verified` in modo idempotente. **Retro-compatibilità**: su un DB
 * preesistente gli account vengono marcati **verificati** nella stessa transazione in cui
 * la colonna nasce. È deliberato — chi ieri entrava non deve trovarsi chiuso fuori oggi
 * perché abbiamo aggiunto la verifica; il gate vale da qui in avanti, per i nuovi account.
 * Su un DB nuovo la tabella è vuota → l'UPDATE non tocca nulla.
 */
function ensureUserColumns(db: DatabaseSync): void {
  const cols = new Set(
    (db.prepare(`PRAGMA table_info(users)`).all() as { name: string }[]).map((c) => c.name),
  );
  if (!cols.has("email_verified")) {
    db.exec(`ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0`);
    db.exec(`UPDATE users SET email_verified = 1`);
  }
}

/**
 * Aggiunge in modo idempotente le colonne config/xp (opzione B2) a un
 * `world_agents` preesistente creato prima della loro introduzione. Su un DB nuovo
 * la `CREATE TABLE` le ha già → no-op; su uno vecchio le aggiunge via ALTER.
 */
function ensureWorldAgentColumns(db: DatabaseSync): void {
  const cols = new Set(
    (db.prepare(`PRAGMA table_info(world_agents)`).all() as { name: string }[]).map((c) => c.name),
  );
  const add = (name: string, ddl: string): void => {
    if (!cols.has(name)) db.exec(`ALTER TABLE world_agents ADD COLUMN ${ddl}`);
  };
  add("model", "model TEXT NOT NULL DEFAULT ''");
  add("instructions", "instructions TEXT NOT NULL DEFAULT ''");
  add("repo", "repo TEXT NOT NULL DEFAULT ''");
  add("xp", "xp INTEGER NOT NULL DEFAULT 0");
  add("assigned_by", "assigned_by TEXT NOT NULL DEFAULT ''");
}

/**
 * Migrazione una-tantum: semina `world_agents` dal vecchio blob `world_snapshot`,
 * così gli agenti durevoli sopravvivono al passaggio al versioning per-riga +
 * tombstone (Roadmap 4, frontiera #1 — opzione 1). Gira a ogni apertura ma è un
 * no-op se la tabella per-riga è già popolata.
 */
function migrateWorldAgents(db: DatabaseSync): void {
  const n = Number((db.prepare(`SELECT COUNT(*) AS n FROM world_agents`).get() as { n: number }).n);
  if (n > 0) return;
  const row = db.prepare(`SELECT agents FROM world_snapshot WHERE id = 1`).get() as { agents: string } | undefined;
  if (!row) return;
  let agents: WorldAgentSnapshot[] = [];
  try {
    const parsed = JSON.parse(row.agents);
    if (Array.isArray(parsed)) agents = parsed as WorldAgentSnapshot[];
  } catch {
    return; // blob corrotto → niente da migrare
  }
  const now = Date.now();
  const ins = db.prepare(
    `INSERT OR IGNORE INTO world_agents (id, name, color, role, status, task, progress, model, instructions, repo, xp, rev, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, NULL)`,
  );
  for (const a of agents) {
    if (!a || typeof a.id !== "string" || !a.id) continue;
    ins.run(
      a.id, a.name ?? "", a.color ?? "", a.role ?? "", a.status ?? "idle", a.task ?? null, Number(a.progress) || 0,
      a.model ?? "", a.instructions ?? "", a.repo ?? "", Number(a.xp) || 0, now,
    );
  }
}

// --- chat di workspace helpers (mondo condiviso) ---------------------------

/** The most recent chat messages, oldest-first (ready to render top-to-bottom). */
export function listChatMessages(db: DatabaseSync, limit = MAX_CHAT_MESSAGES): ChatMessage[] {
  const rows = db
    .prepare(`SELECT id, author, text, ts FROM chat_messages ORDER BY ts DESC, id DESC LIMIT ?`)
    .all(Math.max(1, Math.min(MAX_CHAT_MESSAGES, limit))) as Record<string, unknown>[];
  return rows
    .map((r) => ({ id: String(r.id), author: String(r.author), text: String(r.text), ts: Number(r.ts) }))
    .reverse();
}

/** Persist one chat message, then prune anything past the newest MAX_CHAT_MESSAGES. */
export function insertChatMessage(db: DatabaseSync, msg: ChatMessage): void {
  db.prepare(`INSERT OR REPLACE INTO chat_messages (id, author, text, ts) VALUES (?, ?, ?, ?)`).run(
    msg.id,
    msg.author,
    msg.text,
    msg.ts,
  );
  db.prepare(
    `DELETE FROM chat_messages WHERE id NOT IN (
       SELECT id FROM chat_messages ORDER BY ts DESC, id DESC LIMIT ?
     )`,
  ).run(MAX_CHAT_MESSAGES);
}

// --- world helpers (stato autorevole: roster per-riga + tombstone) ----------
//
// Il roster autorevole vive nella tabella `world_agents` (una riga per agente,
// con rev per-agente e tombstone). La riga `world_snapshot` (id=1) resta solo
// come **contatore di versione globale** per il CAS. Il merge server-side è ciò
// che rende sicura la cancellazione (Roadmap 4, frontiera #1 — opzione 1).

/** Tempo di vita dei tombstone: dopo tanto vengono potati (GC del roster). */
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
  rev: number;
  deleted_at: number | null;
}

/** Colonne del roster lette in giro (senza rev/updated_at/deleted_at ove non servono). */
const AGENT_COLS = "id, name, color, role, status, task, progress, model, instructions, repo, xp, assigned_by";

/** Versione globale + updatedAt (contatore CAS); zeri se mai scritto. */
function loadWorldVersion(db: DatabaseSync): { version: number; updatedAt: number } {
  const row = db.prepare(`SELECT version, updated_at FROM world_snapshot WHERE id = 1`).get() as
    | { version: number; updated_at: number }
    | undefined;
  return row ? { version: Number(row.version), updatedAt: Number(row.updated_at) } : { version: 0, updatedAt: 0 };
}

/** Incrementa la versione globale monotona e timbra updatedAt. */
function bumpWorldVersion(db: DatabaseSync): { version: number; updatedAt: number } {
  const version = loadWorldVersion(db).version + 1;
  const updatedAt = Date.now();
  db.prepare(
    `INSERT INTO world_snapshot (id, agents, version, updated_at) VALUES (1, '[]', ?, ?)
     ON CONFLICT (id) DO UPDATE SET version = excluded.version, updated_at = excluded.updated_at`,
  ).run(version, updatedAt);
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
  ...(r.deleted_at != null ? { deleted: true } : {}),
});

/**
 * Tutti gli agenti del roster autorevole, **tombstone inclusi** (col flag
 * `deleted`), in ordine d'inserimento. I client ne hanno bisogno per rimuovere
 * gli agenti cancellati; potati via `pruneWorldTombstones`.
 */
export function loadWorldAgents(db: DatabaseSync): WorldAgentSnapshot[] {
  const rows = db
    .prepare(`SELECT ${AGENT_COLS}, rev, deleted_at FROM world_agents ORDER BY rowid ASC`)
    .all() as unknown as WorldAgentRow[];
  return rows.map(rowToAgent);
}

/** The durable authoritative world snapshot, or an empty one if never saved. */
export function loadWorldSnapshot(db: DatabaseSync): WorldSnapshot {
  const { version, updatedAt } = loadWorldVersion(db);
  if (version === 0) return emptyWorld();
  return { agents: loadWorldAgents(db), version, updatedAt };
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
  String(prev.assigned_by ?? "") === (a.assignedBy ?? "");

/** Esito di una fusione: lo snapshot autorevole + se ha davvero cambiato qualcosa. */
export interface WorldMergeResult extends WorldSnapshot {
  /** true se la fusione ha modificato il roster (create/update/tombstone); false = no-op. */
  changed: boolean;
}

/**
 * Fonde il roster completo in arrivo riga per riga; bumpa la versione globale
 * **solo se qualcosa è cambiato**.
 *
 * - upsert di ogni agente in arrivo (rev++ se cambiato; **resuscita** un tombstone
 *   con lo stesso id → `deleted_at = NULL`);
 * - **tombstone-by-absence**: ogni riga *viva* assente dal roster in arrivo viene
 *   marcata cancellata. È sicuro **solo** perché il gestore ammette questa scrittura
 *   unicamente se CAS-fresca (`baseVersion === current`): il client aveva adottato
 *   l'ultimo roster, quindi un'assenza è una cancellazione voluta, non una vista
 *   stantìa. Una creazione concorrente non-ancora-pushata avrebbe fatto 409.
 * - **no-op**: se nulla cambia (la vista che ha appena adottato rispinge un roster
 *   identico a quello salvato) non si bumpa la versione né si forza un broadcast —
 *   si evita il ping-pong (bump + echo) e i 409 a vuoto tra viste convergenti.
 *
 * Ritorna lo snapshot autorevole (agenti vivi **+ tombstone**) e il flag `changed`.
 */
export function saveWorldAgents(db: DatabaseSync, incoming: WorldAgentSnapshot[]): WorldMergeResult {
  const now = Date.now();
  const existing = new Map<string, WorldAgentRow>(
    (db.prepare(`SELECT ${AGENT_COLS}, rev, deleted_at FROM world_agents`).all() as unknown as WorldAgentRow[]).map(
      (r) => [String(r.id), r],
    ),
  );
  const incomingIds = new Set(incoming.map((a) => a.id));

  const upsert = db.prepare(
    `INSERT INTO world_agents (id, name, color, role, status, task, progress, model, instructions, repo, xp, assigned_by, rev, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
     ON CONFLICT (id) DO UPDATE SET
       name = excluded.name, color = excluded.color, role = excluded.role, status = excluded.status,
       task = excluded.task, progress = excluded.progress, model = excluded.model,
       instructions = excluded.instructions, repo = excluded.repo, xp = excluded.xp,
       assigned_by = excluded.assigned_by,
       rev = excluded.rev, updated_at = excluded.updated_at, deleted_at = NULL`,
  );
  const tombstone = db.prepare(
    `UPDATE world_agents SET rev = rev + 1, updated_at = ?, deleted_at = ? WHERE id = ? AND deleted_at IS NULL`,
  );

  let changed = false;
  for (const a of incoming) {
    const prev = existing.get(a.id);
    if (prev && agentUnchanged(prev, a)) continue; // nessun cambiamento → niente scrittura né rev
    const rev = prev ? Number(prev.rev) + 1 : 1;
    upsert.run(a.id, a.name, a.color, a.role, a.status, a.task, a.progress, a.model ?? "", a.instructions ?? "", a.repo ?? "", a.xp ?? 0, a.assignedBy ?? "", rev, now);
    changed = true;
  }
  for (const [id, r] of existing) {
    if (!incomingIds.has(id) && r.deleted_at == null) {
      tombstone.run(now, now, id);
      changed = true;
    }
  }

  // GC dei tombstone scaduti: indipendente dal `changed` (rimuove solo voci già
  // morte che i client hanno da tempo processato → non deve forzare un broadcast).
  pruneWorldTombstones(db, TOMBSTONE_TTL_MS, now);

  const { version, updatedAt } = changed ? bumpWorldVersion(db) : loadWorldVersion(db);
  return { agents: loadWorldAgents(db), version, updatedAt, changed };
}

/** Pota i tombstone più vecchi di `ttlMs`. Ritorna quante righe ha rimosso. */
export function pruneWorldTombstones(db: DatabaseSync, ttlMs: number, now = Date.now()): number {
  const res = db.prepare(`DELETE FROM world_agents WHERE deleted_at IS NOT NULL AND deleted_at < ?`).run(now - ttlMs);
  return Number(res.changes ?? 0);
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
export function listRoutines(db: DatabaseSync): Routine[] {
  const rows = db.prepare(`SELECT * FROM routines ORDER BY created_at ASC`).all() as Record<string, unknown>[];
  return rows.map(rowToRoutine);
}

/** Insert a new routine (id generated by the caller) and return it. */
export function insertRoutine(db: DatabaseSync, id: string, input: RoutineInput): Routine {
  db.prepare(
    `INSERT INTO routines (id, name, title, branch, kind, interval_min, at_hour, at_min, enabled, last_run, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
  ).run(
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
  );
  return { ...input, id, lastRun: 0 };
}

export function deleteRoutine(db: DatabaseSync, id: string): void {
  db.prepare(`DELETE FROM routines WHERE id = ?`).run(id);
}

export function setRoutineEnabled(db: DatabaseSync, id: string, enabled: boolean): void {
  db.prepare(`UPDATE routines SET enabled = ? WHERE id = ?`).run(enabled ? 1 : 0, id);
}

/** Stamp the last-run time (called by the scheduler when a routine fires). */
export function markRoutineRun(db: DatabaseSync, id: string, ts: number): void {
  db.prepare(`UPDATE routines SET last_run = ? WHERE id = ?`).run(ts, id);
}

// --- agent memory helpers ---------------------------------------------------

export interface MemoryEntry { key: string; value: string; updatedAt: number }

export function setMemory(db: DatabaseSync, agentId: string, key: string, value: string): void {
  db.prepare(
    `INSERT INTO agent_memory (agent_id, key, value, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (agent_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(agentId, key.slice(0, 100), value.slice(0, 2000), Date.now());
}

export function getMemory(db: DatabaseSync, agentId: string, key: string): string | null {
  const row = db.prepare(`SELECT value FROM agent_memory WHERE agent_id = ? AND key = ?`).get(agentId, key) as
    | { value: string } | undefined;
  return row?.value ?? null;
}

export function listMemory(db: DatabaseSync, agentId: string): MemoryEntry[] {
  return (db.prepare(
    `SELECT key, value, updated_at AS updatedAt FROM agent_memory WHERE agent_id = ? ORDER BY updated_at DESC LIMIT 30`,
  ).all(agentId) as unknown as MemoryEntry[]).map((r) => ({ ...r, updatedAt: Number(r.updatedAt) }));
}

export function clearMemory(db: DatabaseSync, agentId: string): void {
  db.prepare(`DELETE FROM agent_memory WHERE agent_id = ?`).run(agentId);
}

/** Append one finished task to the log. */
export function insertTask(db: DatabaseSync, e: TaskLogEntry): void {
  db.prepare(
    `INSERT INTO task_log (agent_id, agent_name, title, branch, status, tokens, ts)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(e.agentId, e.agentName, e.title, e.branch, e.status, e.tokens, e.ts);
}

/** Most recent tasks, newest first. */
export function recentTasks(db: DatabaseSync, limit = 20): TaskLogEntry[] {
  const rows = db
    .prepare(
      `SELECT agent_id AS agentId, agent_name AS agentName, title, branch, status, tokens, ts
       FROM task_log ORDER BY ts DESC LIMIT ?`,
    )
    .all(limit) as unknown as TaskLogEntry[];
  return rows.map((r) => ({ ...r, tokens: Number(r.tokens), ts: Number(r.ts) }));
}

/** Cumulative counts across the whole log. */
export function taskStats(db: DatabaseSync): TaskStats {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status IN ('review', 'done') THEN 1 ELSE 0 END) AS completed,
              COALESCE(SUM(tokens), 0) AS tokens
       FROM task_log`,
    )
    .get() as { total: number; completed: number | null; tokens: number };
  return { total: Number(row.total), completed: Number(row.completed ?? 0), tokens: Number(row.tokens) };
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
export function countUsers(db: DatabaseSync): number {
  return Number((db.prepare(`SELECT COUNT(*) AS n FROM users`).get() as { n: number }).n);
}

/** Crea un utente. Lancia se l'email esiste già (vincolo UNIQUE). */
export function createUser(db: DatabaseSync, u: User): void {
  db.prepare(
    `INSERT INTO users (id, email, name, pass_hash, role, created_at, email_verified) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(u.id, u.email, u.name, u.passHash, u.role, u.createdAt, u.emailVerified ? 1 : 0);
}

export function getUserByEmail(db: DatabaseSync, email: string): User | null {
  return rowToUser(db.prepare(`SELECT * FROM users WHERE email = ?`).get(email) as Record<string, unknown> | undefined);
}

export function getUserById(db: DatabaseSync, id: string): User | null {
  return rowToUser(db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as Record<string, unknown> | undefined);
}

/** Tutti gli utenti (senza hash), più vecchi prima. Per la gestione ruoli dell'owner. */
export function listUsers(
  db: DatabaseSync,
): Array<{ email: string; name: string; role: Role; createdAt: number; emailVerified: boolean }> {
  return (
    db
      .prepare(`SELECT email, name, role, created_at, email_verified FROM users ORDER BY created_at ASC`)
      .all() as Record<string, unknown>[]
  ).map((r) => ({
    email: String(r.email),
    name: String(r.name),
    role: String(r.role) as Role,
    createdAt: Number(r.created_at),
    emailVerified: Number(r.email_verified ?? 0) === 1,
  }));
}

/** Quanti owner esistono (per non lasciare il workspace senza owner). */
export function countOwners(db: DatabaseSync): number {
  return Number((db.prepare(`SELECT COUNT(*) AS n FROM users WHERE role = 'owner'`).get() as { n: number }).n);
}

/** Cambia il ruolo di un utente (per email). Ritorna true se una riga è stata aggiornata. */
export function setUserRole(db: DatabaseSync, email: string, role: Role): boolean {
  return Number(db.prepare(`UPDATE users SET role = ? WHERE email = ?`).run(role, email).changes) > 0;
}

/** Crea una sessione (token → utente) con scadenza. */
export function createAuthSession(db: DatabaseSync, token: string, userId: string, expiresAt: number): void {
  db.prepare(
    `INSERT INTO auth_sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`,
  ).run(token, userId, Date.now(), expiresAt);
}

/** L'utente dietro un token di sessione **valido** (non scaduto), o null. */
export function getSessionUser(db: DatabaseSync, token: string, now = Date.now()): User | null {
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.* FROM auth_sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`,
    )
    .get(token, now) as Record<string, unknown> | undefined;
  return rowToUser(row);
}

export function deleteAuthSession(db: DatabaseSync, token: string): void {
  db.prepare(`DELETE FROM auth_sessions WHERE token = ?`).run(token);
}

/** Aggiorna l'hash password di un utente. */
export function updateUserPassword(db: DatabaseSync, userId: string, passHash: string): void {
  db.prepare(`UPDATE users SET pass_hash = ? WHERE id = ?`).run(passHash, userId);
}

/**
 * Invalida tutte le sessioni dell'utente **tranne** una (quella corrente): dopo un cambio
 * password gli altri dispositivi vengono sloggati, quello che l'ha cambiata resta attivo.
 */
export function deleteUserSessionsExcept(db: DatabaseSync, userId: string, keepToken: string): void {
  db.prepare(`DELETE FROM auth_sessions WHERE user_id = ? AND token != ?`).run(userId, keepToken);
}

/** Rimuove le sessioni scadute (GC). Ritorna quante ne ha tolte. */
export function pruneAuthSessions(db: DatabaseSync, now = Date.now()): number {
  return Number(db.prepare(`DELETE FROM auth_sessions WHERE expires_at <= ?`).run(now).changes);
}

/** Invalida **tutte** le sessioni di un utente. Dopo un reset password nessun
 *  dispositivo entrato con la vecchia password deve restare dentro. */
export function deleteAllUserSessions(db: DatabaseSync, userId: string): number {
  return Number(db.prepare(`DELETE FROM auth_sessions WHERE user_id = ?`).run(userId).changes);
}

/** Marca l'indirizzo di un utente come confermato. */
export function setEmailVerified(db: DatabaseSync, userId: string, verified: boolean): void {
  db.prepare(`UPDATE users SET email_verified = ? WHERE id = ?`).run(verified ? 1 : 0, userId);
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
export function createToken(db: DatabaseSync, table: TokenTable, rec: TokenRecord): void {
  db.prepare(`DELETE FROM ${table} WHERE user_id = ? AND used_at IS NULL`).run(rec.userId);
  db.prepare(
    `INSERT INTO ${table} (token_hash, user_id, created_at, expires_at, used_at) VALUES (?, ?, ?, ?, ?)`,
  ).run(rec.tokenHash, rec.userId, rec.createdAt, rec.expiresAt, rec.usedAt);
}

/** Legge un token dal suo hash (la spendibilità la giudica `isTokenUsable`). */
export function getToken(db: DatabaseSync, table: TokenTable, tokenHash: string): TokenRecord | null {
  return rowToToken(
    db.prepare(`SELECT * FROM ${table} WHERE token_hash = ?`).get(tokenHash) as Record<string, unknown> | undefined,
  );
}

/**
 * Marca un token come speso. Ritorna `true` solo se è stata questa chiamata a spenderlo
 * (`used_at IS NULL` nella WHERE): il DB è l'arbitro, quindi due richieste in corsa con
 * lo stesso token non possono riuscire entrambe.
 */
export function consumeToken(db: DatabaseSync, table: TokenTable, tokenHash: string, now = Date.now()): boolean {
  return (
    Number(
      db.prepare(`UPDATE ${table} SET used_at = ? WHERE token_hash = ? AND used_at IS NULL`).run(now, tokenHash).changes,
    ) > 0
  );
}

/** GC dei token scaduti o già spesi (le due tabelle non crescono all'infinito). */
export function pruneTokens(db: DatabaseSync, table: TokenTable, now = Date.now()): number {
  return Number(db.prepare(`DELETE FROM ${table} WHERE expires_at <= ? OR used_at IS NOT NULL`).run(now).changes);
}

// --- lazy singleton (file-backed) ------------------------------------------
let _db: DatabaseSync | null = null;

/** The shared file-backed database, opened on first use. */
export function db(): DatabaseSync {
  if (!_db) _db = openDb(DB_FILE);
  return _db;
}

/** Best-effort append of a finished task to the durable log (never throws). */
export function logTask(e: TaskLogEntry): void {
  try {
    insertTask(db(), e);
  } catch (err) {
    console.warn("task log write failed:", (err as Error).message);
  }
}
