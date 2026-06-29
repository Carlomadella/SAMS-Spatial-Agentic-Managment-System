import type { Zone, Vec2 } from "../types";
import { isPointClear, type Rect } from "../lib/pathfind";

// ---------------------------------------------------------------------------
// Static house layout. Coordinate system:
//   x : left (−) ──► right (+)
//   z : back (−) ──► front (+)
// The house is a 2×2 of rooms around a central atrium (a cross of corridors):
//   Studio (back-left) | Cucina (back-right)
//   Salotto (front-left) | Camera (front-right)
// Two cross walls (x≈0 and z≈0) separate the quadrants, broken by doorways and
// a central opening (the atrium) so every room connects to the others.
// ---------------------------------------------------------------------------

export const ROOM = {
  minX: -13,
  maxX: 13,
  minZ: -9,
  maxZ: 9,
  wallHeight: 3.2,
} as const;

export const ROOM_WIDTH = ROOM.maxX - ROOM.minX;
export const ROOM_DEPTH = ROOM.maxZ - ROOM.minZ;

const WT = 0.16; // half-thickness of the internal walls

/**
 * Internal wall segments. Rendered as boxes AND used as pathfinding obstacles
 * (single source of truth → a wall you can see is a wall you can't cross). The
 * gaps between segments are doorways / the central atrium opening.
 */
export const WALLS: Rect[] = [
  // vertical cross wall at x≈0 — wide doorways (~2.6) at z=±5, atrium gap at the centre
  { minX: -WT, maxX: WT, minZ: -9, maxZ: -6.3 },
  { minX: -WT, maxX: WT, minZ: -3.7, maxZ: -1.2 },
  { minX: -WT, maxX: WT, minZ: 1.2, maxZ: 3.7 },
  { minX: -WT, maxX: WT, minZ: 6.3, maxZ: 9 },
  // horizontal cross wall at z≈0 — wide doorways (~2.6) at x=±5, atrium gap at the centre
  { minX: -13, maxX: -6.3, minZ: -WT, maxZ: WT },
  { minX: -3.7, maxX: -1.2, minZ: -WT, maxZ: WT },
  { minX: 1.2, maxX: 3.7, minZ: -WT, maxZ: WT },
  { minX: 6.3, maxX: 13, minZ: -WT, maxZ: WT },
];

/** Walkable interior of each room quadrant (inset from walls) — for wandering. */
export const ROOMS: Record<"studio" | "cucina" | "salotto" | "camera", Rect> = {
  studio:  { minX: -12.3, maxX: -0.9, minZ: -8.3, maxZ: -0.9 },
  cucina:  { minX: 0.9, maxX: 12.3, minZ: -8.3, maxZ: -0.9 },
  salotto: { minX: -12.3, maxX: -0.9, minZ: 0.9, maxZ: 8.3 },
  camera:  { minX: 0.9, maxX: 12.3, minZ: 0.9, maxZ: 8.3 },
};

/** Points of interest the user can dispatch agents to (one per room + reading nook). */
export const ZONES: Zone[] = [
  { id: "desk", label: "Scrivania", sublabel: "Studio · lavoro", position: [-8.5, -2.6] },
  { id: "whiteboard", label: "Angolo lettura", sublabel: "Idee e pianificazione", position: [-2.6, -7] },
  { id: "kitchen", label: "Cucina", sublabel: "Pausa", position: [7, -2.6] },
  { id: "lounge", label: "Salotto", sublabel: "Relax", position: [-7, 2.4] },
  { id: "bedroom", label: "Camera", sublabel: "Riposo", position: [2, 2.2] },
];

export const ZONE_BY_ID: Record<string, Zone> = Object.fromEntries(
  ZONES.map((z) => [z.id, z]),
);

/** Where freshly spawned agents appear (living-room, front-left). */
export const SPAWN_POINT: Vec2 = [-6, 7.5];

/** One bed per agent (six), in two rows in the bedroom quadrant. */
export const BEDS: Vec2[] = [
  [3.0, 2.4], [6.5, 2.4], [10.0, 2.4],
  [3.0, 6.0], [6.5, 6.0], [10.0, 6.0],
];

/**
 * Floor footprints of the internal walls + bulky furniture agents must walk
 * around. The pathfinder inflates these by the agent clearance radius.
 */
export const OBSTACLES: Rect[] = [
  ...WALLS,

  // --- Studio (back-left): two desks against the back wall ---
  { minX: -10.2, maxX: -7.8, minZ: -8.5, maxZ: -7.2 }, // Desk @ (-9,-7.85)
  { minX: -5.7, maxX: -3.3, minZ: -8.5, maxZ: -7.2 }, //  Desk @ (-4.5,-7.85)

  // --- Cucina (back-right): counter along the back + island ---
  { minX: 1.4, maxX: 11.6, minZ: -8.6, maxZ: -7.7 }, // counter run @ back
  { minX: 4.6, maxX: 8.4, minZ: -4.6, maxZ: -3.0 }, //  island @ (6.5,-3.8)

  // --- Salotto (front-left): sofa + coffee table + armchair ---
  { minX: -9.0, maxX: -6.0, minZ: 1.6, maxZ: 3.0 }, // Sofa @ (-7.5,2.3)
  { minX: -8.3, maxX: -6.7, minZ: 3.7, maxZ: 4.7 }, // CoffeeTable @ (-7.5,4.2)
  { minX: -4.7, maxX: -3.3, minZ: 3.6, maxZ: 5.0 }, // Armchair @ (-4,4.3)

  // --- Camera (front-right): six beds (1.5×2.6 footprints) ---
  ...[
    [3.0, 2.4], [6.5, 2.4], [10.0, 2.4],
    [3.0, 6.0], [6.5, 6.0], [10.0, 6.0],
  ].map(([x, z]) => ({ minX: x - 0.75, maxX: x + 0.75, minZ: z - 1.3, maxZ: z + 1.3 })),
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

/** Clamp a point so agents never walk through the outer walls. */
export function clampToRoom([x, z]: Vec2): Vec2 {
  const pad = 0.6;
  return [
    Math.min(ROOM.maxX - pad, Math.max(ROOM.minX + pad, x)),
    Math.min(ROOM.maxZ - pad, Math.max(ROOM.minZ + pad, z)),
  ];
}

/** A random walkable point inside the given room (avoids furniture/walls). */
export function randomRoomPoint(room: keyof typeof ROOMS): Vec2 {
  const r = ROOMS[room];
  for (let i = 0; i < 24; i++) {
    const p: Vec2 = [
      r.minX + Math.random() * (r.maxX - r.minX),
      r.minZ + Math.random() * (r.maxZ - r.minZ),
    ];
    if (isPointClear(p, OBSTACLES)) return p;
  }
  return [(r.minX + r.maxX) / 2, (r.minZ + r.maxZ) / 2];
}

/** A random walkable point anywhere in the house (used for idle wandering). */
export function randomWalkPoint(): Vec2 {
  const rooms = Object.keys(ROOMS) as (keyof typeof ROOMS)[];
  return randomRoomPoint(rooms[Math.floor(Math.random() * rooms.length)]);
}

/** Agents sleep at night: 23:00–07:00 local time. */
export function isNightNow(): boolean {
  const h = new Date().getHours();
  return h >= 23 || h < 7;
}
