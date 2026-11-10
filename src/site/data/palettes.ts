// La palette di SAMS: **Rossonero**, i colori dello stemma del Milan (decisione D2 della 1.0).
// Vale per tutto il progetto, sito e workspace: rosso, nero e bianco, e nient'altro.
//
// I valori veri stanno in `index.css` (`:root` e `.theme-light`), che è ciò che il browser
// legge. Questo file ne tiene una copia in TS per due motivi: i test verificano che le due
// non divergano, e che il testo sopra al rosso resti leggibile (contrasto WCAG AA).
//
// Formato dei token: "R G B" senza `rgb()`, come in `index.css`, perché Tailwind li
// compone con l'alpha (`rgb(var(--c-ink-900) / <alpha-value>)`).

export interface PaletteTokens {
  "ink-950": string;
  "ink-900": string;
  "ink-850": string;
  "ink-800": string;
  "ink-700": string;
  "ink-600": string;
  "ink-500": string;
  line: string;
  mut: string;
  text: string;
  "text-strong": string;
  /** Accento primario (il rosso): CTA, focus, link. */
  accent: string;
  /** Secondo colore dello stemma: il bianco sul nero, il nero sul bianco. */
  "accent-2": string;
  /** Rosso per testo e icone piccole sul fondo: pieno, non rosa. */
  "accent-soft": string;
}

export interface Palette {
  dark: PaletteTokens;
  light: PaletteTokens;
}

export const ROSSONERO: Palette = {
  dark: {
    // neri neutri, senza dominanti: nessun grigio deve virare al blu o al marrone
    "ink-950": "0 0 0",
    "ink-900": "8 8 8",
    "ink-850": "14 14 14",
    "ink-800": "20 20 20",
    "ink-700": "31 31 31",
    "ink-600": "46 46 46",
    "ink-500": "66 66 66",
    line: "38 38 38",
    mut: "163 163 163",
    text: "245 245 245",
    "text-strong": "255 255 255",
    // il rosso dello stemma: col bianco sopra fa 4.9:1 (AA)
    accent: "227 6 19",
    "accent-2": "255 255 255",
    // sul nero il rosso pieno scende a 4:1: per il testo piccolo si schiarisce un poco,
    // restando rosso (G e B bassi) — il vecchio 255 128 128 era rosa
    "accent-soft": "255 51 51",
  },
  light: {
    "ink-950": "245 245 245",
    "ink-900": "255 255 255",
    "ink-850": "240 240 240",
    "ink-800": "232 232 232",
    "ink-700": "220 220 220",
    "ink-600": "204 204 204",
    "ink-500": "180 180 180",
    line: "224 224 224",
    mut: "96 96 96",
    text: "15 15 15",
    "text-strong": "0 0 0",
    // sul bianco il rosso si scurisce un poco, e il secondo colore diventa il nero
    accent: "190 10 25",
    "accent-2": "0 0 0",
    "accent-soft": "170 8 20",
  },
};

/** Luminanza relativa (WCAG 2.1) di una terna "R G B". */
export function luminance(token: string): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = token.split(" ").map(Number);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Rapporto di contrasto WCAG fra due terne "R G B" (1 = identici, 21 = nero/bianco). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
