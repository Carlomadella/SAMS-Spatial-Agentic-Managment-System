// Task interrotti da un riavvio del server (simulazione del 23/11).
//
// Su Render il servizio si è riavviato a metà di un task di Sim-Revisore: il task è
// sparito senza traccia (niente nello storico) e /api/world mostrava ancora «done» col
// task precedente. Ora ogni task in corso sta anche in `task_runs`; all'avvio quelli
// rimasti diventano "blocked" nello storico, così il mondo e la Cronologia dicono il vero.

//
// 25/11: Render e il PC usano lo stesso database (TiDB). Ogni task in corso porta il nome
// del server che lo fa girare, e all'avvio un server chiude solo i suoi: quelli dell'altro
// restano come sono.

import { hostname } from "node:os";
import { deleteTaskRun, insertTask, listTaskRuns } from "./db";
import type { SqlRunner } from "./sql";

export const INTERRUPTED_SUMMARY =
  "Interrotto: il server si è riavviato mentre l'agente lavorava. Le modifiche già scritte sul branch restano lì; riassegna il task per riprendere.";

/**
 * Il nome di questo server, senza configurare niente: su Render "render:<servizio>"
 * (Render imposta RENDER e RENDER_SERVICE_NAME), altrimenti "pc:<nome della macchina>".
 * SAMS_SERVER_NAME lo sostituisce, se mai servisse.
 */
export function serverName(env: NodeJS.ProcessEnv = process.env, host: string = hostname()): string {
  const custom = (env.SAMS_SERVER_NAME ?? "").trim();
  if (custom) return custom;
  if (env.RENDER) return `render:${(env.RENDER_SERVICE_NAME ?? "").trim() || "servizio"}`;
  return `pc:${host}`;
}

/**
 * Segna come interrotti i task rimasti in corso su questo server. Ritorna quanti erano.
 * Le righe senza server (salvate prima del 25/11) le chiude chiunque, come prima.
 */
export async function recoverInterruptedRuns(db: SqlRunner, server: string, now = Date.now()): Promise<number> {
  const runs = (await listTaskRuns(db)).filter((r) => r.server === server || r.server === "");
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
