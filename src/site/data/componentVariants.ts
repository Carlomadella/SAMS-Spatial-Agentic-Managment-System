// Varianti dei componenti condivisi (Roadmap 5) — il seguito di palette/navbar/hero, per i
// pezzi che restavano a una sola versione: Logo, CTAButton, Footer, SectionHeading,
// Container, ThemeToggle.
//
// Stesso principio del resto del lab: **una variante è un dato, non una copia del
// componente**. Ogni componente resta uno solo e legge la propria scelta; sei copie del
// markup divergerebbero al primo ritocco, e la domanda qui è "quale forma", non "quale
// implementazione".
//
// `SiteLayout` e `AuthContext/ProtectedRoute` non compaiono di proposito: il primo è la
// somma di Navbar/Footer/Container (variarlo significa variare quelli), i secondi sono
// logica di sessione — non hanno un aspetto da scegliere.

/** Una scelta possibile per un componente. */
export interface Choice {
  id: string;
  name: string;
  blurb: string;
}

/** Le chiavi delle scelte di design, tutte persistite in localStorage. */
export type DesignKey =
  | "palette"
  | "navbar"
  | "hero"
  | "logo"
  | "button"
  | "footer"
  | "heading"
  | "container"
  | "themeToggle";

// ── Logo ──────────────────────────────────────────────────────────────────
export const LOGO_VARIANTS: Choice[] = [
  {
    id: "orbitale",
    name: "Orbitale",
    blurb: "Un nucleo con gli agenti in orbita, che pulsa piano: racconta lo spazio condiviso. Il logo del sito.",
  },
  {
    id: "monogramma",
    name: "Monogramma",
    blurb: "Una «S» in un quadrato con angoli morbidi: più severo e più riconoscibile in piccolo, ma non dice nulla del prodotto.",
  },
  {
    id: "punto",
    name: "Punto",
    blurb: "Solo un punto pieno accanto al nome. Il minimo: lascia tutto il peso alla parola SAMS.",
  },
];

// ── CTAButton (forma) ─────────────────────────────────────────────────────
export const BUTTON_VARIANTS: Choice[] = [
  { id: "arrotondato", name: "Arrotondato", blurb: "Angoli morbidi (8px), come il resto dei pannelli. La forma del sito." },
  { id: "pillola", name: "Pillola", blurb: "Completamente stondato: più amichevole e «consumer», stacca dal guscio da IDE dell'app." },
  { id: "squadrato", name: "Squadrato", blurb: "Angoli quasi vivi (2px): tecnico e asciutto, in tono con la workspace." },
];

// ── Footer ────────────────────────────────────────────────────────────────
export const FOOTER_VARIANTS: Choice[] = [
  {
    id: "completo",
    name: "Completo",
    blurb: "Logo + tagline e le quattro colonne (Prodotto/Docs/Contatti/Legale). Tutto raggiungibile, ma è alto. Il footer del sito.",
  },
  {
    id: "compatto",
    name: "Compatto",
    blurb: "Una riga sola: logo, i link essenziali in linea, social ed email. Occupa un terzo dello spazio; le voci secondarie spariscono.",
  },
];

// ── SectionHeading ────────────────────────────────────────────────────────
export const HEADING_VARIANTS: Choice[] = [
  { id: "eyebrow", name: "Con eyebrow", blurb: "Etichetta colorata in maiuscoletto sopra al titolo: orienta e dà ritmo. Lo stile del sito." },
  { id: "nudo", name: "Senza eyebrow", blurb: "Solo titolo e sottotitolo: più silenzioso, meno gerarchia da scorrere." },
  { id: "linea", name: "Con linea", blurb: "Una barretta d'accento sopra al titolo al posto dell'etichetta: segna la sezione senza aggiungere parole." },
];

// ── Container (larghezza) ─────────────────────────────────────────────────
export const CONTAINER_VARIANTS: Choice[] = [
  { id: "normale", name: "Normale (1152px)", blurb: "La misura attuale: sta comoda su un portatile senza svuotarsi su un monitor grande." },
  { id: "stretto", name: "Stretto (1024px)", blurb: "Righe più corte, più facili da leggere; su schermi larghi lascia molta aria ai lati." },
  { id: "largo", name: "Largo (1280px)", blurb: "Sfrutta i monitor grandi, ma le righe di testo si allungano e la lettura si fa più faticosa." },
];

// ── ThemeToggle ───────────────────────────────────────────────────────────
export const THEME_TOGGLE_VARIANTS: Choice[] = [
  { id: "icona", name: "Solo icona", blurb: "Un quadrato con sole/luna. Compatto, ma va indovinato. Il toggle del sito." },
  { id: "etichetta", name: "Icona + testo", blurb: "Aggiunge «Chiaro»/«Scuro»: inequivocabile, però ruba spazio alle CTA accanto." },
];

/** Tutte le varianti per chiave, per il lab e per i default. */
export const VARIANTS: Record<Exclude<DesignKey, "palette" | "navbar" | "hero">, Choice[]> = {
  logo: LOGO_VARIANTS,
  button: BUTTON_VARIANTS,
  footer: FOOTER_VARIANTS,
  heading: HEADING_VARIANTS,
  container: CONTAINER_VARIANTS,
  themeToggle: THEME_TOGGLE_VARIANTS,
};

/** Il primo id di una lista è il default: la variante scelta per il sito. */
export function firstId(list: Choice[]): string {
  return list[0].id;
}

/** Cerca una variante per id in una lista; ricade sulla prima per un id sconosciuto. */
export function choiceById(list: Choice[], id: string | null | undefined): Choice {
  return list.find((c) => c.id === id) ?? list[0];
}
