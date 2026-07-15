// Le palette del sito (Roadmap 5) — cinque opzioni da confrontare davvero, non da
// immaginare: "SAMS" richiama i colori della workspace, le altre quattro portano il sito
// altrove. Si provano dal design lab (/design) e la scelta è persistita.
//
// **Perché i valori stanno qui e non in `index.css`**: una palette deve poter essere
// mostrata *mentre non è attiva* (gli swatch di anteprima li disegnamo con i suoi colori,
// non con quelli in uso). Se vivessero solo nel CSS non potremmo leggerli. Quindi la
// sorgente unica è questo file e il CSS lo **generiamo** (`paletteCss`): così chiaro/scuro
// resta gestito dal CSS come sempre — nessun observer sul tema — e i valori restano uno.
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
  /** Accento primario: CTA, focus, link. */
  accent: string;
  /** Accento secondario: logo e bagliori della hero. */
  "accent-2": string;
}

export interface Palette {
  id: string;
  name: string;
  /** Una riga sul carattere della palette, mostrata nel design lab. */
  blurb: string;
  dark: PaletteTokens;
  light: PaletteTokens;
}

export const PALETTES: Palette[] = [
  {
    id: "ambra",
    name: "Ambra / Tramonto",
    blurb: "Caldo e accogliente, come la luce delle lampade nella stanza. La palette attuale del sito.",
    dark: {
      "ink-950": "20 15 10",
      "ink-900": "26 20 14",
      "ink-850": "33 26 18",
      "ink-800": "41 32 22",
      "ink-700": "54 43 30",
      "ink-600": "71 57 40",
      "ink-500": "92 75 54",
      line: "58 46 32",
      mut: "168 156 140",
      text: "245 236 224",
      "text-strong": "255 250 244",
      accent: "245 158 11",
      "accent-2": "251 113 133",
    },
    light: {
      "ink-950": "250 246 240",
      "ink-900": "255 253 249",
      "ink-850": "244 238 230",
      "ink-800": "236 229 219",
      "ink-700": "226 217 205",
      "ink-600": "210 199 184",
      "ink-500": "188 175 158",
      line: "224 214 200",
      mut: "122 108 90",
      text: "41 32 22",
      "text-strong": "26 20 14",
      accent: "194 120 8",
      "accent-2": "225 90 110",
    },
  },
  {
    id: "sams",
    name: "SAMS / Workspace",
    blurb: "Gli stessi blu della stanza: il sito e l'app diventano un pezzo unico, senza stacco all'ingresso.",
    dark: {
      "ink-950": "10 12 18",
      "ink-900": "13 16 23",
      "ink-850": "17 21 31",
      "ink-800": "21 26 38",
      "ink-700": "27 34 48",
      "ink-600": "35 44 61",
      "ink-500": "46 57 80",
      line: "34 43 61",
      mut: "138 147 166",
      text: "226 232 240",
      "text-strong": "255 255 255",
      accent: "79 140 255",
      "accent-2": "139 122 255",
    },
    light: {
      "ink-950": "240 243 248",
      "ink-900": "255 255 255",
      "ink-850": "238 241 246",
      "ink-800": "230 234 241",
      "ink-700": "219 225 235",
      "ink-600": "203 211 224",
      "ink-500": "180 190 208",
      line: "214 221 231",
      mut: "90 100 119",
      text: "27 34 48",
      "text-strong": "11 14 20",
      accent: "47 108 233",
      "accent-2": "104 84 235",
    },
  },
  {
    id: "foresta",
    name: "Foresta / Terminale",
    blurb: "Verde su nero profondo, aria da terminale. Fa sembrare il sito uno strumento più che una vetrina.",
    dark: {
      "ink-950": "8 15 12",
      "ink-900": "11 20 16",
      "ink-850": "15 26 21",
      "ink-800": "19 33 26",
      "ink-700": "26 44 35",
      "ink-600": "35 58 46",
      "ink-500": "48 77 62",
      line: "30 50 40",
      mut: "134 158 146",
      text: "224 240 232",
      "text-strong": "246 255 250",
      accent: "16 185 129",
      "accent-2": "163 230 53",
    },
    light: {
      "ink-950": "241 248 244",
      "ink-900": "252 255 253",
      "ink-850": "234 244 238",
      "ink-800": "225 238 231",
      "ink-700": "212 229 220",
      "ink-600": "195 216 205",
      "ink-500": "170 197 184",
      line: "213 230 221",
      mut: "82 105 94",
      text: "19 33 26",
      "text-strong": "8 20 15",
      accent: "4 133 90",
      "accent-2": "77 134 12",
    },
  },
  {
    id: "nebulosa",
    name: "Nebulosa / Viola",
    blurb: "Viola e fucsia: la lettura più «prodotto AI» delle cinque, la più lontana dal look attuale.",
    dark: {
      "ink-950": "14 11 22",
      "ink-900": "19 15 30",
      "ink-850": "25 19 39",
      "ink-800": "32 24 49",
      "ink-700": "43 33 65",
      "ink-600": "57 44 85",
      "ink-500": "76 59 112",
      line: "47 36 71",
      mut: "154 145 178",
      text: "234 230 246",
      "text-strong": "252 250 255",
      accent: "139 92 246",
      "accent-2": "232 121 249",
    },
    light: {
      "ink-950": "246 244 251",
      "ink-900": "255 254 255",
      "ink-850": "240 236 249",
      "ink-800": "232 227 245",
      "ink-700": "222 215 240",
      "ink-600": "206 197 231",
      "ink-500": "184 172 216",
      line: "225 218 241",
      mut: "104 94 128",
      text: "32 24 49",
      "text-strong": "19 15 30",
      accent: "109 60 220",
      "accent-2": "180 60 200",
    },
  },
  {
    id: "abisso",
    name: "Abisso / Ciano",
    blurb: "Teal freddo e ciano elettrico: minimale e tecnico, il contrasto più netto sul chiaro.",
    dark: {
      "ink-950": "8 14 18",
      "ink-900": "11 19 24",
      "ink-850": "14 25 32",
      "ink-800": "18 32 41",
      "ink-700": "25 43 54",
      "ink-600": "33 57 72",
      "ink-500": "45 76 95",
      line: "28 48 60",
      mut: "132 154 168",
      text: "224 238 246",
      "text-strong": "246 253 255",
      accent: "6 182 212",
      "accent-2": "45 212 191",
    },
    light: {
      "ink-950": "240 247 250",
      "ink-900": "253 255 255",
      "ink-850": "232 242 247",
      "ink-800": "223 236 242",
      "ink-700": "210 227 235",
      "ink-600": "192 214 224",
      "ink-500": "167 195 208",
      line: "211 229 237",
      mut: "80 102 116",
      text: "18 32 41",
      "text-strong": "8 19 24",
      // Teal appena più profondo del naturale (era 8 132 156): a quel valore né bianco né
      // nero raggiungevano 4.5:1 sul bottone primario — l'unico accento delle cinque
      // palette a cadere in quella terra di nessuno. Così il bianco arriva a 4.87:1.
      accent: "7 124 147",
      "accent-2": "13 148 136",
    },
  },
];

/** La palette usata se non è stata fatta nessuna scelta (il look attuale del sito). */
export const DEFAULT_PALETTE_ID = "ambra";

/** Cerca una palette per id; ricade sul default per un id sconosciuto (o assente). */
export function paletteById(id: string | null | undefined): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES.find((p) => p.id === DEFAULT_PALETTE_ID)!;
}

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

const WHITE = "255 255 255";
const NEAR_BLACK = "11 14 20";

/**
 * Il colore del testo **sopra** all'accento (bottoni primari), scelto per contrasto invece
 * che fissato. Con cinque accenti diversi × due temi un colore unico non può funzionare:
 * il bianco su ambra brillante dà 2.15:1 (illeggibile), il nero 8.99:1.
 *
 * Preferiamo il bianco quando basta da solo (≥ 4.5:1, la soglia WCAG AA per testo normale)
 * perché su fondo colorato è la convenzione; altrimenti vince chi contrasta di più. Così
 * ogni palette resta leggibile senza doversi ricordare di scriverlo a mano.
 */
export function onAccent(accent: string): string {
  if (contrastRatio(WHITE, accent) >= 4.5) return WHITE;
  return contrastRatio(WHITE, accent) >= contrastRatio(NEAR_BLACK, accent) ? WHITE : NEAR_BLACK;
}

/**
 * I token come dichiarazioni CSS: `--c-ink-950: 20 15 10; …`, più `--c-on-accent`
 * **derivato** dall'accento (vedi `onAccent`) — non è un valore da mantenere a mano.
 */
export function paletteVars(tokens: PaletteTokens): string {
  const vars = Object.entries(tokens).map(([k, v]) => `--c-${k}: ${v};`);
  vars.push(`--c-on-accent: ${onAccent(tokens.accent)};`);
  return vars.join(" ");
}

/**
 * Le regole CSS complete della palette, per entrambi i temi. Rispecchia i selettori di
 * `index.css` (`body.site-scroll` e `.theme-light body.site-scroll`): stessa specificità,
 * ma iniettate dopo → vincono. Il tema resta gestito dal CSS, senza JS che lo insegua.
 */
export function paletteCss(p: Palette): string {
  return [
    `body.site-scroll { ${paletteVars(p.dark)} }`,
    `.theme-light body.site-scroll { ${paletteVars(p.light)} }`,
  ].join("\n");
}

/** I colori d'anteprima di una palette (per gli swatch), in `rgb()` pronto all'uso. */
export function paletteSwatch(p: Palette, mode: "dark" | "light" = "dark"): string[] {
  const t = mode === "dark" ? p.dark : p.light;
  return [t["ink-900"], t["ink-700"], t.accent, t["accent-2"], t.text].map((v) => `rgb(${v})`);
}
