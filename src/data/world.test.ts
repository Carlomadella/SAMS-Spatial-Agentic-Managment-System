import { describe, expect, it } from "vitest";
import { findPath, isPointClear } from "../lib/pathfind";
import type { RoomId } from "../lib/roomFor";
import { OBSTACLES, ROOM, SPAWN_POINT, clampToRoom, house } from "./world";

// Stanze iconiche (23/11): una casa fissa di 6 stanze, niente ali.
//   Biblioteca | Officina          | Laboratorio   (dietro, z < 0)
//   Salotto    | Reparto revisioni | Camera        (davanti, z > 0)
const L = house();
const centre = (id: RoomId): [number, number] => {
  const r = L.rooms[id];
  return [(r.minX + r.maxX) / 2, (r.minZ + r.maxZ) / 2];
};
const ALL: RoomId[] = ["biblioteca", "officina", "laboratorio", "salotto", "revisioni", "camera"];

describe("la pianta di sei stanze", () => {
  it("ha esattamente le sei stanze", () => {
    expect(Object.keys(L.rooms).sort()).toEqual([...ALL].sort());
  });

  it("le stanze sono disposte 3 × 2 come deciso", () => {
    const [bx, bz] = centre("biblioteca");
    const [ox, oz] = centre("officina");
    const [lx, lz] = centre("laboratorio");
    const [sx, sz] = centre("salotto");
    const [rx, rz] = centre("revisioni");
    const [cx, cz] = centre("camera");
    for (const z of [bz, oz, lz]) expect(z).toBeLessThan(0);
    for (const z of [sz, rz, cz]) expect(z).toBeGreaterThan(0);
    expect(bx).toBeLessThan(ox);
    expect(ox).toBeLessThan(lx);
    expect(sx).toBeLessThan(rx);
    expect(rx).toBeLessThan(cx);
    expect(Math.abs(ox)).toBeLessThan(0.5);
  });

  it("i confini sono quelli della casa intera", () => {
    expect(ROOM).toMatchObject({ minX: -19.5, maxX: 19.5, minZ: -9, maxZ: 9, wallHeight: 3.2 });
    expect(L.bounds).toEqual({ minX: ROOM.minX, maxX: ROOM.maxX, minZ: ROOM.minZ, maxZ: ROOM.maxZ });
  });

  it("una zona per stanza, con lo stesso id", () => {
    expect(L.zones.map((z) => z.id).sort()).toEqual([...ALL].sort());
  });

  it("sei letti, tutti in Camera", () => {
    expect(L.beds).toHaveLength(6);
    const r = L.rooms.camera;
    for (const [x, z] of L.beds) {
      expect(x).toBeGreaterThan(r.minX);
      expect(x).toBeLessThan(r.maxX);
      expect(z).toBeGreaterThan(r.minZ);
      expect(z).toBeLessThan(r.maxZ);
    }
  });

  it("ogni stanza tranne la Camera ha almeno 4 posti, liberi da muri e mobili", () => {
    for (const id of ALL.filter((r) => r !== "camera")) {
      expect(L.seats[id].length).toBeGreaterThanOrEqual(4);
      for (const s of L.seats[id]) expect(isPointClear(s, L.obstacles)).toBe(true);
    }
  });

  it("dal Salotto si arriva a ogni posto e vicino a ogni letto", () => {
    const start = centre("salotto");
    for (const id of ALL.filter((r) => r !== "camera")) {
      for (const goal of L.seats[id]) {
        const path = findPath(start, goal, L.obstacles, { bounds: L.bounds });
        expect(path.length).toBeGreaterThan(0);
        const last = path[path.length - 1];
        expect(Math.hypot(last[0] - goal[0], last[1] - goal[1])).toBeLessThan(0.8);
      }
    }
    for (const bed of L.beds) {
      const path = findPath(start, bed, L.obstacles, { bounds: L.bounds });
      expect(path.length).toBeGreaterThan(0);
      const last = path[path.length - 1];
      expect(Math.hypot(last[0] - bed[0], last[1] - bed[1])).toBeLessThan(2.2);
    }
  });

  it("si nasce nel Salotto, in un punto libero", () => {
    const r = L.rooms.salotto;
    expect(SPAWN_POINT[0]).toBeGreaterThan(r.minX);
    expect(SPAWN_POINT[0]).toBeLessThan(r.maxX);
    expect(SPAWN_POINT[1]).toBeGreaterThan(r.minZ);
    expect(SPAWN_POINT[1]).toBeLessThan(r.maxZ);
    expect(isPointClear(SPAWN_POINT, L.obstacles)).toBe(true);
  });

  it("sempre la stessa pianta (niente ricalcoli a ogni render)", () => {
    expect(house()).toBe(house());
    expect(OBSTACLES).toBe(L.obstacles);
  });
});

describe("clampToRoom", () => {
  it("lascia invariato un punto interno", () => {
    expect(clampToRoom([1, 2])).toEqual([1, 2]);
  });

  // Mondi salvati con la casa vecchia: agenti in un'ala a destra o nel vecchio reparto.
  it("riporta dentro i punti delle ali che non ci sono più", () => {
    for (const p of [[30, 0], [-25, 0], [0, 40]] as [number, number][]) {
      const [x, z] = clampToRoom(p);
      expect(x).toBeGreaterThanOrEqual(L.bounds.minX);
      expect(x).toBeLessThanOrEqual(L.bounds.maxX);
      expect(z).toBeGreaterThanOrEqual(L.bounds.minZ);
      expect(z).toBeLessThanOrEqual(L.bounds.maxZ);
    }
  });
});
