// Coda dei task sul server con «aspetta che finisca» (idea 4 da Paperclip, scelta A del 25/11/2026).
//
// Sostituisce la coda che viveva nel browser (si perdeva a pagina chiusa: su Render nessuna
// pagina è sempre aperta). Un task in coda può aspettare la fine di un altro task, anche di
// un altro agente: quando quello finisce bene, il server avvia da solo quello dopo e gli
// passa il riassunto del precedente. Se finisce bloccato (scelta dell'utente) quello dopo
// resta in attesa con un avviso e l'agente va in sala d'attesa.

import type { SqlDriver, SqlRunner } from "./sql";
import { createTask, getTask, listEvents, type TaskRecord } from "./tasks";

/** Stati di un task finito bene: chi lo aspetta può partire. */
export const DONE_OK = new Set(["review", "done"]);
/** Stati di un task finito male: chi lo aspetta resta in attesa con un avviso. */
export const DONE_BAD = new Set(["blocked", "idle"]);

/** Quello che serve per avviare più tardi un task messo in coda. */
export interface QueuePayload {
  role?: string;
  instructions?: string;
  /** repo già decisa (e consentita) quando il task è stato messo in coda */
  repo?: string | null;
  environment?: string;
  actor?: string;
  /** account SAMS di chi l'ha messo in coda (per usare il suo GitHub); "" = GitHub del server */
  userId?: string;
  /** con quale GitHub è stato messo in coda: alla partenza deve essere lo stesso tipo,
   *  mai un ripiego sul token del server */
  github?: "user" | "server";
  /** ruolo di chi l'ha messo in coda (owner non ha limiti di repo) */
  viewerRole?: string;
}

/** Task in coda al massimo per agente. */
export const MAX_QUEUE_PER_AGENT = 30;

/**
 * Con quale GitHub può partire adesso un task in coda: deve essere lo stesso tipo di quando
 * è stato messo in coda. Se chi l'ha messo in coda lavorava col suo GitHub e ora non c'è più
 * (account cancellato, GitHub scollegato), il task resta fermo: niente ripiego sul server.
 */
export function sameGithubKind(payload: QueuePayload, now: "user" | "server" | "missing"): { ok: true } | { ok: false; why: string } {
  const was = payload.github ?? (payload.userId ? "user" : "server");
  if (now === was) return { ok: true };
  if (was === "user") return { ok: false, why: "Chi l'ha messo in coda non ha più il suo GitHub collegato: il task resta fermo finché non lo ricollega (o rimuovilo dalla coda)." };
  return { ok: false, why: "Il GitHub con cui lavora il server è cambiato da quando il task è stato messo in coda: rimettilo in coda." };
}

export interface QueuedTask extends TaskRecord {
  afterTaskId: string;
  urgent: boolean;
  /** perché è fermo (es. il task atteso è finito bloccato); "" se non c'è niente da dire */
  waitNote: string;
  payload: QueuePayload;
}

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

/** Colonne della coda sulla tabella `tasks` (idempotente). */
export async function ensureQueueColumns(db: SqlDriver): Promise<void> {
  const cols = await columnNames(db, "tasks");
  const my = db.dialect === "mysql";
  const add = async (name: string, sqlite: string, mysql: string) => {
    if (!cols.has(name)) await db.exec(`ALTER TABLE tasks ADD COLUMN ${my ? mysql : sqlite}`);
  };
  await add("after_task_id", "after_task_id TEXT NOT NULL DEFAULT ''", "after_task_id VARCHAR(64) NOT NULL DEFAULT ''");
  await add("urgent", "urgent INTEGER NOT NULL DEFAULT 0", "urgent TINYINT NOT NULL DEFAULT 0");
  await add("wait_note", "wait_note TEXT NOT NULL DEFAULT ''", "wait_note VARCHAR(500) NOT NULL DEFAULT ''");
  await add("payload", "payload TEXT NULL", "payload TEXT NULL");
}

const Q_COLS = `id, agent_id AS agentId, agent_name AS agentName, title, branch, status, attempts, created_by AS createdBy, created_at AS createdAt, updated_at AS updatedAt, creator_user_id AS creatorUserId, after_task_id AS afterTaskId, urgent, wait_note AS waitNote, payload`;

interface QRow extends TaskRecord {
  afterTaskId: string;
  urgent: number;
  waitNote: string;
  payload: string | null;
}

function toQueued(r: QRow): QueuedTask {
  let payload: QueuePayload;
  try {
    payload = r.payload ? (JSON.parse(String(r.payload)) as QueuePayload) : {};
  } catch {
    payload = {};
  }
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
    creatorUserId: String(r.creatorUserId ?? ""),
    afterTaskId: String(r.afterTaskId ?? ""),
    urgent: Number(r.urgent) === 1,
    waitNote: String(r.waitNote ?? ""),
    payload,
  };
}

export async function enqueueTask(
  db: SqlRunner,
  t: { agentId: string; agentName: string; title: string; branch: string; createdBy: string; creatorUserId?: string; afterTaskId?: string; urgent?: boolean; payload: QueuePayload },
  now = Date.now(),
): Promise<QueuedTask> {
  const task = await createTask(db, t, now);
  await db.run(`UPDATE tasks SET after_task_id = ?, urgent = ?, payload = ? WHERE id = ?`, [
    t.afterTaskId ?? "",
    t.urgent ? 1 : 0,
    JSON.stringify(t.payload).slice(0, 16000),
    task.id,
  ]);
  return (await getQueued(db, task.id))!;
}

export async function getQueued(db: SqlRunner, id: string): Promise<QueuedTask | null> {
  const r = await db.get<QRow>(`SELECT ${Q_COLS} FROM tasks WHERE id = ?`, [id]);
  return r ? toQueued(r) : null;
}

/** La coda (di un agente o di tutti): prima gli urgenti, poi in ordine d'arrivo. */
export async function listQueue(db: SqlRunner, agentId?: string): Promise<QueuedTask[]> {
  const where = agentId ? `status = 'queued' AND agent_id = ?` : `status = 'queued'`;
  const rows = await db.all<QRow>(`SELECT ${Q_COLS} FROM tasks WHERE ${where} ORDER BY urgent DESC, created_at ASC`, agentId ? [agentId] : []);
  return rows.map(toQueued);
}

/** Toglie un task dalla coda (solo se non è ancora partito). */
export async function removeQueued(db: SqlRunner, id: string): Promise<boolean> {
  const res = await db.run(`DELETE FROM tasks WHERE id = ? AND status = 'queued'`, [id]);
  return res.changes > 0;
}

export async function setWaitNote(db: SqlRunner, id: string, note: string): Promise<void> {
  await db.run(`UPDATE tasks SET wait_note = ? WHERE id = ?`, [note.slice(0, 500), id]);
}

export type Readiness = { ready: true; after: TaskRecord | null } | { ready: false; why: "waiting" | "after-blocked" | "after-missing"; after: TaskRecord | null };

/** Il task può partire? Dipende solo dal task che aspetta. */
export async function readiness(db: SqlRunner, q: QueuedTask): Promise<Readiness> {
  if (!q.afterTaskId) return { ready: true, after: null };
  const after = await getTask(db, q.afterTaskId);
  if (!after) return { ready: false, why: "after-missing", after: null };
  if (DONE_OK.has(after.status)) return { ready: true, after };
  if (DONE_BAD.has(after.status) && after.attempts > 0) return { ready: false, why: "after-blocked", after };
  return { ready: false, why: "waiting", after };
}

/** Frase per chi guarda un task fermo in coda. */
export function waitMessage(r: Readiness, q: Pick<QueuedTask, "title">): string {
  if (r.ready) return "";
  const t = r.after ? `«${r.after.title.slice(0, 80)}»` : "atteso";
  if (r.why === "after-blocked") return `«${q.title.slice(0, 80)}» resta in attesa: il task ${t} è finito ${r.after?.status === "idle" ? "fermato" : "bloccato"}. Riprova quel task o togli l'attesa.`;
  if (r.why === "after-missing") return `«${q.title.slice(0, 80)}» aspetta un task che non esiste più: togli l'attesa o rimuovilo dalla coda.`;
  return `«${q.title.slice(0, 80)}» parte quando finisce il task ${t}.`;
}

/** Togli l'attesa: il task parte appena l'agente è libero. */
export async function clearAfter(db: SqlRunner, id: string): Promise<void> {
  await db.run(`UPDATE tasks SET after_task_id = '', wait_note = '' WHERE id = ? AND status = 'queued'`, [id]);
}

/** Task in coda che aspettano `taskId`. */
export async function dependentsOf(db: SqlRunner, taskId: string): Promise<QueuedTask[]> {
  const rows = await db.all<QRow>(`SELECT ${Q_COLS} FROM tasks WHERE status = 'queued' AND after_task_id = ?`, [taskId]);
  return rows.map(toQueued);
}

/** Il riassunto del task atteso, da passare a quello dopo. */
export async function handoffContext(db: SqlRunner, after: TaskRecord): Promise<string> {
  const events = await listEvents(db, after.id);
  const result = [...events].reverse().find((e) => e.kind === "result");
  const summary = String(result?.data?.summary ?? result?.message ?? "").trim();
  return (
    `Questo task parte dopo «${after.title}» di ${after.agentName}` +
    (after.branch ? ` (branch ${after.branch})` : "") +
    (summary ? `. Il suo riassunto:\n${summary.slice(0, 4000)}` : `. Non ha lasciato un riassunto.`)
  );
}
