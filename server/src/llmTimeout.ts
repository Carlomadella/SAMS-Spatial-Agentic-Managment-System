// Timeout delle chiamate ai modelli e messaggi di riprova.
//
// Collaudo 2026-11-17: con 60 s fissi un modello gratuito grande (Nemotron 550B su
// OpenRouter) non faceva in tempo a generare un documento lungo; la richiesta veniva
// interrotta, ripetuta identica e interrotta di nuovo, mentre il log diceva "occupato".

/** Tempo massimo di attesa di una singola risposta del modello. */
export const DEFAULT_LLM_TIMEOUT_MS = 180_000;
const MIN_LLM_TIMEOUT_MS = 1_000;

/** Timeout per chiamata, regolabile con `SAMS_LLM_TIMEOUT_MS` (ms). */
export function llmTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number(env.SAMS_LLM_TIMEOUT_MS);
  return Number.isInteger(n) && n >= MIN_LLM_TIMEOUT_MS ? n : DEFAULT_LLM_TIMEOUT_MS;
}

/** Perché si riprova: rete giù, provider occupato (429/5xx) o nessuna risposta in tempo. */
export type RetryReason = "network" | "busy" | "timeout";

export function retryMessage(provider: string, reason: RetryReason, attempt: number, waitMs: number, timeoutMs: number): string {
  const wait = `riprovo (${attempt}) tra ${Math.round(waitMs / 1000)}s…`;
  if (reason === "timeout") return `${provider}: nessuna risposta in ${Math.round(timeoutMs / 1000)} s, ${wait}`;
  if (reason === "network") return `${provider}: errore di rete, ${wait}`;
  return `${provider} occupato, ${wait}`;
}
