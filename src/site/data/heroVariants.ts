// Varianti dello sfondo della hero (Roadmap 5) — "tante varianti, non solo una con
// bg-image e una con bg-video". Le cinque coprono l'arco intero: dal mostrare la stanza
// (immagine, video) al non mostrarla affatto (bagliori, griglia, piatta).
//
// Il compromesso che le distingue è sempre lo stesso: **quanto la stanza vale il suo peso**.
// Il video la racconta meglio di ogni parola ma costa megabyte e batteria; l'immagine ne
// dà l'idea per pochi kB; le tre senza stanza caricano all'istante e non promettono nulla
// che il testo non dica già.

export type HeroKind = "immagine" | "video" | "bagliori" | "griglia" | "piatta";

export interface HeroVariant {
  id: HeroKind;
  name: string;
  blurb: string;
  /** Nota onesta sul costo/compromesso, mostrata nel design lab. */
  tradeoff: string;
}

export const HERO_VARIANTS: HeroVariant[] = [
  {
    id: "immagine",
    name: "Screenshot della stanza",
    blurb: "Uno scatto reale della stanza 3D, sfumato nel colore della pagina.",
    tradeoff: "~100 kB, si vede subito. Mostra la stanza ferma: non si capisce che è viva.",
  },
  {
    id: "video",
    name: "Video della stanza",
    blurb:
      "Una giornata in venti secondi, in loop muto: gli agenti camminano, si mettono al lavoro alle scrivanie e infine dormono nei letti mentre scende la notte. La variante del sito.",
    tradeoff:
      "943 kB per 20s a 30 fps: la più convincente e la più cara. Su rete lenta parte per ultima (intanto si vede lo screenshot, che fa da poster) e su mobile consuma batteria.",
  },
  {
    id: "bagliori",
    name: "Bagliori",
    blurb: "Nessuna stanza: due aloni radiali nei colori della palette. Il titolo è il protagonista assoluto.",
    tradeoff: "Zero peso e sempre elegante, ma non fa vedere il prodotto: chi arriva non sa cosa sia SAMS finché non scorre.",
  },
  {
    id: "griglia",
    name: "Griglia tecnica",
    blurb: "Reticolo sfumato sotto ai bagliori: aria da strumento, non da vetrina.",
    tradeoff: "Zero peso e un carattere preciso, ma è un linguaggio già visto in molti siti dev.",
  },
  {
    id: "piatta",
    name: "Piatta",
    blurb: "Solo il colore della palette. Il minimo assoluto: tipografia e basta.",
    tradeoff: "Il più veloce e il più severo — regge solo se il titolo è perfetto, e mette la palette a nudo.",
  },
];

/** Lo sfondo del sito: scelto dal design lab il 2026-07-15. */
export const DEFAULT_HERO_ID: HeroKind = "video";

/** Cerca una variante per id; ricade sul default per un id sconosciuto. */
export function heroById(id: string | null | undefined): HeroVariant {
  return HERO_VARIANTS.find((v) => v.id === id) ?? HERO_VARIANTS.find((v) => v.id === DEFAULT_HERO_ID)!;
}
