// Task in corso, per agente (simulazione del 21/11: il server accettava un secondo task
// per un agente già al lavoro e le due esecuzioni si sovrascrivevano i file a vicenda;
// e non c'era modo di fermarne una). Un agente fa un task alla volta, e un task si può
// annullare: il ciclo dell'agente se ne accorge al prossimo strumento che chiama.

/** Oltre questo tempo un task "in corso" si considera perso (processo morto a metà). */
export const RUN_STALE_MS = 60 * 60 * 1000;

interface Run {
  title: string;
  startedAt: number;
  cancelledBy: string | null;
}

const runs = new Map<string, Run>();

/** Lanciato dentro il ciclo dell'agente quando qualcuno ha annullato il task. */
export class TaskCancelledError extends Error {
  constructor(readonly by: string) {
    super(`Task annullato da ${by}`);
    this.name = "TaskCancelledError";
  }
}

function live(agentId: string, now: number): Run | null {
  const r = runs.get(agentId);
  if (!r) return null;
  if (now - r.startedAt > RUN_STALE_MS) {
    runs.delete(agentId);
    return null;
  }
  return r;
}

/** Il task in corso per l'agente, o null. */
export function currentRun(agentId: string, now = Date.now()): { title: string; startedAt: number } | null {
  const r = live(agentId, now);
  return r ? { title: r.title, startedAt: r.startedAt } : null;
}

/** Registra l'inizio di un task. false se l'agente ne ha già uno in corso. */
export function beginRun(agentId: string, title: string, now = Date.now()): boolean {
  if (live(agentId, now)) return false;
  runs.set(agentId, { title, startedAt: now, cancelledBy: null });
  return true;
}

/** Quanti task sono in corso adesso (per tenere sveglio il servizio, vedi keepAwake.ts). */
export function runningCount(now = Date.now()): number {
  let n = 0;
  for (const id of [...runs.keys()]) if (live(id, now)) n++;
  return n;
}

/** Il task è finito (bene, male o annullato): l'agente è di nuovo libero. */
export function endRun(agentId: string): void {
  runs.delete(agentId);
}

/** Chiede di fermare il task in corso. false se l'agente non ne ha. */
export function requestCancel(agentId: string, by: string, now = Date.now()): boolean {
  const r = live(agentId, now);
  if (!r) return false;
  r.cancelledBy = by || "un utente";
  return true;
}

/** Nel ciclo dell'agente: se il task è stato annullato, interrompe tutto. */
export function throwIfCancelled(agentId: string): void {
  const r = runs.get(agentId);
  if (r?.cancelledBy) throw new TaskCancelledError(r.cancelledBy);
}

/** Solo per i test. */
export function resetRuns(): void {
  runs.clear();
}
