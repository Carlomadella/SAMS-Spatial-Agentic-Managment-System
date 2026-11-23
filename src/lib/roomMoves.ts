// Stanze iconiche (23/11): a ogni giro del simulatore, chi deve spostarsi e dove.
// Pura: la chiama LifeBridge (Workspace.tsx), che poi fa camminare gli agenti.

import { house, type HouseLayout } from "../data/world";
import type { ActivityKind } from "../store/useStore";
import type { Agent, Vec2 } from "../types";
import { nextRoom, pickSeat, roomFor, type RoomId } from "./roomFor";

/** In quale stanza il simulatore ha messo ogni agente, e da quando (per la tenuta minima). */
export type RoomMemo = Map<string, { room: RoomId; since: number }>;

const NEAR = 0.6;
const near = (a: Vec2, b: Vec2) => Math.hypot(a[0] - b[0], a[1] - b[1]) < NEAR;
const inside = ([x, z]: Vec2, r: { minX: number; maxX: number; minZ: number; maxZ: number }) =>
  x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;

/**
 * Gli spostamenti da fare adesso. Aggiorna `memo`. Un agente che è già (o sta già andando)
 * dove deve stare non compare. Il letto è per indice (`idx % letti`), come prima.
 */
export function planMoves(
  agents: Agent[],
  activity: Record<string, { kind: ActivityKind; at: number }>,
  memo: RoomMemo,
  night: boolean,
  now: number,
  layout: HouseLayout = house(),
): { id: string; to: Vec2 }[] {
  const moves: { id: string; to: Vec2 }[] = [];
  // posti già presi: dove sono o stanno andando gli altri
  const taken: Vec2[] = agents.map((a) => a.target ?? a.position);

  agents.forEach((a, idx) => {
    const wanted = roomFor({ status: a.status, activity: activity[a.id]?.kind }, night);
    const prev = memo.get(a.id);
    const urgent = wanted === "revisioni" || a.status !== "working";
    const room = nextRoom(prev?.room ?? null, wanted, prev?.since ?? now, now, urgent);
    if (room === null) return; // bloccato: resta dov'è
    if (room !== prev?.room) memo.set(a.id, { room, since: now });

    const here = a.target ?? a.position;
    let to: Vec2;
    if (room === "camera") {
      to = layout.beds[idx % layout.beds.length];
      if (near(here, to)) return;
    } else if (room === "salotto") {
      // chi è libero può stare ovunque nel Salotto (ci gira dentro)
      if (inside(here, layout.rooms.salotto)) return;
      to = pickSeat(layout.seats.salotto, taken.filter((_, i) => i !== idx));
    } else {
      if (layout.seats[room].some((s) => near(here, s))) return;
      to = pickSeat(layout.seats[room], taken.filter((_, i) => i !== idx));
    }
    taken[idx] = to;
    moves.push({ id: a.id, to });
  });
  return moves;
}
