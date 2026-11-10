/**
 * Salute dello stream eventi (`/api/events`). Logica pura, usata da `connectBackend`.
 *
 * Perché serve: un `EventSource` si riconnette da solo solo se la connessione cade
 * "pulita". Se il runtime risponde con un errore HTTP (es. un proxy 502 durante un
 * deploy) il browser chiude lo stream **per sempre**; e se un proxy tiene aperta la
 * connessione dopo la morte del runtime, lo stream resta muto ma "aperto". In entrambi
 * i casi la UI restava "connessa" senza ricevere più nulla (collaudo del 2026-11-10).
 */

/** Il server manda un `ping` ogni 25 s: oltre questo silenzio lo stream è morto. */
export const STREAM_STALE_MS = 60_000;

/** Ogni quanto controllare che lo stream sia vivo. */
export const STREAM_WATCHDOG_MS = 10_000;

const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 30_000;

/** Attesa prima del tentativo `attempt` (0, 1, 2…): 1 s, 2 s, 4 s… fino a 30 s. */
export function reconnectDelay(attempt: number): number {
  const n = Math.max(0, Math.floor(attempt));
  return Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** Math.min(n, 15));
}

/** Lo stream è muto da troppo tempo? */
export function isStale(lastSeen: number, now: number, staleMs: number = STREAM_STALE_MS): boolean {
  return now - lastSeen > staleMs;
}
