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

// --- Presence con nomi (secondo slice) -----------------------------------
// Il runtime ora rimbalza anche *chi* sta guardando (nomi distinti). Logica pura
// per normalizzare la lista e comporne il tooltip; il conteggio resta la fonte di
// verità del badge, i nomi arricchiscono il tooltip quando disponibili.

const MAX_NAME = 40;
const MAX_PEOPLE = 50;

/** Normalizza la lista dei nomi in arrivo: stringhe non vuote, trim + clamp, cap. */
export function sanitizePeople(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const s = v.slice(0, MAX_NAME).trim();
    if (s) out.push(s);
    if (out.length >= MAX_PEOPLE) break;
  }
  return out;
}

/**
 * Tooltip del badge presence. Con i nomi disponibili elenca chi sta guardando
 * (fino a 5, poi "e altri N"); senza nomi ricade sul messaggio basato sul
 * conteggio delle viste (`observerLabel`), così i runtime vecchi restano ok.
 */
export function presenceTooltip(people: string[], views: number): string {
  const names = sanitizePeople(people);
  if (names.length === 0) return observerLabel(views);
  if (names.length === 1) return `${names[0]} sta guardando questo ufficio`;
  const shown = names.slice(0, 5);
  const rest = names.length - shown.length;
  const list = shown.join(", ");
  return rest > 0 ? `Stanno guardando: ${list} e altri ${rest}` : `Stanno guardando: ${list}`;
}

/**
 * Testo breve per il roster (es. in cima alla chat): conta le *persone* distinte
 * quando i nomi ci sono, altrimenti ricade sul conteggio delle viste. Prima
 * persona singolare → "Solo tu stai guardando".
 */
export function watchingLabel(people: string[], views: number): string {
  const names = sanitizePeople(people);
  const n = names.length > 0 ? names.length : sanitizeObservers(views);
  return n <= 1 ? "Solo tu stai guardando" : `${n} stanno guardando`;
}
