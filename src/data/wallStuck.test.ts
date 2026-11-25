import { describe, expect, it } from "vitest";
import { findPath, type Rect } from "../lib/pathfind";
import { freeFromWalls, house, insideWall, walkPath } from "./world";
import { useStore } from "../store/useStore";
import type { Vec2 } from "../types";

// Un agente fermo dentro un muro (segnalato il 25/11): non deve succedere mai più.

const layout = house();
const walls = layout.walls;
/** Il segmento a→b attraversa un muro? (campionato ogni 5 cm) */
function crossesWall(a: Vec2, b: Vec2): boolean {
  const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.05);
  for (let i = 0; i <= n; i++) {
    const t = i / Math.max(1, n);
    if (insideWall([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], walls)) return true;
  }
  return false;
}
function pathCrossesWall(start: Vec2, wps: Vec2[]): boolean {
  let prev = start;
  for (const w of wps) {
    if (crossesWall(prev, w)) return true;
    prev = w;
  }
  return false;
}

/** Punti dentro i muri interni (muro verticale a x = 6,5, muro tra le file a z = 0). */
const IN_WALLS: Vec2[] = [[6.5, -7], [-6.5, 7.5], [6.5, 0], [-3, 0], [10, 0.05]];

describe("agente nel muro", () => {
  it("i punti di prova sono davvero dentro un muro", () => {
    for (const p of IN_WALLS) expect(insideWall(p, walls)).toBe(true);
  });

  it("freeFromWalls porta fuori dal muro, vicino, e lascia stare chi è già fuori", () => {
    for (const p of IN_WALLS) {
      const q = freeFromWalls(p, layout);
      expect(insideWall(q, walls)).toBe(false);
      expect(Math.hypot(q[0] - p[0], q[1] - p[1])).toBeLessThan(1.2);
    }
    expect(freeFromWalls([-13, 5], layout)).toEqual([-13, 5]);
    // il letto è un mobile, non un muro: chi dorme ci resta sopra
    expect(freeFromWalls(layout.beds[0], layout)).toEqual(layout.beds[0]);
  });

  it("un clic sul muro non dà più una meta dentro il muro", () => {
    const a = useStore.getState().agents[0];
    for (const p of IN_WALLS) {
      useStore.getState().moveAgent(a.id, p);
      const t = useStore.getState().agents.find((x) => x.id === a.id)!.target!;
      expect(insideWall(t, walls)).toBe(false);
    }
  });

  it("partendo da dentro un muro, il cammino esce senza attraversare altri muri", () => {
    const start: Vec2 = [6.5, -7]; // dentro il muro tra Officina e Laboratorio
    const goal: Vec2 = [-13, 5]; // Salotto
    const wps = walkPath(start, goal, layout);
    // il primo passo è l'uscita dal muro; da lì in poi niente muri
    const exit = wps[0];
    expect(insideWall(exit, walls)).toBe(false);
    expect(Math.hypot(exit[0] - start[0], exit[1] - start[1])).toBeLessThan(1.2);
    expect(pathCrossesWall(exit, wps.slice(1))).toBe(false);
    expect(wps.at(-1)).toEqual(goal);
  });

  it("da una stanza all'altra non si attraversano mai i muri", () => {
    const pts: Vec2[] = [[-13, -5], [0, -5], [13, -5], [-13, 5], [0, 5], [13, 2]];
    for (const a of pts) for (const b of pts) {
      if (a === b) continue;
      expect(pathCrossesWall(a, findPath(a, b, layout.obstacles, { bounds: layout.bounds }))).toBe(false);
    }
  });

  it("insideWall: anche con ostacoli qualsiasi", () => {
    const w: Rect[] = [{ minX: 0, maxX: 1, minZ: 0, maxZ: 1 }];
    expect(insideWall([0.5, 0.5], w)).toBe(true);
    expect(insideWall([3, 3], w)).toBe(false);
  });
});
