// Stanze iconiche (23/11): i dati puri dietro cartelli e oggetti simbolo delle stanze.
// Rooms.tsx li disegna; qui stanno le regole, testabili senza three.

import type { FurniturePlacement } from "../lib/furnitureLayout";
import type { RoomId } from "../lib/roomFor";
import type { Agent } from "../types";

/** Il cartello di ogni stanza: icona e nome. */
export const ROOM_SIGNS: Record<RoomId, { icon: string; label: string }> = {
  biblioteca: { icon: "📚", label: "Biblioteca" },
  officina: { icon: "🛠️", label: "Officina" },
  laboratorio: { icon: "🧪", label: "Laboratorio" },
  salotto: { icon: "🛋️", label: "Salotto" },
  revisioni: { icon: "🔍", label: "Reparto revisioni" },
  camera: { icon: "🛏️", label: "Camera" },
};

/** Per quanto resta visibile l'esito dei test sulla lampada del Laboratorio. */
export const LAB_RESULT_MS = 60_000;

export type LampColor = "off" | "amber" | "green" | "red";

/** La lampada-semaforo: l'esito recente vince; altrimenti ambra se qualcuno ci lavora. */
export function labLamp(working: boolean, result: { result: "success" | "failure"; at: number } | null, now: number): LampColor {
  if (result && now - result.at < LAB_RESULT_MS) return result.result === "success" ? "green" : "red";
  return working ? "amber" : "off";
}

/** Quante cose aspettano una conferma (schermo del Reparto revisioni). */
export function pendingCount(agents: Agent[]): number {
  return agents.filter((a) => a.status === "awaiting_approval").length;
}

/** I mobili che si possono spostare a mano (solo Salotto e Camera). */
export const VALID_MOVABLE_IDS = new Set<string>([
  "salotto-tv",
  "salotto-plant",
  "salotto-lamp",
  ...[0, 1, 2, 3, 4, 5].map((i) => `camera-bed-${i}`),
  "camera-sideboard",
  "camera-plant",
]);

/** Le posizioni salvate dei soli mobili che esistono ancora (le altre si ignorano). */
export function knownPlacements(placements: Record<string, FurniturePlacement>): Record<string, FurniturePlacement> {
  return Object.fromEntries(Object.entries(placements).filter(([id]) => VALID_MOVABLE_IDS.has(id)));
}
