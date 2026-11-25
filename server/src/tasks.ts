// Il task come conversazione completa (idea 3 da Paperclip, scelta A del 25/11/2026).
//
// Ogni task ha un id sul server. Il server salva i suoi eventi (piano, strumenti usati con
// l'esito, file letti e scritti, blocchi, tentativi, risultato) e i commenti delle persone;
// un commento arriva all'agente al tentativo dopo. Tetto: gli ultimi 500 eventi per task.
// Scelta dell'utente: la storia si tiene 30 giorni (scaricabile), poi si cancella.
// Questa è anche la base delle idee 4 (dipendenze) e 5 (ripresa tra tentativi).

import { randomUUID } from "node:crypto";
import type { SqlDriver, SqlRunner } from "./sql";
import type { WireEvent } from "./types";

export const MAX_EVENTS_PER_TASK = 500;
export const TASK_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const MAX_COMMENT = 2000;

export type TaskEventKind = "attempt" | "plan" | "log" | "status" | "result" | "end";

export interface TaskRecord {
  id: string;
  agentId: string;
  agentName: string;
  title: string;
  branch: string;
  status: string;
  attempts: number;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface TaskEvent {
  seq: number;
  attempt: number;
  ts: number;
  kind: TaskEventKind;
  level: string;
  message: string;
  /** dati in più (piano, dettagli tecnici, riassunto…) */
  data: Record<string, unknown> | null;
}

export interface TaskComment {
  id: string;
  author: string;
  text: string;
  ts: number;
  /** tentativo in cui il commento è arrivato all'agente (null = non ancora) */
  deliveredAttempt: number | null;
}

export function newTaskId(): string {
  return `t-${randomUUID()}`;
}

export function isTaskId(v: unknown): v is string {
  return typeof v === "string" && /^t-[0-9a-f-]{36}$/.test(v);
}

// --- schema --------------------------------------------------------------------------

const SQLITE_DDL = `
  CREATE TABLE IF NOT EXISTS tasks (
    id         TEXT    PRIMARY KEY,
    agent_id   TEXT    NOT NULL,
    agent_name TEXT    NOT NULL,
    title      TEXT    NOT NULL,
    branch     TEXT    NOT NULL DEFAULT '',
    status     TEXT    NOT NULL DEFAULT 'working',
    attempts   INTEGER NOT NULL DEFAULT 0,
    created_by TEXT    NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_tasks_agent ON tasks (agent_id, updated_at);
  CREATE INDEX IF NOT EXISTS idx_tasks_updated ON tasks (updated_at);
  CREATE TABLE IF NOT EXISTS task_events (
    task_id TEXT    NOT NULL,
    seq     INTEGER NOT NULL,
    attempt INTEGER NOT NULL,
    ts      INTEGER NOT NULL,
    kind    TEXT    NOT NULL,
    level   TEXT    NOT NULL DEFAULT '',
    message TEXT    NOT NULL DEFAULT '',
    data    TEXT    NULL,
    PRIMARY KEY (task_id, seq)
  );
  CREATE TABLE IF NOT EXISTS task_comments (
    id                TEXT    PRIMARY KEY,
    task_id           TEXT    NOT NULL,
    author            TEXT    NOT NULL,
    text              TEXT    NOT NULL,
    ts                INTEGER NOT NULL,
    delivered_attempt INTEGER NULL
  );
  CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments (task_id, ts);
`;

const T = "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin";
const MYSQL_DDL = `
  CREATE TABLE IF NOT EXISTS tasks (
    id         VARCHAR(64)  NOT NULL PRIMARY KEY,
    agent_id   VARCHAR(191) NOT NULL,
    agent_name VARCHAR(255) NOT NULL,
    title      TEXT         NOT NULL,
    branch     VARCHAR(255) NOT NULL DEFAULT '',
    status     VARCHAR(32)  NOT NULL DEFAULT 'working',
    attempts   BIGINT       NOT NULL DEFAULT 0,
    created_by VARCHAR(255) NOT NULL DEFAULT '',
    created_at BIGINT       NOT NULL,
    updated_at BIGINT       NOT NULL,
    INDEX idx_tasks_agent (agent_id, updated_at),
    INDEX idx_tasks_updated (updated_at)
  ) ${T};
  CREATE TABLE IF NOT EXISTS task_events (
    task_id VARCHAR(64)  NOT NULL,
    seq     BIGINT       NOT NULL,
    attempt BIGINT       NOT NULL,
    ts      BIGINT       NOT NULL,
    kind    VARCHAR(16)  NOT NULL,
    level   VARCHAR(16)  NOT NULL DEFAULT '',
    message TEXT         NOT NULL,
    data    TEXT         NULL,
    PRIMARY KEY (task_id, seq)
  ) ${T};
  CREATE TABLE IF NOT EXISTS task_comments (
    id                VARCHAR(64)  NOT NULL PRIMARY KEY,
    task_id           VARCHAR(64)  NOT NULL,
    author            VARCHAR(255) NOT NULL,
    text              TEXT         NOT NULL,
    ts                BIGINT       NOT NULL,
    delivered_attempt BIGINT       NULL,
    INDEX idx_task_comments_task (task_id, ts)
  ) ${T};
`;

export async function ensureTaskTables(db: SqlDriver): Promise<void> {
  await db.exec(db.dialect === "mysql" ? MYSQL_DDL : SQLITE_DDL);
}

// --- task ------------------------------------------------------------------------------

const TASK_COLS = `id, agent_id AS agentId, agent_name AS agentName, title, branch, status, attempts, created_by AS createdBy, created_at AS createdAt, updated_at AS updatedAt`;

function toTask(r: TaskRecord): TaskRecord {
  return {
    id: String(r.id),
    agentId: String(r.agentId),
    agentName: String(r.agentName),
    title: String(r.title),
    branch: String(r.branch ?? ""),
    status: String(r.status),
    attempts: Number(r.attempts),
    createdBy: String(r.createdBy ?? ""),
    createdAt: Number(r.createdAt),
    updatedAt: Number(r.updatedAt),
  };
}

export async function createTask(
  db: SqlRunner,
  t: { id?: string; agentId: string; agentName: string; title: string; branch: string; createdBy: string },
  now = Date.now(),
): Promise<TaskRecord> {
  const id = t.id ?? newTaskId();
  await db.run(
    `INSERT INTO tasks (id, agent_id, agent_name, title, branch, status, attempts, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'queued', 0, ?, ?, ?)`,
    [id, t.agentId, t.agentName.slice(0, 255), t.title.slice(0, 4000), t.branch.slice(0, 255), t.createdBy.slice(0, 255), now, now],
  );
  return (await getTask(db, id))!;
}

export async function getTask(db: SqlRunner, id: string): Promise<TaskRecord | null> {
  const r = await db.get<TaskRecord>(`SELECT ${TASK_COLS} FROM tasks WHERE id = ?`, [id]);
  return r ? toTask(r) : null;
}

export async function listTasks(db: SqlRunner, opts: { agentId?: string; limit?: number } = {}): Promise<TaskRecord[]> {
  const limit = Math.max(1, Math.min(200, Math.floor(opts.limit ?? 20)));
  const rows = opts.agentId
    ? await db.all<TaskRecord>(`SELECT ${TASK_COLS} FROM tasks WHERE agent_id = ? ORDER BY updated_at DESC LIMIT ?`, [opts.agentId, limit])
    : await db.all<TaskRecord>(`SELECT ${TASK_COLS} FROM tasks ORDER BY updated_at DESC LIMIT ?`, [limit]);
  return rows.map(toTask);
}

/** Nuovo tentativo: ritorna il suo numero (1 per il primo). */
export async function beginAttempt(db: SqlRunner, taskId: string, branch: string, now = Date.now()): Promise<number> {
  await db.run(
    `UPDATE tasks SET attempts = attempts + 1, status = 'working', branch = CASE WHEN ? = '' THEN branch ELSE ? END, updated_at = ? WHERE id = ?`,
    [branch, branch.slice(0, 255), now, taskId],
  );
  const r = await db.get<{ n: number }>(`SELECT attempts AS n FROM tasks WHERE id = ?`, [taskId]);
  return Number(r?.n) || 1;
}

export async function setTaskStatus(db: SqlRunner, taskId: string, status: string, now = Date.now()): Promise<void> {
  await db.run(`UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?`, [status.slice(0, 32), now, taskId]);
}

// --- eventi ------------------------------------------------------------------------------

export async function nextSeq(db: SqlRunner, taskId: string): Promise<number> {
  const r = await db.get<{ m: number | null }>(`SELECT MAX(seq) AS m FROM task_events WHERE task_id = ?`, [taskId]);
  return (Number(r?.m) || 0) + 1;
}

export async function insertEvent(
  db: SqlRunner,
  taskId: string,
  e: Omit<TaskEvent, "data"> & { data?: Record<string, unknown> | null },
): Promise<void> {
  await db.run(
    `INSERT INTO task_events (task_id, seq, attempt, ts, kind, level, message, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [taskId, e.seq, e.attempt, e.ts, e.kind, e.level, e.message.slice(0, 4000), e.data ? JSON.stringify(e.data).slice(0, 16000) : null],
  );
  // Tetto: si tengono gli ultimi MAX_EVENTS_PER_TASK (gli inizi dei tentativi restano sempre).
  if (e.seq > MAX_EVENTS_PER_TASK && e.seq % 25 === 0) {
    await db.run(`DELETE FROM task_events WHERE task_id = ? AND seq <= ? AND kind <> 'attempt'`, [taskId, e.seq - MAX_EVENTS_PER_TASK]);
  }
}

export async function listEvents(db: SqlRunner, taskId: string): Promise<TaskEvent[]> {
  const rows = await db.all<{ seq: number; attempt: number; ts: number; kind: string; level: string; message: string; data: string | null }>(
    `SELECT seq, attempt, ts, kind, level, message, data FROM task_events WHERE task_id = ? ORDER BY seq ASC`,
    [taskId],
  );
  return rows.map((r) => {
    let data: Record<string, unknown> | null = null;
    if (r.data) {
      try {
        data = JSON.parse(String(r.data)) as Record<string, unknown>;
      } catch {
        data = null;
      }
    }
    return {
      seq: Number(r.seq),
      attempt: Number(r.attempt),
      ts: Number(r.ts),
      kind: String(r.kind) as TaskEventKind,
      level: String(r.level ?? ""),
      message: String(r.message ?? ""),
      data,
    };
  });
}

/**
 * Da un evento dello stream all'evento da salvare (null = non va nella storia: posizioni,
 * stanze, presenze…). Un evento può portare più cose: si tiene la più parlante.
 */
export function eventFromWire(e: WireEvent): Pick<TaskEvent, "kind" | "level" | "message" | "data"> | null {
  if (e.plan && e.plan.length) return { kind: "plan", level: "INFO", message: "Piano", data: { steps: e.plan.slice(0, 12) } };
  if (e.result) return { kind: "result", level: "SUCCESS", message: e.result.title, data: { summary: e.result.summary } };
  if (e.message) {
    const data: Record<string, unknown> = {};
    if (e.detail) data.detail = e.detail;
    if (e.status) data.status = e.status;
    return { kind: "log", level: e.level ?? "INFO", message: e.message, data: Object.keys(data).length ? data : null };
  }
  if (e.status) return { kind: "status", level: "INFO", message: e.status, data: null };
  return null;
}

// --- commenti ------------------------------------------------------------------------------

export async function addComment(db: SqlRunner, taskId: string, author: string, text: string, now = Date.now()): Promise<TaskComment> {
  const c: TaskComment = { id: randomUUID(), author: author.slice(0, 255), text: text.trim().slice(0, MAX_COMMENT), ts: now, deliveredAttempt: null };
  await db.run(`INSERT INTO task_comments (id, task_id, author, text, ts, delivered_attempt) VALUES (?, ?, ?, ?, ?, NULL)`, [
    c.id, taskId, c.author, c.text, c.ts,
  ]);
  await db.run(`UPDATE tasks SET updated_at = ? WHERE id = ?`, [now, taskId]);
  return c;
}

export async function listComments(db: SqlRunner, taskId: string): Promise<TaskComment[]> {
  const rows = await db.all<{ id: string; author: string; text: string; ts: number; d: number | null }>(
    `SELECT id, author, text, ts, delivered_attempt AS d FROM task_comments WHERE task_id = ? ORDER BY ts ASC`,
    [taskId],
  );
  return rows.map((r) => ({ id: String(r.id), author: String(r.author), text: String(r.text), ts: Number(r.ts), deliveredAttempt: r.d == null ? null : Number(r.d) }));
}

/**
 * I commenti non ancora consegnati diventano parte del prompt del tentativo `attempt`
 * (e si segnano come consegnati). "" se non ce ne sono.
 */
export async function takeCommentsForAttempt(db: SqlRunner, taskId: string, attempt: number): Promise<string> {
  const pending = (await listComments(db, taskId)).filter((c) => c.deliveredAttempt == null);
  if (pending.length === 0) return "";
  await db.run(`UPDATE task_comments SET delivered_attempt = ? WHERE task_id = ? AND delivered_attempt IS NULL`, [attempt, taskId]);
  return commentsPrompt(pending);
}

export function commentsPrompt(comments: Array<Pick<TaskComment, "author" | "text">>): string {
  if (comments.length === 0) return "";
  return (
    `Commenti delle persone su questo task (scritti dopo il tentativo precedente: tienine conto):\n` +
    comments.map((c) => `- ${c.author}: ${c.text}`).join("\n")
  );
}

// --- scadenza ed esportazione -------------------------------------------------------------

/** Cancella i task fermi da più di 30 giorni, con eventi e commenti. Ritorna quanti. */
export async function pruneOldTasks(db: SqlRunner, now = Date.now(), maxAgeMs = TASK_RETENTION_MS): Promise<number> {
  const old = await db.all<{ id: string }>(`SELECT id FROM tasks WHERE updated_at < ?`, [now - maxAgeMs]);
  for (const { id } of old) {
    await db.run(`DELETE FROM task_events WHERE task_id = ?`, [id]);
    await db.run(`DELETE FROM task_comments WHERE task_id = ?`, [id]);
    await db.run(`DELETE FROM tasks WHERE id = ?`, [id]);
  }
  return old.length;
}

export interface TaskExport {
  task: TaskRecord;
  events: TaskEvent[];
  comments: TaskComment[];
  /** quando questa storia verrà cancellata (30 giorni dopo l'ultima attività) */
  expiresAt: number;
}

export async function exportTask(db: SqlRunner, id: string): Promise<TaskExport | null> {
  const task = await getTask(db, id);
  if (!task) return null;
  return { task, events: await listEvents(db, id), comments: await listComments(db, id), expiresAt: task.updatedAt + TASK_RETENTION_MS };
}
