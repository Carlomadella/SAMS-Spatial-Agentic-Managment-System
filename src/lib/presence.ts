// Presence degli osservatori — primo slice del "mondo condiviso" (Roadmap 4,
// frontiera #2), de-riscato: si appoggia solo al canale SSE già esistente.
//
// Il runtime conosce già quante viste (connessioni SSE) sono collegate; ora lo
// rimbalza a tutte con un evento `presence`. Non è ancora presence "vera" degli
// agenti in movimento — è il primo passo onesto: *quante persone stanno
// guardando lo stesso ufficio, adesso*. Logica pura e testabile qui; il conteggio
// è per-connessione (due schede della stessa persona contano due), quindi il
// testo parla di "viste".

/** Normalizza un conteggio in arrivo: intero ≥ 0 (0 = nessuna vista nota). */
export function sanitizeObservers(raw: unknown): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

/**
 * Testo per il tooltip del badge, dal punto di vista di chi guarda (che è una
 * delle viste conteggiate). `n` è il totale delle viste connesse.
 */
export function observerLabel(n: number): string {
  const total = sanitizeObservers(n);
  if (total <= 1) return "Solo tu stai guardando questo ufficio";
  const others = total - 1;
  return others === 1
    ? "Tu e un'altra vista state guardando questo ufficio, live"
    : `Tu e altre ${others} viste state guardando questo ufficio, live`;
}

/** Numero da mostrare nel badge (mai sotto 1: chi guarda conta sempre sé stesso). */
export function observerBadge(n: number): number {
  return Math.max(1, sanitizeObservers(n));
}

/** Vero quando c'è più di una vista collegata: il badge va evidenziato. */
export function isShared(n: number): boolean {
  return sanitizeObservers(n) > 1;
}
