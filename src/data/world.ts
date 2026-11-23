import type { Zone, Vec2 } from "../types";
import { isPointClear, type Rect } from "../lib/pathfind";
import type { RoomId } from "../lib/roomFor";

// ---------------------------------------------------------------------------
// La casa. Coordinate:
//   x : sinistra (−) ──► destra (+)
//   z : dietro (−) ──► davanti (+)
//
// Stanze iconiche (scelte dell'utente del 23/11): una casa fissa di sei stanze, niente
// ali che crescono. Ogni stanza è il posto di un'azione degli agenti:
//
//   Biblioteca (legge)   | Officina (scrive)          | Laboratorio (test e CI)    dietro
//   Salotto (libero)     | Reparto revisioni (attesa) | Camera (notte, 6 letti)    davanti
//
// Tre colonne larghe 13, due file profonde 9. I muri sono l'unica fonte di verità:
// si disegnano e fanno da ostacolo al pathfinder.
// ---------------------------------------------------------------------------

/** I confini dell'intera casa. */
export const ROOM = {
  minX: -19.5,
  maxX: 19.5,
  minZ: -9,
  maxZ: 9,
  wallHeight: 3.2,
} as const;

export const ROOM_WIDTH = ROOM.maxX - ROOM.minX;
export const ROOM_DEPTH = ROOM.maxZ - ROOM.minZ;

const WT = 0.16; // mezzo spessore dei muri interni
/** Muri verticali tra le colonne e centro delle colonne. */
const COL_WALL = 6.5;
export const COLUMN_X = [-13, 0, 13] as const;
/** Porte: larghe ~2,6. Quelle tra colonne a z = ±4,5, quelle tra le file al centro di ogni colonna. */
const DOOR_HALF = 1.3;
const SIDE_DOOR_Z = 4.5;

/** Una zona della casa: il suo id è quello della stanza. */
export type RoomZone = Zone & { id: RoomId };

export interface HouseLayout {
  /** Confini calpestabili dell'intera casa. */
  bounds: Rect;
  width: number;
  depth: number;
  /** Centro in x della casa (la telecamera guarda lì). */
  centerX: number;
  /** Muri interni: disegnati E usati come ostacoli (una sola fonte di verità). */
  walls: Rect[];
  /** Interno calpestabile di ogni stanza. */
  rooms: Record<RoomId, Rect>;
  /** Una zona per stanza (menu «Vai in…», palette dei comandi, panoramica). */
  zones: RoomZone[];
  zoneById: Record<string, RoomZone>;
  /** Posti fissi di ogni stanza: dove si siede chi ci lavora, aspetta o fa pausa. */
  seats: Record<RoomId, Vec2[]>;
  /** Ingombri dei mobili di ogni stanza (ostacoli e posizioni per il disegno).
   *  Biblioteca: [scaffale, scaffale, ...tavoli]; Laboratorio: [...banconi, rack]. */
  furniture: Record<RoomId, Rect[]>;
  /** I sei letti della Camera. */
  beds: Vec2[];
  obstacles: Rect[];
}

// --- muri ---------------------------------------------------------------------

const WALLS: Rect[] = [
  // muri verticali tra le colonne, con le porte a z = ±4,5
  ...[-COL_WALL, COL_WALL].flatMap((x) => [
    { minX: x - WT, maxX: x + WT, minZ: ROOM.minZ, maxZ: -SIDE_DOOR_Z - DOOR_HALF },
    { minX: x - WT, maxX: x + WT, minZ: -SIDE_DOOR_Z + DOOR_HALF, maxZ: SIDE_DOOR_Z - DOOR_HALF },
    { minX: x - WT, maxX: x + WT, minZ: SIDE_DOOR_Z + DOOR_HALF, maxZ: ROOM.maxZ },
  ]),
  // muro tra le due file, con una porta al centro di ogni colonna
  { minX: ROOM.minX, maxX: COLUMN_X[0] - DOOR_HALF, minZ: -WT, maxZ: WT },
  { minX: COLUMN_X[0] + DOOR_HALF, maxX: COLUMN_X[1] - DOOR_HALF, minZ: -WT, maxZ: WT },
  { minX: COLUMN_X[1] + DOOR_HALF, maxX: COLUMN_X[2] - DOOR_HALF, minZ: -WT, maxZ: WT },
  { minX: COLUMN_X[2] + DOOR_HALF, maxX: ROOM.maxX, minZ: -WT, maxZ: WT },
];

// --- stanze ---------------------------------------------------------------------

const BACK = { minZ: -8.3, maxZ: -0.9 };
const FRONT = { minZ: 0.9, maxZ: 8.3 };
const COLS = [
  { minX: ROOM.minX + 0.7, maxX: -COL_WALL - 0.9 },
  { minX: -COL_WALL + 0.9, maxX: COL_WALL - 0.9 },
  { minX: COL_WALL + 0.9, maxX: ROOM.maxX - 0.7 },
];

const ROOMS: Record<RoomId, Rect> = {
  biblioteca: { ...COLS[0], ...BACK },
  officina: { ...COLS[1], ...BACK },
  laboratorio: { ...COLS[2], ...BACK },
  salotto: { ...COLS[0], ...FRONT },
  revisioni: { ...COLS[1], ...FRONT },
  camera: { ...COLS[2], ...FRONT },
};

/** Un rettangolo di larghezza `w` (x) e profondità `d` (z) centrato in (x, z). */
const box = (x: number, z: number, w: number, d: number): Rect => ({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });

/** Sei letti in due file da tre, con un corridoio libero davanti alla porta del Laboratorio. */
const BEDS: Vec2[] = [
  [9.5, 3.8], [13, 3.8], [16.5, 3.8],
  [9.5, 7.0], [13, 7.0], [16.5, 7.0],
];
const bedRect = ([x, z]: Vec2): Rect => box(x, z, 1.5, 2.6);

// --- postazioni (24/11) -----------------------------------------------------------
// In Biblioteca, Officina e Laboratorio c'è una postazione per agente: con 3 agenti
// tre scrivanie, con 9 agenti nove. Due file per stanza; più agenti ci sono, più i
// mobili si stringono (fino a MAX_STATIONS, oltre non ci stanno più nella stanza).

/** Quante postazioni entrano al massimo in una stanza (2 file da 6). */
export const MAX_STATIONS = 12;
/** Postazioni della pianta quando non si sa quanti agenti ci sono (test, default). */
export const DEFAULT_STATIONS = 4;
/** Larghezza utile in x su cui si distribuiscono le postazioni di una fila. */
const STATION_SPAN = 9.6;
/** Spazio minimo tra due mobili vicini della stessa fila. */
const STATION_GAP = 0.6;
/** Dal mobile al posto a sedere, verso il davanti della stanza. */
const SEAT_OFFSET = 1.55;

/** Una postazione: il mobile e il posto a sedere davanti. */
interface Station {
  rect: Rect;
  seat: Vec2;
}

/**
 * `n` postazioni in due file (z = `rows`), centrate in `cx`. La prima fila prende la
 * metà arrotondata per eccesso; ogni fila è centrata. `fullW` è la larghezza piena del
 * mobile, che si stringe quando la fila è affollata.
 */
function stations(n: number, cx: number, rows: [number, number], fullW: number, depth: number): Station[] {
  const perRow = [Math.ceil(n / 2), Math.floor(n / 2)];
  const cols = perRow[0];
  if (cols === 0) return [];
  const pitch = STATION_SPAN / cols;
  const w = Math.min(fullW, pitch - STATION_GAP);
  const out: Station[] = [];
  perRow.forEach((count, r) => {
    const z = rows[r];
    for (let i = 0; i < count; i++) {
      const x = cx + (i - (count - 1) / 2) * pitch;
      out.push({ rect: box(x, z, w, depth), seat: [x, z + SEAT_OFFSET] });
    }
  });
  return out;
}

/** Le postazioni delle tre stanze di lavoro per `n` agenti (vedi `house`). */
function workStations(n: number): Record<"biblioteca" | "officina" | "laboratorio", Station[]> {
  return {
    // tavoli da lettura: la prima fila lascia spazio agli scaffali contro il fondo
    biblioteca: stations(n, COLUMN_X[0], [-6.3, -2.9], 4, 1.2),
    // scrivanie con monitor
    officina: stations(n, COLUMN_X[1], [-7.85, -3.95], 2.4, 1.3),
    // banconi; il rack dei server resta a destra
    laboratorio: stations(n, COLUMN_X[2], [-7.85, -3.95], 2.4, 1.3),
  };
}

/** Le due librerie della Biblioteca, contro la parete di fondo (fisse). */
export const SHELVES: Rect[] = [box(-14.5, -8.55, 2.4, 0.7), box(-10.5, -8.55, 2.4, 0.7)];
/** Il rack dei server del Laboratorio (fisso). */
export const SERVER_RACK: Rect = box(18.95, -4.5, 0.7, 3);

// I mobili fissi delle altre stanze (gli ingombri: decorazioni piccole come piante o
// cartelli non bloccano). Il disegno in Rooms.tsx li legge da qui, nello stesso ordine.
const FIXED_FURNITURE = {
  // divano, tavolino, poltrona e macchinetta del caffè nell'angolo
  salotto: [box(-16.5, 3.7, 3, 1.4), box(-16.5, 5.6, 1.6, 1), box(-11.8, 5.7, 1.4, 1.4), box(-18.8, 1.3, 0.8, 1)],
  // banco con lo schermo grande contro la parete davanti, due panche per chi aspetta
  revisioni: [box(0, 7.95, 3.2, 1.3), box(-3, 3, 3, 0.8), box(3, 3, 3, 0.8)],
  camera: BEDS.map(bedRect),
};

const FIXED_SEATS = {
  // il primo posto è davanti alla macchinetta del caffè (animazione «caffè»)
  salotto: [[-17.6, 1.6], [-14.2, 2.2], [-16.5, 7.3], [-13.5, 7.3], [-10, 7.3], [-10, 2.2]] as Vec2[],
  // davanti alle panche, verso il banco: due file da quattro
  revisioni: [[-4, 4.2], [-2, 4.2], [2, 4.2], [4, 4.2], [-4, 5.6], [-2, 5.6], [2, 5.6], [4, 5.6]] as Vec2[],
  camera: BEDS,
};

const BOUNDS: Rect = { minX: ROOM.minX, maxX: ROOM.maxX, minZ: ROOM.minZ, maxZ: ROOM.maxZ };

function buildHouse(n: number): HouseLayout {
  const work = workStations(n);
  const seatsOf = (st: Station[]) => st.map((s) => s.seat);
  const rectsOf = (st: Station[]) => st.map((s) => s.rect);
  const seats: Record<RoomId, Vec2[]> = {
    biblioteca: seatsOf(work.biblioteca),
    officina: seatsOf(work.officina),
    laboratorio: seatsOf(work.laboratorio),
    ...FIXED_SEATS,
  };
  const furniture: Record<RoomId, Rect[]> = {
    biblioteca: [...SHELVES, ...rectsOf(work.biblioteca)],
    officina: rectsOf(work.officina),
    laboratorio: [...rectsOf(work.laboratorio), SERVER_RACK],
    ...FIXED_FURNITURE,
  };
  const zones: RoomZone[] = [
    { id: "biblioteca", label: "Biblioteca", sublabel: "Lettura e ricerca", position: seats.biblioteca[0] },
    { id: "officina", label: "Officina", sublabel: "Scrittura del codice", position: seats.officina[0] },
    { id: "laboratorio", label: "Laboratorio", sublabel: "Test e CI", position: seats.laboratorio[0] },
    { id: "salotto", label: "Salotto", sublabel: "Pausa", position: seats.salotto[1] },
    { id: "revisioni", label: "Reparto revisioni", sublabel: "Push, merge e file da confermare", position: seats.revisioni[0] },
    { id: "camera", label: "Camera", sublabel: "Riposo", position: [13, 2] },
  ];
  return {
    bounds: BOUNDS,
    width: ROOM_WIDTH,
    depth: ROOM_DEPTH,
    centerX: (ROOM.minX + ROOM.maxX) / 2,
    walls: WALLS,
    rooms: ROOMS,
    zones,
    zoneById: Object.fromEntries(zones.map((z) => [z.id, z])),
    seats,
    furniture,
    beds: BEDS,
    obstacles: [...WALLS, ...Object.values(furniture).flat()],
  };
}

/** Postazioni per `agents` agenti: almeno una (così ogni stanza ha un posto), al massimo MAX_STATIONS. */
export function stationCount(agents: number): number {
  return Math.min(MAX_STATIONS, Math.max(1, Math.floor(agents)));
}

const LAYOUTS = new Map<number, HouseLayout>();

/**
 * La pianta della casa con una postazione per agente in Biblioteca, Officina e
 * Laboratorio. Stanze e muri non cambiano; la stessa `n` dà sempre lo stesso oggetto
 * (niente ricalcoli a ogni render).
 */
export function house(agents: number = DEFAULT_STATIONS): HouseLayout {
  const n = stationCount(agents);
  let layout = LAYOUTS.get(n);
  if (!layout) {
    layout = buildHouse(n);
    LAYOUTS.set(n, layout);
  }
  return layout;
}

/** Ostacoli della casa (per i test del pathfinder). */
export const OBSTACLES: Rect[] = house().obstacles;

/** Dove compaiono gli agenti nuovi: nel Salotto, vicino alla porta d'ingresso. */
export const SPAWN_POINT: Vec2 = [-13, 7.5];

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
export function randomRoomPoint(room: RoomId, layout: HouseLayout = house()): Vec2 {
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

/** Agents sleep at night: 23:00–07:00 local time. */
export function isNightNow(): boolean {
  const h = new Date().getHours();
  return h >= 23 || h < 7;
}
