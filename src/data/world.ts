import type { Zone, Vec2 } from "../types";
import type { Rect } from "../lib/pathfind";

// ---------------------------------------------------------------------------
// Static office layout. Coordinate system:
//   x : left (−) ──► right (+)
//   z : back (−) ──► front (+)
// The floor is centered on the origin.
// ---------------------------------------------------------------------------

export const ROOM = {
  minX: -9,
  maxX: 9,
  minZ: -6,
  maxZ: 6,
  wallHeight: 3.2,
} as const;

export const ROOM_WIDTH = ROOM.maxX - ROOM.minX;
export const ROOM_DEPTH = ROOM.maxZ - ROOM.minZ;

/** Points of interest the user can dispatch agents to. */
export const ZONES: Zone[] = [
  { id: "desk", label: "Scrivania", sublabel: "Calcolo attivo", position: [1.2, 2.7] },
  { id: "whiteboard", label: "Angolo lettura", sublabel: "Idee e pianificazione", position: [-1.8, -3.0] },
  { id: "kanban", label: "Parete media", sublabel: "Elementi di lavoro", position: [5.4, -3.0] },
  { id: "vault", label: "Credenza", sublabel: "Archivio sicuro", position: [-6.4, -3.4] },
  { id: "gate", label: "Porta d'ingresso", sublabel: "Accesso consentito", position: [6.8, 0.6] },
  { id: "lounge", label: "Salotto", sublabel: "Inattivo", position: [-5.4, 3.2] },
];

export const ZONE_BY_ID: Record<string, Zone> = Object.fromEntries(
  ZONES.map((z) => [z.id, z]),
);

/** Where freshly spawned agents appear (near the entrance, front-right). */
export const SPAWN_POINT: Vec2 = [4.5, 4.2];

/**
 * Floor footprints (axis-aligned) of the bulky furniture agents should walk
 * around rather than through. Mirrors the layout in OfficeScene; only the pieces
 * standing in the walkable middle of the room are listed (items flush against the
 * back/left walls are out of every path). The pathfinder inflates these by the
 * agent's clearance radius, so the footprints here are the raw extents.
 */
export const OBSTACLES: Rect[] = [
  { minX: -2.9, maxX: 0.1, minZ: -0.95, maxZ: 0.55 }, // Sofa  @ (-1.4,-0.2)
  { minX: -2.3, maxX: -0.5, minZ: 1.3, maxZ: 2.3 }, //   CoffeeTable @ (-1.4,1.8)
  { minX: 1.8, maxX: 3.0, minZ: 1.3, maxZ: 2.5 }, //     Armchair @ (2.4,1.9)
  { minX: -4.0, maxX: -3.2, minZ: -0.2, maxZ: 0.6 }, //  SideTable @ (-3.6,0.2)
  { minX: 1.4, maxX: 2.0, minZ: -1.7, maxZ: -1.1 }, //   FloorLamp @ (1.7,-1.4)
  { minX: 5.2, maxX: 7.2, minZ: 2.1, maxZ: 4.7 }, //     Desk @ (6.2,3.4)
];

/**
 * Pick a fitting zone for a task from keywords in its title, so an agent walks
 * somewhere sensible when it starts working (writing → reading nook, code →
 * desk, etc). Falls back to the work desk.
 */
export function zoneForTitle(title: string): string {
  const t = title.toLowerCase();
  if (/notion|guida|lezion|glossar|cheatsheet|readme|docs?|document|content|articol|blog/.test(t)) {
    return "whiteboard"; // Reading Nook — ideas & planning
  }
  if (/test|bug|fix|refactor|feature|implement|codice|code|api|deps|dipendenz/.test(t)) {
    return "desk"; // Work Desk — active compute
  }
  return "desk";
}

/** Clamp a point so agents never walk through the walls. */
export function clampToRoom([x, z]: Vec2): Vec2 {
  const pad = 0.6;
  return [
    Math.min(ROOM.maxX - pad, Math.max(ROOM.minX + pad, x)),
    Math.min(ROOM.maxZ - pad, Math.max(ROOM.minZ + pad, z)),
  ];
}
