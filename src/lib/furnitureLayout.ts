// Personalizzazione dell'ufficio (Roadmap 4, frontiera #3): drag libero dei mobili.
//
// Ogni mobile ha una posa base codificata nella scena; in "modalità riordino" l'utente
// lo trascina sul pavimento e lo spostamento — un offset `dx/dz` rispetto alla posa
// base — è persistito localmente, esattamente come `roomTheme`/`officeLayout`. Il layout
// condiviso tra viste è il "vero" pezzo autorevole (frontiera #1), qui volutamente
// locale. Questo modulo è la logica pura e testabile (clamp ai muri); la resa 3D e la
// gestione del pointer stanno in `OfficeScene.tsx`.

export interface FurniturePlacement {
  /** offset X rispetto alla posa base (world units). */
  dx: number;
  /** offset Z rispetto alla posa base (world units). */
  dz: number;
}

export interface RoomBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** Margine dai muri interni: un mobile resta almeno così dentro la stanza. */
export const WALL_MARGIN = 0.7;

const round = (n: number): number => Math.round(n * 1000) / 1000;

/**
 * Clampa la posizione finale (base + offset desiderato) dentro i confini della stanza
 * (meno un margine) e restituisce l'offset `dx/dz` risultante. Così il drag non può
 * spingere un mobile dentro o oltre i muri. Puro.
 */
export function clampPlacement(
  base: [number, number],
  offset: [number, number],
  bounds: RoomBounds,
  margin = WALL_MARGIN,
): FurniturePlacement {
  const [bx, bz] = base;
  const x = Math.max(bounds.minX + margin, Math.min(bounds.maxX - margin, bx + offset[0]));
  const z = Math.max(bounds.minZ + margin, Math.min(bounds.maxZ - margin, bz + offset[1]));
  return { dx: round(x - bx), dz: round(z - bz) };
}

/** Uno spostamento è "reale" (vale la pena mostrarlo/persistirlo) se supera un epsilon. */
export function isPlaced(p: FurniturePlacement | undefined | null): boolean {
  return !!p && (Math.abs(p.dx) > 0.001 || Math.abs(p.dz) > 0.001);
}

/** Quanti mobili risultano spostati dalla posa base. */
export function placedCount(placements: Record<string, FurniturePlacement>): number {
  return Object.values(placements).filter(isPlaced).length;
}
