// Riconciliazione deterministica client↔server — Roadmap 4, frontiera #1.
//
// Lo stato autorevole vive sul server (`world_snapshot`, versione monotona). Con
// più viste che scrivono, il client deve capire se è **indietro** rispetto alla
// verità del server (qualcun altro ha scritto) e conciliare, invece di sovrascrivere
// alla cieca. Qui vive solo la decisione pura e deterministica; il canale HTTP e
// l'applicazione allo store stanno in `backend.ts`/`App.tsx`.
//
// Il server garantisce la versione con un compare-and-swap (vedi `isFreshWrite` in
// `worldState.ts`): una POST con `baseVersion` obsoleta riceve 409 + lo snapshot
// corrente. Questo modulo decide cosa fare con quelle versioni.

export type SyncDirection = "in-sync" | "behind" | "ahead";

/**
 * Confronta la versione base che il client conosce con quella autorevole del server.
 * - `behind`  → il server è avanti: un altro scrittore ha aggiornato; adotta la remota.
 * - `ahead`   → il client ha una base più alta del server (raro: reset del server);
 *               riallinea comunque alla remota per non divergere.
 * - `in-sync` → nulla da fare.
 */
export function compareVersion(localBase: number, remoteVersion: number): SyncDirection {
  if (remoteVersion > localBase) return "behind";
  if (remoteVersion < localBase) return "ahead";
  return "in-sync";
}

/**
 * Prossima `baseVersion` da tenere dopo un esito di push:
 * - 200 → il server ha salvato e restituito la sua nuova versione;
 * - 409 → conflitto, il server ha restituito la versione corrente (più alta).
 * In entrambi i casi ci si allinea alla versione più recente vista, così la POST
 * successiva è CAS-fresca. Mai indietreggiare (monotòna).
 */
export function nextBase(prevBase: number, serverVersion: number): number {
  return Math.max(prevBase, serverVersion);
}
