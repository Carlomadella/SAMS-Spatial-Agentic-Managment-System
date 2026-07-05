// Tour interattivo post-onboarding — l'onboarding spiega i _concetti_, il tour
// mostra l'_UI_: evidenzia le zone chiave (scena, inspector, pannello in basso,
// garden) con uno spotlight e una spiegazione. Gli step puntano agli elementi
// tramite attributi `data-tour="…"`; se un target manca, la card va centrata
// (nessun crash). Logica pura e testabile qui; il rendering in `Tour.tsx`.

export interface TourStep {
  id: string;
  /** CSS selector dell'elemento da evidenziare; assente = card centrata. */
  target?: string;
  title: string;
  body: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Giro rapido dell'interfaccia",
    body: "Un minuto per scoprire dove sono le cose. Puoi saltare quando vuoi e rifare il tour dalla palette comandi (⌘/Ctrl+K).",
  },
  {
    id: "scene",
    target: '[data-tour="scene"]',
    title: "La scena 3D",
    body: "Qui vivono gli agenti. Clicca un agente per selezionarlo, clicca il pavimento per farlo camminare, trascina per ruotare la vista.",
  },
  {
    id: "add-agent",
    target: '[data-tour="add-agent"]',
    title: "Crea agenti",
    body: "Aggiungi un nuovo agente da qui (o con ⌘/Ctrl+K → «Crea nuovo agente»).",
  },
  {
    id: "inspector",
    target: '[data-tour="inspector"]',
    title: "Il pannello dell'agente",
    body: "Assegna un task in linguaggio naturale, imposta ruolo e istruzioni, segui obiettivi, gettoni e legami.",
  },
  {
    id: "bottom",
    target: '[data-tour="bottom"]',
    title: "Pannelli in basso",
    body: "Event Log, Live Sim (routine ⏰ e reazioni a catena ⛓), Replay, Diario e Cronologia dei task.",
  },
  {
    id: "garden",
    target: '[data-tour="garden"]',
    title: "Commit Garden",
    body: "I tuoi push su GitHub innaffiano una pianta 3D che cresce nel tempo. Apri la porta del giardino da qui.",
  },
];

export interface TourRect { top: number; left: number; width: number; height: number }
export interface TourViewport { width: number; height: number }

const clampN = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/**
 * Posiziona la card del tour accanto allo spotlight, **sempre interamente dentro
 * il viewport**. Sceglie il lato (sotto/sopra/destra/sinistra) con più spazio per
 * la card; se nessuno la contiene (target a tutta altezza/larghezza) la centra.
 * Il risultato è comunque clampato ai margini, così la card non finisce mai fuori
 * schermo (bug del passo "inspector", target alto quanto la colonna destra).
 */
export function placeTourCard(
  rect: TourRect | null,
  card: { w: number; h: number },
  vp: TourViewport,
  margin = 12,
  gap = 14,
): { top: number; left: number } {
  const { width: vw, height: vh } = vp;
  if (!rect) {
    return { top: Math.max(margin, (vh - card.h) / 2), left: Math.max(margin, (vw - card.w) / 2) };
  }
  const below = vh - (rect.top + rect.height);
  const above = rect.top;
  const right = vw - (rect.left + rect.width);
  const left = rect.left;

  let top: number;
  let leftPos: number;
  if (below >= card.h + gap) {
    top = rect.top + rect.height + gap;
    leftPos = rect.left;
  } else if (above >= card.h + gap) {
    top = rect.top - card.h - gap;
    leftPos = rect.left;
  } else if (right >= card.w + gap) {
    leftPos = rect.left + rect.width + gap;
    top = rect.top;
  } else if (left >= card.w + gap) {
    leftPos = rect.left - card.w - gap;
    top = rect.top;
  } else {
    top = (vh - card.h) / 2;
    leftPos = (vw - card.w) / 2;
  }
  return {
    top: clampN(top, margin, vh - card.h - margin),
    left: clampN(leftPos, margin, vw - card.w - margin),
  };
}

/** Riporta un indice nei limiti degli step. */
export function clampStep(i: number): number {
  return Math.min(Math.max(0, Math.round(i)), TOUR_STEPS.length - 1);
}

/** true se l'indice è l'ultimo step. */
export function isLastStep(i: number): boolean {
  return i >= TOUR_STEPS.length - 1;
}

/** Etichetta di avanzamento, es. "2 / 6". */
export function tourProgress(i: number): string {
  return `${clampStep(i) + 1} / ${TOUR_STEPS.length}`;
}
