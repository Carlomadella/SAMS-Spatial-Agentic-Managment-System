/**
 * Calcoli puri per muovere la visuale: confini, scorciatoie delle stanze e tasti.
 * Niente React: li usa `CameraNav` e si testano da soli.
 */
import { MOUSE, TOUCH } from "three";
import type { HouseLayout } from "../data/world";
import type { Rect } from "../lib/pathfind";

/** Il punto (x, z) riportato dentro `bounds`. */
export function clampTarget(x: number, z: number, bounds: Rect): [number, number] {
  return [
    Math.min(bounds.maxX, Math.max(bounds.minX, x)),
    Math.min(bounds.maxZ, Math.max(bounds.minZ, z)),
  ];
}

export interface RoomShortcut {
  id: string;
  x: number;
  z: number;
}

/** Le stanze per i tasti 1–9: da sinistra a destra, a parità di colonna prima quella dietro. */
export function roomShortcuts(layout: HouseLayout): RoomShortcut[] {
  return Object.entries(layout.rooms)
    .map(([id, r]) => ({ id, x: (r.minX + r.maxX) / 2, z: (r.minZ + r.maxZ) / 2 }))
    .sort((a, b) => (Math.abs(a.x - b.x) > 0.5 ? a.x - b.x : a.z - b.z))
    .slice(0, 9);
}

export type NavAction =
  | { kind: "move"; dir: "forward" | "back" | "left" | "right" }
  | { kind: "rotate"; dir: -1 | 1 }
  | { kind: "zoom"; dir: -1 | 1 }
  | { kind: "room"; index: number }
  | { kind: "home" }
  | { kind: "follow" };

const KEYS: Record<string, NavAction> = {
  w: { kind: "move", dir: "forward" },
  arrowup: { kind: "move", dir: "forward" },
  s: { kind: "move", dir: "back" },
  arrowdown: { kind: "move", dir: "back" },
  a: { kind: "move", dir: "left" },
  arrowleft: { kind: "move", dir: "left" },
  d: { kind: "move", dir: "right" },
  arrowright: { kind: "move", dir: "right" },
  q: { kind: "rotate", dir: -1 },
  e: { kind: "rotate", dir: 1 },
  "+": { kind: "zoom", dir: -1 },
  "=": { kind: "zoom", dir: -1 },
  "-": { kind: "zoom", dir: 1 },
  _: { kind: "zoom", dir: 1 },
  h: { kind: "home" },
  f: { kind: "follow" },
};

/** L'azione di un tasto (`KeyboardEvent.key`), o null se il tasto non muove la visuale. */
export function keyToAction(key: string): NavAction | null {
  if (/^[1-9]$/.test(key)) return { kind: "room", index: Number(key) - 1 };
  return KEYS[key.toLowerCase()] ?? null;
}

/** Vero se l'utente sta scrivendo in un campo: lì i tasti non devono muovere la visuale. */
export function isTypingTarget(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  const ce = el.getAttribute("contenteditable");
  return ce !== null && ce !== "false";
}

/**
 * Mouse e touch stile mappe, per `<OrbitControls>`: il sinistro sposta sul pavimento,
 * il destro ruota, la rotella zooma; un dito sposta, due dita zoomano e ruotano.
 */
export const NAV_MOUSE_PROPS = {
  enablePan: true,
  screenSpacePanning: false,
  mouseButtons: { LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE },
  touches: { ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_ROTATE },
};

/** Vero se il puntatore si è mosso oltre `threshold` pixel: un trascinamento, non un clic. */
export function movedBeyond(ax: number, ay: number, bx: number, by: number, threshold = 6): boolean {
  return Math.hypot(bx - ax, by - ay) > threshold;
}

/** I tasti muovono la visuale solo se il focus è sulla pagina o sulla tela 3D (non su pannelli o finestre). */
export function isSceneKeyTarget(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return true;
  return el === document.body || el === document.documentElement || el.tagName === "CANVAS";
}

export interface FollowState {
  selected: string | null;
  follow: boolean;
}

/** Se parte il volo della telecamera: verso un agente selezionato o riagganciato, o al centro se si deselezionava mentre lo si seguiva. */
export function followTransition(prev: FollowState, next: FollowState): boolean {
  if (next.selected !== prev.selected) return next.selected !== null || prev.follow;
  return next.selected !== null && next.follow && !prev.follow;
}

/** Velocità del volo morbido: a 60 fps avanza del 12% a fotogramma. */
const FLIGHT_RATE = -60 * Math.log(0.88);

/** Quanto avanzare verso la meta in questo fotogramma, uguale a qualsiasi frequenza dello schermo. */
export function smoothFactor(delta: number): number {
  return 1 - Math.exp(-FLIGHT_RATE * delta);
}
