// La sessione continua tra un tentativo e l'altro (idea 5 da Paperclip, scelta B del 25/11/2026).
//
// Dopo ogni passo dell'agente si salva un "punto di lavoro" compatto: piano, passi fatti,
// file letti (nome + breve estratto), file scritti, ultimo problema. Quando lo stesso task
// viene riassegnato, il tentativo dopo parte con quel riassunto nel primo messaggio
// ("hai già fatto questo, riprendi da qui") invece di rileggere tutto da zero.
// Scelte dell'utente: vale 24 ore; la ripresa è automatica ma si spegne in ⚙.
// Funziona con tutti i provider perché non salva la conversazione, solo il riassunto.

import type { SqlDriver, SqlRunner } from "./sql";

export const CHECKPOINT_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_STEPS = 40;
const MAX_READS = 30;
const MAX_WRITES = 40;
const EXCERPT = 240;

export interface Checkpoint {
  plan: string[];
  steps: Array<{ tool: string; target: string; ok: boolean }>;
  /** file letti: percorso → breve estratto */
  filesRead: Record<string, string>;
  filesWritten: string[];
  lastProblem: string;
  attempt: number;
  updatedAt: number;
  /** con quale GitHub e su quale repo è stato fatto il lavoro: si riprende solo con gli stessi
   *  (gli estratti dei file non devono passare a chi lavora su un'altra repo o un altro GitHub) */
  scope?: string;
}

/** Chiave "chi e dove" di un tentativo: tipo di GitHub, login e repo. */
export function workScope(github: "user" | "server", login: string, repo: string): string {
  return `${github}:${login.toLowerCase()}:${repo.toLowerCase()}`;
}

export function emptyCheckpoint(attempt: number): Checkpoint {
  return { plan: [], steps: [], filesRead: {}, filesWritten: [], lastProblem: "", attempt, updatedAt: 0 };
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Su cosa ha lavorato uno strumento (per il riassunto). */
function targetOf(args: Record<string, unknown>): string {
  if (Array.isArray(args.paths)) return args.paths.map(String).slice(0, 5).join(", ");
  if (Array.isArray(args.files)) return (args.files as Array<{ path?: unknown }>).map((f) => str(f?.path)).filter(Boolean).slice(0, 5).join(", ");
  return clip(str(args.path) || str(args.url) || str(args.workflow) || str(args.title) || (args.pr_number != null ? `PR #${String(args.pr_number)}` : "") || str(args.key), 120);
}

const isError = (result: string) => /^\s*(ERRORE|Errore|Error)\b/.test(result);

/**
 * Aggiorna il punto di lavoro dopo uno strumento. Pura: ritorna un oggetto nuovo.
 * Gli strumenti interni di chiusura (done) non contano come passo.
 */
export function applyStep(cp: Checkpoint, tool: string, args: Record<string, unknown>, result: string, now = Date.now()): Checkpoint {
  const next: Checkpoint = { ...cp, steps: [...cp.steps], filesRead: { ...cp.filesRead }, filesWritten: [...cp.filesWritten], updatedAt: now };
  if (tool === "announce_plan" && Array.isArray(args.steps)) {
    next.plan = args.steps.map(String).slice(0, 12);
    return next;
  }
  if (tool === "done") return next;
  const ok = !isError(result);
  next.steps.push({ tool, target: targetOf(args), ok });
  if (next.steps.length > MAX_STEPS) next.steps = next.steps.slice(-MAX_STEPS);
  if (!ok) next.lastProblem = clip(`${tool} ${targetOf(args)}: ${result.trim()}`, 400);

  if (ok && tool === "gh_read_file" && str(args.path)) {
    next.filesRead[str(args.path)] = clip(result.replace(/\s+/g, " ").trim(), EXCERPT);
  }
  if (ok && tool === "gh_read_files" && Array.isArray(args.paths)) {
    for (const p of args.paths.map(String)) next.filesRead[p] ??= "(letto insieme ad altri file)";
  }
  const reads = Object.keys(next.filesRead);
  if (reads.length > MAX_READS) for (const k of reads.slice(0, reads.length - MAX_READS)) delete next.filesRead[k];

  if (ok && (tool === "gh_write_file" || tool === "gh_write_files")) {
    const paths = tool === "gh_write_file" ? [str(args.path)] : (Array.isArray(args.files) ? (args.files as Array<{ path?: unknown }>).map((f) => str(f?.path)) : []);
    for (const p of paths.filter(Boolean)) if (!next.filesWritten.includes(p)) next.filesWritten.push(p);
    if (next.filesWritten.length > MAX_WRITES) next.filesWritten = next.filesWritten.slice(-MAX_WRITES);
  }
  return next;
}

/** Il punto di lavoro vale ancora? (24 ore, stesso GitHub e stessa repo, e qualcosa dentro) */
export function isUsable(cp: Checkpoint | null, scope: string, now = Date.now(), ttlMs = CHECKPOINT_TTL_MS): cp is Checkpoint {
  if (!cp || !cp.updatedAt) return false;
  if (!cp.scope || cp.scope !== scope) return false;
  if (now - cp.updatedAt > ttlMs) return false;
  return cp.plan.length > 0 || cp.steps.length > 0;
}

/** Il riassunto da mettere nel primo messaggio del tentativo dopo. */
export function checkpointPrompt(cp: Checkpoint): string {
  const lines: string[] = [
    `RIPRESA: questo task è già stato iniziato (tentativo ${cp.attempt}) e si è fermato. Hai già fatto il lavoro qui sotto: non ripeterlo, riprendi da dove eri rimasto. Rileggi un file solo se ti serve un dettaglio che qui non c'è.`,
  ];
  if (cp.plan.length) lines.push(`Il tuo piano:\n${cp.plan.map((p, i) => `${i + 1}. ${p}`).join("\n")}`);
  if (cp.steps.length) {
    lines.push(`Passi già fatti (${cp.steps.length}, dal più vecchio):\n${cp.steps.map((s) => `- ${s.tool}${s.target ? ` ${s.target}` : ""}${s.ok ? "" : " (fallito)"}`).join("\n")}`);
  }
  const reads = Object.entries(cp.filesRead);
  if (reads.length) lines.push(`File già letti (con un breve estratto):\n${reads.map(([p, e]) => `- ${p}: ${e}`).join("\n")}`);
  if (cp.filesWritten.length) lines.push(`File già scritti sul branch del task: ${cp.filesWritten.join(", ")}`);
  if (cp.lastProblem) lines.push(`Ultimo problema incontrato: ${cp.lastProblem}`);
  return lines.join("\n\n");
}

// --- database --------------------------------------------------------------------------

const SQLITE_DDL = `
  CREATE TABLE IF NOT EXISTS task_checkpoints (
    task_id    TEXT    PRIMARY KEY,
    data       TEXT    NOT NULL,
    updated_at INTEGER NOT NULL
  );
`;
const MYSQL_DDL = `
  CREATE TABLE IF NOT EXISTS task_checkpoints (
    task_id    VARCHAR(64) NOT NULL PRIMARY KEY,
    data       TEXT        NOT NULL,
    updated_at BIGINT      NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
`;

export async function ensureCheckpointTables(db: SqlDriver): Promise<void> {
  await db.exec(db.dialect === "mysql" ? MYSQL_DDL : SQLITE_DDL);
}

export async function saveCheckpoint(db: SqlRunner, taskId: string, cp: Checkpoint): Promise<void> {
  const upd =
    db.dialect === "mysql"
      ? `ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = VALUES(updated_at)`
      : `ON CONFLICT (task_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`;
  await db.run(`INSERT INTO task_checkpoints (task_id, data, updated_at) VALUES (?, ?, ?) ${upd}`, [taskId, JSON.stringify(cp).slice(0, 60000), cp.updatedAt]);
}

export async function loadCheckpoint(db: SqlRunner, taskId: string): Promise<Checkpoint | null> {
  const r = await db.get<{ data: string }>(`SELECT data FROM task_checkpoints WHERE task_id = ?`, [taskId]);
  if (!r) return null;
  try {
    return JSON.parse(String(r.data)) as Checkpoint;
  } catch {
    return null;
  }
}

/** Via i punti di lavoro scaduti (e quelli dei task cancellati). */
export async function pruneCheckpoints(db: SqlRunner, now = Date.now(), ttlMs = CHECKPOINT_TTL_MS): Promise<number> {
  const res = await db.run(`DELETE FROM task_checkpoints WHERE updated_at < ? OR task_id NOT IN (SELECT id FROM tasks)`, [now - ttlMs]);
  return res.changes;
}
