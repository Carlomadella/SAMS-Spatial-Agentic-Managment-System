import type { Zone, Vec2 } from "../types";
import { isPointClear, type Rect } from "../lib/pathfind";

// ---------------------------------------------------------------------------
// Static house layout. Coordinate system:
//   x : left (−) ──► right (+)
//   z : back (−) ──► front (+)
// The floor is centered on the origin. The house has three rooms side by side,
// separated by two internal walls that leave a doorway open at the front:
//   Studio (work)  |  Salotto (living)  |  Camera (bedroom)
// ---------------------------------------------------------------------------

export const ROOM = {
  minX: -13,
  maxX: 13,
  minZ: -7,
  maxZ: 7,
  wallHeight: 3.2,
} as const;

export const ROOM_WIDTH = ROOM.maxX - ROOM.minX;
export const ROOM_DEPTH = ROOM.maxZ - ROOM.minZ;

/** X of the two internal dividing walls. */
export const PARTITIONS_X = [-4.5, 4.5] as const;
/** The dividing walls stop here (toward the front), leaving a doorway. */
export const DOORWAY_Z = 2.0;

/** Walkable interior of each room (inset from the walls) — used for wandering. */
export const ROOMS: Record<"studio" | "salotto" | "camera", Rect> = {
  studio:  { minX: -12.3, maxX: -5.0, minZ: -6.3, maxZ: 6.3 },
  salotto: { minX: -3.9, maxX: 3.9, minZ: -6.3, maxZ: 6.3 },
  camera:  { minX: 5.0, maxX: 12.3, minZ: -2.6, maxZ: 6.3 },
};

/** Points of interest the user can dispatch agents to (one per room + reading nook). */
export const ZONES: Zone[] = [
  { id: "desk", label: "Scrivania", sublabel: "Studio · lavoro", position: [-8.5, -2.2] },
  { id: "whiteboard", label: "Angolo lettura", sublabel: "Idee e pianificazione", position: [-8.5, 4.4] },
  { id: "lounge", label: "Salotto", sublabel: "Relax", position: [0, 3.6] },
  { id: "bedroom", label: "Camera", sublabel: "Riposo", position: [8.7, -0.6] },
];

export const ZONE_BY_ID: Record<string, Zone> = Object.fromEntries(
  ZONES.map((z) => [z.id, z]),
);

/** Where freshly spawned agents appear (living-room entrance, front-centre). */
export const SPAWN_POINT: Vec2 = [0, 5.6];

/** Bed positions in the bedroom (where agents lie down to sleep at night). */
export const BEDS: Vec2[] = [
  [6.4, -4.4],
  [9.0, -4.4],
  [11.5, -4.4],
];

/**
 * Floor footprints (axis-aligned) of the internal walls and bulky furniture
 * agents should walk around rather than through. The pathfinder inflates these
 * by the agent's clearance radius, so the footprints here are the raw extents.
 */
export const OBSTACLES: Rect[] = [
  // internal dividing walls (open at the front, z > DOORWAY_Z)
  { minX: -4.7, maxX: -4.3, minZ: ROOM.minZ, maxZ: DOORWAY_Z }, // studio | salotto
  { minX: 4.3, maxX: 4.7, minZ: ROOM.minZ, maxZ: DOORWAY_Z }, //   salotto | camera

  // --- Studio (work) ---
  { minX: -11.3, maxX: -8.7, minZ: -4.7, maxZ: -3.3 }, // Desk @ (-10,-4)
  { minX: -7.7, maxX: -5.3, minZ: -4.7, maxZ: -3.3 }, //  Desk @ (-6.5,-4)

  // --- Salotto (living) ---
  { minX: -3.0, maxX: 0.0, minZ: -1.7, maxZ: -0.3 }, // Sofa @ (-1.5,-1)
  { minX: -2.3, maxX: -0.7, minZ: 0.4, maxZ: 1.4 }, //  CoffeeTable @ (-1.5,0.9)
  { minX: 1.3, maxX: 2.7, minZ: 0.3, maxZ: 1.7 }, //    Armchair @ (2,1)

  // --- Camera (bedroom) — three beds against the back wall ---
  { minX: 5.65, maxX: 7.15, minZ: -6.0, maxZ: -3.2 }, // Bed @ (6.4,-4.4)
  { minX: 8.25, maxX: 9.75, minZ: -6.0, maxZ: -3.2 }, // Bed @ (9.0,-4.4)
  { minX: 10.75, maxX: 12.25, minZ: -6.0, maxZ: -3.2 }, // Bed @ (11.5,-4.4)
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
