// Meteo stagionale della casa: dato un giorno dell'anno, restituisce la stagione
// meteorologica (emisfero nord) con il tipo di precipitazione e una tinta di luce
// da applicare *in modo sottile* al ciclo giorno/notte della scena 3D. Logica
// pura e testabile — nessuna dipendenza da three o React — così la scena si limita
// a *consumare* il risultato. Complementare a `seasonalEvents.ts`, che accende
// decorazioni festive datate nel Commit Garden: qui si tratta dell'atmosfera
// continua dell'ufficio, non di una ricorrenza puntuale.

export type Season = "winter" | "spring" | "summer" | "autumn";

/** Cosa cade oltre le finestre. `none` = cielo sereno (nessuna particella). */
export type Precipitation = "snow" | "rain" | "petals" | "none";

export interface Weather {
  season: Season;
  /** Nome della stagione in italiano (per badge/tooltip). */
  seasonName: string;
  emoji: string;
  precipitation: Precipitation;
  /** Colore (hex) delle particelle di precipitazione oltre i vetri. */
  particleColor: string;
  /** Tinta (hex) verso cui inclinare *leggermente* la luce diurna. */
  tint: string;
  /**
   * Quanto inclinare la luce diurna verso `tint`, in [0..1]. Volutamente basso:
   * è un velo d'atmosfera, non un cambio di palette. La scena moltiplica ancora
   * questo valore per la "diurnità" corrente, così di notte la tinta svanisce.
   */
  tintStrength: number;
  /** Frase breve per un eventuale badge/tooltip. */
  blurb: string;
}

const WINTER: Weather = {
  season: "winter",
  seasonName: "Inverno",
  emoji: "❄️",
  precipitation: "snow",
  particleColor: "#eaf2ff",
  tint: "#dfe8f5",
  tintStrength: 0.18,
  blurb: "Fiocchi di neve oltre le finestre.",
};

const SPRING: Weather = {
  season: "spring",
  seasonName: "Primavera",
  emoji: "🌸",
  precipitation: "petals",
  particleColor: "#ffc7dd",
  tint: "#eef7e0",
  tintStrength: 0.1,
  blurb: "Petali nell'aria: la stanza profuma di primavera.",
};

const SUMMER: Weather = {
  season: "summer",
  seasonName: "Estate",
  emoji: "☀️",
  precipitation: "none",
  particleColor: "#fff3c4",
  tint: "#fff2d6",
  tintStrength: 0.12,
  blurb: "Luce dorata d'estate sui pavimenti.",
};

const AUTUMN: Weather = {
  season: "autumn",
  seasonName: "Autunno",
  emoji: "🍂",
  precipitation: "rain",
  particleColor: "#9db4c8",
  tint: "#f3e2cf",
  tintStrength: 0.16,
  blurb: "Pioggia leggera sui vetri.",
};

/**
 * Stagione meteorologica (emisfero nord) dal mese: inverno = dic-gen-feb,
 * primavera = mar-apr-mag, estate = giu-lug-ago, autunno = set-ott-nov.
 */
export function seasonOf(date: Date = new Date()): Season {
  const m = date.getMonth() + 1; // 1-12
  if (m === 12 || m === 1 || m === 2) return "winter";
  if (m >= 3 && m <= 5) return "spring";
  if (m >= 6 && m <= 8) return "summer";
  return "autumn";
}

const BY_SEASON: Record<Season, Weather> = {
  winter: WINTER,
  spring: SPRING,
  summer: SUMMER,
  autumn: AUTUMN,
};

/** Meteo stagionale attivo nella data indicata (default: adesso). */
export function getWeather(date: Date = new Date()): Weather {
  return BY_SEASON[seasonOf(date)];
}
