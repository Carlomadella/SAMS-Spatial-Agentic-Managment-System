// Stato del motore AI per la barra in basso (collaudo 21/11, punto 2B).
//
// Finita la quota di OpenRouter la UI non diceva niente: il passaggio alla riserva o le
// quote finite si scoprivano solo da un task fallito. Qui si ricorda l'ultimo esito delle
// chiamate al modello: provider in uso, se è quello principale o una riserva, o se le
// quote sono finite. I provider gratuiti non dicono quanta quota resta: si mostra lo
// stato, non un numero.

export type EngineMode = "ok" | "fallback" | "exhausted";

export interface EngineState {
  /** provider che ha risposto per ultimo (o il principale, se le quote sono finite) */
  provider: string;
  mode: EngineMode;
  /** epoch ms del cambio di stato */
  since: number;
}

let state: EngineState | null = null;
const listeners = new Set<(s: EngineState) => void>();

export function engineState(): EngineState | null {
  return state;
}

/** Avvisa a ogni cambio di stato (non a ogni chiamata). Ritorna la funzione per smettere. */
export function onEngineChange(fn: (s: EngineState) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function update(provider: string, mode: EngineMode, now: number): void {
  if (state && state.provider === provider && state.mode === mode) return;
  state = { provider, mode, since: now };
  for (const fn of listeners) fn(state);
}

/** Una risposta arrivata: dal principale («ok») o da una riserva («fallback»). */
export function noteEngineSuccess(primary: string, used: string, now = Date.now()): void {
  update(used, used === primary ? "ok" : "fallback", now);
}

/** Tutti i provider hanno finito la quota. */
export function noteEngineExhausted(primary: string, now = Date.now()): void {
  update(primary, "exhausted", now);
}

/** Un errore finale del modello è una quota finita? (429 con parole da quota giornaliera) */
export function isQuotaExhausted(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /\b429\b/.test(msg) && /per-day|per day|daily|quota|RESOURCE_EXHAUSTED|credits/i.test(msg);
}

/** Solo per i test. */
export function resetEngineState(): void {
  state = null;
  listeners.clear();
}
