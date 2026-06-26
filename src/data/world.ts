import type { Zone, Vec2 } from "../types";

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
  { id: "desk", label: "Work Desk", sublabel: "Active Compute", position: [1.2, 2.7] },
  { id: "whiteboard", label: "Reading Nook", sublabel: "Ideas & Planning", position: [-1.8, -3.0] },
  { id: "kanban", label: "Media Wall", sublabel: "Work Items", position: [5.4, -3.0] },
  { id: "vault", label: "Sideboard", sublabel: "Secure Storage", position: [-6.4, -3.4] },
  { id: "gate", label: "Front Door", sublabel: "Access Granted", position: [6.8, 0.6] },
  { id: "lounge", label: "Lounge", sublabel: "Idle", position: [-5.4, 3.2] },
];

export const ZONE_BY_ID: Record<string, Zone> = Object.fromEntries(
  ZONES.map((z) => [z.id, z]),
);

/** Where freshly spawned agents appear (near the entrance, front-right). */
export const SPAWN_POINT: Vec2 = [4.5, 4.2];

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
