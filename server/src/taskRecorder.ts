// Registrazione dal vivo della storia di un task (idea 3). Ogni evento che l'agente manda
// alla UI passa anche di qui e finisce nel DB, in ordine. Best-effort: un errore del DB non
// deve mai fermare il lavoro dell'agente.

import { log } from "./log";
import type { SqlRunner } from "./sql";
import { beginAttempt, eventFromWire, insertEvent, nextSeq, setTaskStatus, takeCommentsForAttempt, type TaskEventKind } from "./tasks";
import type { WireEvent } from "./types";

export interface AttemptRecorder {
  taskId: string;
  attempt: number;
  /** commenti delle persone non ancora consegnati, pronti per il prompt ("" se nessuno) */
  comments: string;
  /** emit da passare all'agente: aggiunge l'id del task, salva e inoltra */
  wrap(emit: (e: WireEvent) => void): (e: WireEvent) => void;
  /** evento scritto dal server (fine tentativo, errori…) */
  note(kind: TaskEventKind, level: string, message: string, data?: Record<string, unknown> | null): void;
  /** aspetta che tutte le scritture siano finite (test, fine tentativo) */
  flush(): Promise<void>;
}

/** Stati dello stream che diventano lo stato del task. */
const TASK_STATUS = new Set(["working", "review", "blocked", "done", "idle", "awaiting_approval"]);

export async function startAttempt(db: SqlRunner, taskId: string, branch: string, now = Date.now()): Promise<AttemptRecorder> {
  const attempt = await beginAttempt(db, taskId, branch, now);
  const comments = await takeCommentsForAttempt(db, taskId, attempt);
  let seq = await nextSeq(db, taskId);
  let chain: Promise<void> = Promise.resolve();

  const write = (kind: TaskEventKind, level: string, message: string, data: Record<string, unknown> | null, status?: string) => {
    const ev = { seq: seq++, attempt, ts: Date.now(), kind, level, message, data };
    chain = chain
      .then(async () => {
        await insertEvent(db, taskId, ev);
        if (status && TASK_STATUS.has(status)) await setTaskStatus(db, taskId, status);
      })
      .catch((err) => log.warn("Evento del task non salvato", { task: taskId, err: String(err) }));
  };

  write("attempt", "INFO", `Tentativo ${attempt}`, comments ? { comments } : null);

  return {
    taskId,
    attempt,
    comments,
    wrap: (emit) => (e) => {
      const withId: WireEvent = { ...e, taskId };
      const rec = eventFromWire(e);
      if (rec) write(rec.kind, rec.level, rec.message, rec.data, e.status);
      else if (e.status) write("status", "INFO", e.status, null, e.status);
      emit(withId);
    },
    note: (kind, level, message, data = null) => write(kind, level, message, data),
    flush: () => chain,
  };
}
