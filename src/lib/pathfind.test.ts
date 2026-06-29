import { describe, expect, it } from "vitest";
import { findPath, type Rect } from "./pathfind";
import type { Vec2 } from "../types";
import { OBSTACLES } from "../data/world";

const bounds: Rect = { minX: -6, maxX: 6, minZ: -6, maxZ: 6 };

/** Sample points along the full route (start + waypoints) at a fine step. */
function sampleRoute(start: Vec2, waypoints: Vec2[], step = 0.1): Vec2[] {
  const pts: Vec2[] = [];
  let from = start;
  for (const to of waypoints) {
    const dist = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const n = Math.max(1, Math.ceil(dist / step));
    for (let i = 1; i <= n; i++) {
      pts.push([from[0] + ((to[0] - from[0]) * i) / n, from[1] + ((to[1] - from[1]) * i) / n]);
    }
    from = to;
  }
  return pts;
}

const inside = ([x, z]: Vec2, r: Rect) => x > r.minX && x < r.maxX && z > r.minZ && z < r.maxZ;

describe("findPath", () => {
  it("returns a straight shot to the goal when nothing is in the way", () => {
    expect(findPath([-4, 0], [4, 0], [], { bounds })).toEqual([[4, 0]]);
  });

  it("ignores obstacles that don't cross the straight line", () => {
    const aside: Rect = { minX: -1, maxX: 1, minZ: 3, maxZ: 5 };
    expect(findPath([-4, 0], [4, 0], [aside], { bounds })).toEqual([[4, 0]]);
  });

  it("routes around an obstacle that blocks the straight line", () => {
    const wall: Rect = { minX: -1, maxX: 1, minZ: -1, maxZ: 1 };
    const start: Vec2 = [-4, 0];
    const path = findPath(start, [4, 0], [wall], { bounds });

    // it had to detour, and it still ends exactly on the goal
    expect(path.length).toBeGreaterThan(1);
    expect(path[path.length - 1]).toEqual([4, 0]);

    // no sampled point along the route passes through the obstacle core
    for (const p of sampleRoute(start, path)) {
      expect(inside(p, wall)).toBe(false);
    }
  });

  it("always ends on the goal, even when boxed in (no grid path)", () => {
    // an obstacle wider than the bounds → unreachable on the grid → straight fallback
    const wall: Rect = { minX: -10, maxX: 10, minZ: -1, maxZ: 1 };
    const path = findPath([0, -4], [0, 4], [wall], { bounds });
    expect(path[path.length - 1]).toEqual([0, 4]);
  });

  it("steers around the real office furniture and reaches the goal", () => {
    // straight across the sofa/coffee-table cluster
    const path = findPath([4.5, 4.2], [-6.4, -3.4], OBSTACLES);
    expect(path[path.length - 1]).toEqual([-6.4, -3.4]);
    for (const p of sampleRoute([4.5, 4.2], path)) {
      for (const r of OBSTACLES) expect(inside(p, r)).toBe(false);
    }
  });
});
