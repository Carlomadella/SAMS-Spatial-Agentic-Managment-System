// Task interrotti da un riavvio del server (simulazione del 23/11).
//
// Su Render il servizio si è riavviato a metà di un task di Sim-Revisore: il task è
// sparito senza traccia (niente nello storico) e /api/world mostrava ancora «done» col
// task precedente. Ora ogni task in corso sta anche in `task_runs`; all'avvio quelli
// rimasti diventano "blocked" nello storico, così il mondo e la Cronologia dicono il vero.

import { deleteTaskRun, insertTask, listTaskRuns } from "./db";
import type { SqlRunner } from "./sql";

export const INTERRUPTED_SUMMARY =
  "Interrotto: il server si è riavviato mentre l'agente lavorava. Le modifiche già scritte sul branch restano lì; riassegna il task per riprendere.";

/** Segna come interrotti i task rimasti in corso. Ritorna quanti erano. */
export async function recoverInterruptedRuns(db: SqlRunner, now = Date.now()): Promise<number> {
  const runs = await listTaskRuns(db);
  for (const r of runs) {
    await insertTask(db, {
      agentId: r.agentId,
      agentName: r.agentName,
      title: r.title,
      branch: r.branch,
      status: "blocked",
      tokens: 0,
      ts: now,
      summary: INTERRUPTED_SUMMARY,
    });
    await deleteTaskRun(db, r.agentId);
  }
  return runs.length;
}
