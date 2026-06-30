// Eventi stagionali del Commit Garden: ricorrenze datate che accendono una
// decorazione festiva nella scena 3D (particelle colorate) e un badge nel
// pannello del giardino. Logica pura e testabile: dato un giorno dell'anno,
// restituisce l'evento attivo (o null). I range sono pensati per non
// sovrapporsi mai.

export interface SeasonalEvent {
  id: string;
  /** Nome mostrato nel badge (italiano). */
  name: string;
  emoji: string;
  /** Colore accento (hex) per le particelle festive in scena. */
  accent: string;
  /** Frase breve mostrata nel pannello giardino. */
  blurb: string;
}

const CAPODANNO: SeasonalEvent = {
  id: "capodanno",
  name: "Capodanno",
  emoji: "🎆",
  accent: "#ffd34d",
  blurb: "Fuochi d'artificio sul prato: buon anno!",
};

const SAN_VALENTINO: SeasonalEvent = {
  id: "san-valentino",
  name: "San Valentino",
  emoji: "💗",
  accent: "#ff7eb6",
  blurb: "Cuori fluttuanti sopra la tua pianta.",
};

const FIORITURA: SeasonalEvent = {
  id: "fioritura",
  name: "Fioritura di primavera",
  emoji: "🌸",
  accent: "#ff9ec4",
  blurb: "L'equinozio risveglia i petali del giardino.",
};

const SOLSTIZIO: SeasonalEvent = {
  id: "solstizio",
  name: "Solstizio d'estate",
  emoji: "☀️",
  accent: "#ffd166",
  blurb: "Il giorno più lungo: luce dorata sul prato.",
};

const HALLOWEEN: SeasonalEvent = {
  id: "halloween",
  name: "Halloween",
  emoji: "🎃",
  accent: "#ff8c2b",
  blurb: "Zucche e lanterne tra le foglie d'autunno.",
};

const NATALE: SeasonalEvent = {
  id: "natale",
  name: "Natale",
  emoji: "🎄",
  accent: "#ff5c5c",
  blurb: "Lucine festive sull'albero del giardino.",
};

/**
 * Restituisce l'evento stagionale attivo nella data indicata, o `null` se
 * nessuna ricorrenza è in corso. I range sono mutuamente esclusivi.
 */
export function getSeasonalEvent(date: Date = new Date()): SeasonalEvent | null {
  const m = date.getMonth() + 1; // 1-12
  const d = date.getDate(); // 1-31
  const on = (mm: number, dd1: number, dd2 = dd1) => m === mm && d >= dd1 && d <= dd2;

  if (on(1, 1) || on(12, 31)) return CAPODANNO;
  if (on(2, 14)) return SAN_VALENTINO;
  if (on(3, 20, 22)) return FIORITURA;
  if (on(6, 20, 22)) return SOLSTIZIO;
  if (on(10, 29, 31)) return HALLOWEEN;
  if (on(12, 20, 26)) return NATALE;
  return null;
}
