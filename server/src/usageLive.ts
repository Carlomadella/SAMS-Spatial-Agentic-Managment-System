import { db } from "./db";
import { log } from "./log";
import { recordRequest, recordTaskEnd } from "./usage";

// Conteggio dal vivo (idea 1): best-effort, non deve mai far fallire un task.

/** Una chiamata al modello per `agentId`, servita da `provider` (openrouter, gemini…). */
export function noteRequest(agentId: string, provider: string, tokens: number): void {
  safely(() => recordRequest(db(), agentId, provider, tokens), "Conteggio richieste non salvato");
}

/** Un task dell'agente è finito (per la media di richieste per task). */
export function noteTaskEnd(agentId: string): void {
  safely(() => recordTaskEnd(db(), agentId), "Fine task non contata");
}

/** `db()` lancia se il DB non è aperto (es. nei test dei provider): anche quello va ingoiato. */
function safely(fn: () => Promise<void>, what: string): void {
  try {
    void fn().catch((err) => log.warn(what, { err: String(err) }));
  } catch (err) {
    log.warn(what, { err: String(err) });
  }
}
