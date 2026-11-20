import type { Zone, Vec2 } from "../types";
import { isPointClear, type Rect } from "../lib/pathfind";

// ---------------------------------------------------------------------------
// House layout. Coordinate system:
//   x : left (−) ──► right (+)
//   z : back (−) ──► front (+)
// The base house is a 2×2 of rooms around a central atrium (a cross of corridors):
//   Studio (back-left) | Cucina (back-right)
//   Salotto (front-left) | Camera (front-right)
// Two cross walls (x≈0 and z≈0) separate the quadrants, broken by doorways and
// a central opening (the atrium) so every room connects to the others.
//
// La casa cresce con gli agenti (ROADMAP5, scelte dell'utente del 20/11): quando gli
// agenti superano i letti si aggiunge a destra un'**ala** larga mezza casa, con una
// stanza di attività dietro (dal catalogo, in ordine) e una camera da 6 letti davanti.
// La pianta è una funzione pura del numero di ali: la parte di casa che c'è già non cambia.
// ---------------------------------------------------------------------------

/** The base house (no wings). Kept for the parts that only concern it (furniture drag clamp). */
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

/** Letti della casa base. */
export const BASE_BEDS = 6;
/** Ogni quanti agenti nasce un'ala (scelta dell'utente: prima che i letti finiscano). */
export const AGENTS_PER_WING = 6;
/** Larghezza di un'ala (mezza casa). */
export const WING_WIDTH = 13;
/** Agenti sotto la soglia prima che un'ala venga tolta (niente avanti-indietro). */
export const SHRINK_MARGIN = 3;
/** Ali al massimo: una per stanza del catalogo. Oltre, i letti si condividono. */
export const MAX_WINGS = 4;

export type WingKind = "meeting" | "library" | "lab" | "terrace";

/** Le stanze di attività, nell'ordine in cui arrivano (scelta dell'utente). */
export const WING_CATALOG: { kind: WingKind; label: string; sublabel: string }[] = [
  { kind: "meeting", label: "Sala riunioni", sublabel: "Passaggi di lavoro" },
  { kind: "library", label: "Biblioteca", sublabel: "Ricerca e documenti" },
  { kind: "lab", label: "Laboratorio", sublabel: "Test e CI" },
  { kind: "terrace", label: "Terrazza", sublabel: "Pausa all'aperto" },
];

export interface Wing {
  index: number;
  kind: WingKind;
  minX: number;
  maxX: number;
  /** Centro in x dell'ala. */
  cx: number;
  /** Ingombri dei mobili della stanza di attività (ostacoli per il pathfinder). */
  furniture: Rect[];
  /** I 6 letti della camera dell'ala. */
  beds: Vec2[];
}

export interface HouseLayout {
  wings: Wing[];
  /** Confini calpestabili dell'intera casa. */
  bounds: Rect;
  width: number;
  depth: number;
  /** Centro in x della casa (la telecamera guarda lì). */
  centerX: number;
  /** Muri interni: disegnati E usati come ostacoli (una sola fonte di verità). */
  walls: Rect[];
  /** Interno calpestabile di ogni stanza (per vagare). */
  rooms: Record<string, Rect>;
  zones: Zone[];
  zoneById: Record<string, Zone>;
  /** Un letto per agente: prima quelli della casa base, poi quelli delle ali. */
  beds: Vec2[];
  obstacles: Rect[];
}

// --- casa base ----------------------------------------------------------------

const BASE_WALLS: Rect[] = [
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

const BASE_ROOMS: Record<string, Rect> = {
  studio: { minX: -12.3, maxX: -0.9, minZ: -8.3, maxZ: -0.9 },
  cucina: { minX: 0.9, maxX: 12.3, minZ: -8.3, maxZ: -0.9 },
  salotto: { minX: -12.3, maxX: -0.9, minZ: 0.9, maxZ: 8.3 },
  camera: { minX: 0.9, maxX: 12.3, minZ: 0.9, maxZ: 8.3 },
};

/** Points of interest the user can dispatch agents to (one per room + reading nook). */
const BASE_ZONES: Zone[] = [
  { id: "desk", label: "Scrivania", sublabel: "Studio · lavoro", position: [-8.5, -2.6] },
  { id: "whiteboard", label: "Angolo lettura", sublabel: "Idee e pianificazione", position: [-2.6, -7] },
  { id: "kitchen", label: "Cucina", sublabel: "Pausa", position: [7, -2.6] },
  { id: "lounge", label: "Salotto", sublabel: "Relax", position: [-7, 2.4] },
  { id: "bedroom", label: "Camera", sublabel: "Riposo", position: [2, 2.2] },
];

/** Sei letti in due file, nella camera: stesse posizioni nella casa base e in ogni ala (spostate). */
const BED_OFFSETS: Vec2[] = [
  [3.0, 2.4], [6.5, 2.4], [10.0, 2.4],
  [3.0, 6.0], [6.5, 6.0], [10.0, 6.0],
];
const BASE_BED_POS: Vec2[] = BED_OFFSETS;

const bedRect = ([x, z]: Vec2): Rect => ({ minX: x - 0.75, maxX: x + 0.75, minZ: z - 1.3, maxZ: z + 1.3 });

const BASE_FURNITURE: Rect[] = [
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
];

// --- ali ----------------------------------------------------------------------

/** Mobili ingombranti della stanza di attività, in coordinate relative al centro dell'ala. */
function wingFurniture(kind: WingKind, cx: number): Rect[] {
  switch (kind) {
    case "meeting": // tavolo lungo al centro della stanza
      return [{ minX: cx - 2.2, maxX: cx + 2.2, minZ: -5.4, maxZ: -3.6 }];
    case "library": // tre librerie contro la parete di fondo
      return [-4, 0, 4].map((dx) => ({ minX: cx + dx - 1.2, maxX: cx + dx + 1.2, minZ: -8.9, maxZ: -8.2 }));
    case "lab": // due banconi contro la parete di fondo
      return [-3, 3].map((dx) => ({ minX: cx + dx - 1.2, maxX: cx + dx + 1.2, minZ: -8.5, maxZ: -7.2 }));
    case "terrace": // due poltrone attorno a un tavolino
      return [
        { minX: cx - 2.7, maxX: cx - 1.3, minZ: -5.2, maxZ: -3.8 },
        { minX: cx + 1.3, maxX: cx + 2.7, minZ: -5.2, maxZ: -3.8 },
      ];
  }
}

function buildWing(index: number): Wing {
  const minX = ROOM.maxX + index * WING_WIDTH;
  const maxX = minX + WING_WIDTH;
  const kind = WING_CATALOG[index % WING_CATALOG.length].kind;
  const cx = minX + WING_WIDTH / 2;
  return {
    index,
    kind,
    minX,
    maxX,
    cx,
    furniture: wingFurniture(kind, cx),
    beds: BED_OFFSETS.map(([x, z]) => [minX + x, z] as Vec2),
  };
}

/** Muri di un'ala: la parete che la separa dalla casa (porte a z=±5) e quella in mezzo all'ala. */
function wingWalls(w: Wing): Rect[] {
  return [
    // parete di confine con la parte precedente: porte larghe ~2,6 verso le due stanze
    { minX: w.minX - WT, maxX: w.minX + WT, minZ: -9, maxZ: -6.3 },
    { minX: w.minX - WT, maxX: w.minX + WT, minZ: -3.7, maxZ: 3.7 },
    { minX: w.minX - WT, maxX: w.minX + WT, minZ: 6.3, maxZ: 9 },
    // parete tra stanza di attività e camera, con una porta al centro
    { minX: w.minX, maxX: w.cx - 1.3, minZ: -WT, maxZ: WT },
    { minX: w.cx + 1.3, maxX: w.maxX, minZ: -WT, maxZ: WT },
  ];
}

function wingZone(w: Wing): Zone {
  const meta = WING_CATALOG.find((c) => c.kind === w.kind)!;
  // un punto libero davanti ai mobili della stanza di attività
  const z = w.kind === "meeting" ? -2.2 : -4.4;
  return { id: w.kind, label: meta.label, sublabel: meta.sublabel, position: [w.cx, z] };
}

const cache = new Map<number, HouseLayout>();

/** La pianta con `wingCount` ali (0 = la casa base). Pura e memorizzata: stesso numero, stesso oggetto. */
export function buildLayout(wingCount: number): HouseLayout {
  const n = Math.max(0, Math.min(MAX_WINGS, Math.floor(wingCount)));
  const hit = cache.get(n);
  if (hit) return hit;
  const wings = Array.from({ length: n }, (_, i) => buildWing(i));
  const maxX = wings.length ? wings[wings.length - 1].maxX : ROOM.maxX;
  const bounds: Rect = { minX: ROOM.minX, maxX, minZ: ROOM.minZ, maxZ: ROOM.maxZ };
  const walls = [...BASE_WALLS, ...wings.flatMap(wingWalls)];
  const rooms: Record<string, Rect> = { ...BASE_ROOMS };
  for (const w of wings) {
    rooms[`${w.kind}`] = { minX: w.minX + 0.9, maxX: w.maxX - 0.7, minZ: -8.3, maxZ: -0.9 };
    rooms[`camera-${w.index + 1}`] = { minX: w.minX + 0.9, maxX: w.maxX - 0.7, minZ: 0.9, maxZ: 8.3 };
  }
  const zones = [...BASE_ZONES, ...wings.map(wingZone)];
  const beds = [...BASE_BED_POS, ...wings.flatMap((w) => w.beds)];
  const obstacles = [
    ...walls,
    ...BASE_FURNITURE,
    ...BASE_BED_POS.map(bedRect),
    ...wings.flatMap((w) => [...w.furniture, ...w.beds.map(bedRect)]),
  ];
  const layout: HouseLayout = {
    wings,
    bounds,
    width: bounds.maxX - bounds.minX,
    depth: bounds.maxZ - bounds.minZ,
    centerX: (bounds.minX + bounds.maxX) / 2,
    walls,
    rooms,
    zones,
    zoneById: Object.fromEntries(zones.map((z) => [z.id, z])),
    beds,
    obstacles,
  };
  cache.set(n, layout);
  return layout;
}

// --- quante ali ---------------------------------------------------------------

/** Ali che servono per `agents` agenti: la prima al 7° agente, poi una ogni 6. */
export function wingsNeeded(agents: number): number {
  return Math.min(MAX_WINGS, Math.max(0, Math.ceil((agents - BASE_BEDS) / AGENTS_PER_WING)));
}

/** Numero di agenti con cui nasce l'ala `w` (1 → 7, 2 → 13, …). */
function wingThreshold(w: number): number {
  return BASE_BEDS + (w - 1) * AGENTS_PER_WING + 1;
}

/**
 * Le ali dopo un cambio nel numero di agenti. Cresce subito quando serve; si restringe
 * solo quando gli agenti sono almeno `SHRINK_MARGIN` sotto la soglia dell'ala, così
 * aggiungendo e togliendo un agente la casa non cambia forma avanti e indietro.
 */
export function nextWingCount(agents: number, current: number): number {
  const need = wingsNeeded(agents);
  if (need >= current) return need;
  let w = current;
  while (w > need && agents <= wingThreshold(w) - SHRINK_MARGIN) w--;
  return w;
}

// --- la pianta attuale -----------------------------------------------------------

let currentWings = 0;

/** La pianta in uso adesso (la imposta lo store quando cambia il numero di agenti). */
export function house(): HouseLayout {
  return buildLayout(currentWings);
}

/** Cambia la pianta in uso. Lo chiama lo store (`setHouseWings`), non i componenti. */
export function setCurrentWings(wings: number): void {
  currentWings = buildLayout(wings).wings.length;
}

/** Ostacoli della casa base (per i test del pathfinder). */
export const OBSTACLES: Rect[] = buildLayout(0).obstacles;

/** Where freshly spawned agents appear (living-room, front-left). */
export const SPAWN_POINT: Vec2 = [-6, 7.5];

/**
 * Pick a fitting zone for a task from keywords in its title, so an agent walks
 * somewhere sensible when it starts working. Le stanze delle ali si usano solo se
 * esistono: senza ali vale la casa base (documenti → angolo lettura, codice → scrivania).
 * Conta il tipo di task, mai il ruolo dell'agente.
 */
export function zoneForTitle(title: string, layout: HouseLayout = house()): string {
  const t = title.toLowerCase();
  const has = (id: string) => id in layout.zoneById;
  if (has("meeting") && /riunion|meeting|allinea|sincronizz|passaggio|consegna|handoff|relay/.test(t)) {
    return "meeting";
  }
  if (/notion|guida|lezion|glossar|cheatsheet|readme|docs?|document|content|articol|blog|ricerc|research/.test(t)) {
    return has("library") ? "library" : "whiteboard";
  }
  if (has("lab") && /test|\bci\b|pipeline|workflow|coverage|copertura/.test(t)) {
    return "lab";
  }
  if (/test|bug|fix|refactor|feature|implement|codice|code|api|deps|dipendenz/.test(t)) {
    return "desk"; // Work Desk — active compute
  }
  return "desk";
}

/** Clamp a point so agents never walk through the outer walls. */
export function clampToRoom([x, z]: Vec2, layout: HouseLayout = house()): Vec2 {
  const pad = 0.6;
  const b = layout.bounds;
  return [
    Math.min(b.maxX - pad, Math.max(b.minX + pad, x)),
    Math.min(b.maxZ - pad, Math.max(b.minZ + pad, z)),
  ];
}

/** A random walkable point inside the given room (avoids furniture/walls). */
export function randomRoomPoint(room: string, layout: HouseLayout = house()): Vec2 {
  const r = layout.rooms[room] ?? layout.rooms.salotto;
  for (let i = 0; i < 24; i++) {
    const p: Vec2 = [
      r.minX + Math.random() * (r.maxX - r.minX),
      r.minZ + Math.random() * (r.maxZ - r.minZ),
    ];
    if (isPointClear(p, layout.obstacles)) return p;
  }
  return [(r.minX + r.maxX) / 2, (r.minZ + r.maxZ) / 2];
}

/** A random walkable point anywhere in the house (used for idle wandering). */
export function randomWalkPoint(layout: HouseLayout = house()): Vec2 {
  const rooms = Object.keys(layout.rooms);
  return randomRoomPoint(rooms[Math.floor(Math.random() * rooms.length)], layout);
}

/** Agents sleep at night: 23:00–07:00 local time. */
export function isNightNow(): boolean {
  const h = new Date().getHours();
  return h >= 23 || h < 7;
}
