import { describe, expect, it } from "vitest";
import { planMoves, type RoomMemo } from "./roomMoves";
import { house } from "../data/world";
import { SEED_AGENTS } from "../data/seed";
import type { Agent, AgentStatus, Vec2 } from "../types";
import type { ActivityKind } from "../store/useStore";

// Stanze iconiche (23/11): chi si sposta, e dove, a ogni giro del simulatore.
const L = house();
const T0 = 1_000_000;

function agent(i: number, status: AgentStatus, position: Vec2 = [-13, 7.5]): Agent {
  return { ...SEED_AGENTS[i % SEED_AGENTS.length], id: `a${i}`, status, position, target: null };
}
const act = (kind: ActivityKind) => ({ kind, at: T0 });
const inRoom = (p: Vec2, room: keyof typeof L.rooms) => {
  const r = L.rooms[room];
  return p[0] >= r.minX && p[0] <= r.maxX && p[1] >= r.minZ && p[1] <= r.maxZ;
};

describe("planMoves", () => {
  it("chi legge va a un posto della Biblioteca", () => {
    const memo: RoomMemo = new Map();
    const moves = planMoves([agent(0, "working")], { a0: act("read") }, memo, false, T0);
    expect(moves).toHaveLength(1);
    expect(L.seats.biblioteca).toContainEqual(moves[0].to);
  });

  it("passa all'Officina solo dopo 20 secondi in Biblioteca", () => {
    const memo: RoomMemo = new Map();
    const a = agent(0, "working");
    const [first] = planMoves([a], { a0: act("read") }, memo, false, T0);
    const there = { ...a, position: first.to };
    expect(planMoves([there], { a0: act("write") }, memo, false, T0 + 5_000)).toEqual([]);
    const [later] = planMoves([there], { a0: act("write") }, memo, false, T0 + 25_000);
    expect(L.seats.officina).toContainEqual(later.to);
  });

  it("cinque agenti che leggono: quattro posti diversi, il quinto condivide il primo", () => {
    const agents = [0, 1, 2, 3, 4].map((i) => agent(i, "working"));
    const activity = Object.fromEntries(agents.map((a) => [a.id, act("read")]));
    const moves = planMoves(agents, activity, new Map(), false, T0);
    const spots = moves.map((m) => m.to.join(","));
    expect(new Set(spots.slice(0, 4)).size).toBe(4);
    expect(moves[4].to).toEqual(L.seats.biblioteca[0]);
  });

  it("chi aspetta un'approvazione va subito nel Reparto revisioni", () => {
    const memo: RoomMemo = new Map([["a0", { room: "officina", since: T0 }]]);
    const [m] = planMoves([agent(0, "awaiting_approval", L.seats.officina[0])], { a0: act("write") }, memo, false, T0 + 1_000);
    expect(L.seats.revisioni).toContainEqual(m.to);
  });

  it("di notte chi è libero va al suo letto (condiviso oltre il sesto)", () => {
    const agents = [0, 1, 2, 3, 4, 5, 6].map((i) => agent(i, "idle"));
    const moves = planMoves(agents, {}, new Map(), true, T0);
    expect(moves.find((m) => m.id === "a0")!.to).toEqual(L.beds[0]);
    expect(moves.find((m) => m.id === "a6")!.to).toEqual(L.beds[0]);
  });

  it("chi è già al suo posto non si muove", () => {
    const memo: RoomMemo = new Map();
    const a = agent(0, "working");
    const [m] = planMoves([a], { a0: act("read") }, memo, false, T0);
    expect(planMoves([{ ...a, position: m.to }], { a0: act("read") }, memo, false, T0 + 60_000)).toEqual([]);
  });

  it("di giorno chi è libero va in Salotto", () => {
    const [m] = planMoves([agent(0, "idle", L.seats.officina[0])], {}, new Map(), false, T0);
    expect(inRoom(m.to, "salotto")).toBe(true);
  });

  it("chi è bloccato resta dov'è", () => {
    expect(planMoves([agent(0, "blocked", L.seats.officina[0])], { a0: act("write") }, new Map(), false, T0)).toEqual([]);
  });

  it("chi sta già andando al posto giusto non riceve un'altra meta", () => {
    const memo: RoomMemo = new Map();
    const a = agent(0, "working");
    const [m] = planMoves([a], { a0: act("read") }, memo, false, T0);
    expect(planMoves([{ ...a, target: m.to }], { a0: act("read") }, memo, false, T0 + 5_000)).toEqual([]);
  });
});
