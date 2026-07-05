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
