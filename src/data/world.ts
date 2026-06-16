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
  { id: "desk", label: "Desk 01", sublabel: "Active Compute", position: [0, 2.4] },
  { id: "whiteboard", label: "Whiteboard", sublabel: "Ideas & Planning", position: [-1.5, -3.1] },
  { id: "kanban", label: "Kanban Wall", sublabel: "Work Items", position: [3.6, -3.0] },
  { id: "vault", label: "Vault", sublabel: "Secure Storage", position: [-6.4, -3.4] },
  { id: "gate", label: "Security Gate", sublabel: "Access Granted", position: [6.6, 0.4] },
  { id: "lounge", label: "Lounge", sublabel: "Idle", position: [-6.2, 2.4] },
];

export const ZONE_BY_ID: Record<string, Zone> = Object.fromEntries(
  ZONES.map((z) => [z.id, z]),
);

/** Where freshly spawned agents appear (near the entrance, front-right). */
export const SPAWN_POINT: Vec2 = [4.5, 4.2];

/** Clamp a point so agents never walk through the walls. */
export function clampToRoom([x, z]: Vec2): Vec2 {
  const pad = 0.6;
  return [
    Math.min(ROOM.maxX - pad, Math.max(ROOM.minX + pad, x)),
    Math.min(ROOM.maxZ - pad, Math.max(ROOM.minZ + pad, z)),
  ];
}
