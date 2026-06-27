import path from "node:path";
import { DatabaseSync } from "node:sqlite";

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
  `);
  return db;
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
