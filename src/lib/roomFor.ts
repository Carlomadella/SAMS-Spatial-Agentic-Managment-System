// Stanze iconiche (23/11): in quale stanza sta ogni agente. Funzioni pure: le usa il
// simulatore del mondo (LifeBridge) per decidere dove mandare gli agenti.

import type { AgentStatus, Vec2 } from "../types";
import type { ActivityKind } from "../store/useStore";

export type RoomId = "biblioteca" | "officina" | "laboratorio" | "salotto" | "revisioni" | "camera";

/** Quanto resta almeno un agente in una stanza di lavoro prima di cambiarla. */
export const ROOM_HOLD_MS = 20_000;

const WORK_ROOM: Record<ActivityKind, RoomId> = { read: "biblioteca", write: "officina", test: "laboratorio" };

/**
 * La stanza giusta per un agente. `null` = resta dov'è (bloccato: il segnale rosso c'è già).
 * La fase conta solo mentre lavora: finito il task, una fase vecchia non lo trattiene.
 */
export function roomFor(a: { status: AgentStatus; activity?: ActivityKind }, night: boolean): RoomId | null {
  switch (a.status) {
    case "awaiting_approval":
      return "revisioni";
    case "working":
      return a.activity ? WORK_ROOM[a.activity] : "biblioteca";
    case "blocked":
      return null;
    default:
      return night ? "camera" : "salotto";
  }
}

/**
 * La stanza dopo questo controllo: si cambia solo dopo `ROOM_HOLD_MS` nella stanza attuale,
 * così chi alterna letture e scritture non corre avanti e indietro. `urgent` (attesa di
 * approvazione, fine del lavoro) cambia subito.
 */
export function nextRoom(current: RoomId | null, wanted: RoomId | null, since: number, now: number, urgent: boolean): RoomId | null {
  if (wanted === null || wanted === current) return current;
  if (current === null || urgent || now - since >= ROOM_HOLD_MS) return wanted;
  return current;
}

const TAKEN_RADIUS = 0.6;

/** Il primo posto non occupato; se sono tutti occupati, il primo (si condivide). */
export function pickSeat(seats: Vec2[], taken: Vec2[]): Vec2 {
  const free = seats.find((s) => !taken.some((t) => Math.hypot(t[0] - s[0], t[1] - s[1]) < TAKEN_RADIUS));
  return free ?? seats[0];
}
