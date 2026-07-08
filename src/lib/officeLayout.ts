// Disposizione dell'ufficio — "personalizzazione dell'ufficio" (Roadmap 3/4),
// primo pezzo verificabile senza browser: riarrangiare il salotto.
//
// Il posizionamento dei mobili è codificato nella scena; il drag libero in 3D è
// il pezzo grande (gated sull'interazione da verificare a occhio e sullo stato
// autorevole del layout). Qui, come per `roomThemes`, si offrono disposizioni
// preconfezionate del cluster salotto (divano, tavolino, tappeto, poltrona…),
// applicate come offset di gruppo e persistite. Logica pura e testabile; la scena
// legge l'offset in `OfficeScene.tsx`.

export interface OfficeArrangement {
  id: string;
  label: string;
  emoji: string;
  /** offset [x, y, z] applicato al gruppo salotto rispetto alla posa base. */
  loungeOffset: [number, number, number];
  /** rotazione (rad) attorno a Y del gruppo salotto. */
  loungeSpin: number;
}

export const OFFICE_ARRANGEMENTS: OfficeArrangement[] = [
  { id: "classic", label: "Classico", emoji: "🛋️", loungeOffset: [0, 0, 0], loungeSpin: 0 },
  { id: "cozy", label: "Raccolto", emoji: "🔥", loungeOffset: [1.6, 0, 1.3], loungeSpin: 0.18 },
  { id: "open", label: "Arioso", emoji: "🌿", loungeOffset: [-1.4, 0, -1.1], loungeSpin: -0.12 },
  { id: "diag", label: "Diagonale", emoji: "📐", loungeOffset: [0.8, 0, -0.6], loungeSpin: 0.35 },
];

export const DEFAULT_OFFICE_ARRANGEMENT = OFFICE_ARRANGEMENTS[0].id;

/** Disposizione per id, con fallback alla prima (Classico) se sconosciuta. */
export function getArrangement(id: string): OfficeArrangement {
  return OFFICE_ARRANGEMENTS.find((a) => a.id === id) ?? OFFICE_ARRANGEMENTS[0];
}
