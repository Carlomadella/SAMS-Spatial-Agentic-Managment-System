import { describe, expect, it } from "vitest";
import { clampPlacement, isPlaced, placedCount, type FurniturePlacement } from "./furnitureLayout";

const ROOM = { minX: -13, maxX: 13, minZ: -9, maxZ: 9 };

describe("clampPlacement", () => {
  it("lascia passare uno spostamento dentro i confini", () => {
    const p = clampPlacement([0, 0], [2, -1.5], ROOM);
    expect(p).toEqual({ dx: 2, dz: -1.5 });
  });

  it("clampa l'offset così il mobile resta dentro i muri (meno il margine)", () => {
    // base al centro, spinto ben oltre il muro destro (maxX 13, margine 0.7 → 12.3)
    const p = clampPlacement([0, 0], [100, 0], ROOM);
    expect(p.dx).toBeCloseTo(12.3, 3);
    expect(p.dz).toBe(0);
  });

  it("clampa su entrambi gli assi indipendentemente", () => {
    const p = clampPlacement([10, -8], [10, -10], ROOM);
    expect(p.dx).toBeCloseTo(2.3, 3); // 10 + 2.3 = 12.3
    expect(p.dz).toBeCloseTo(-0.3, 3); // -8 - 0.3 = -8.3 (minZ -9 + 0.7)
  });

  it("rispetta un margine personalizzato", () => {
    const p = clampPlacement([0, 0], [100, 0], ROOM, 2);
    expect(p.dx).toBeCloseTo(11, 3); // maxX 13 - 2
  });
});

describe("isPlaced", () => {
  it("è falso per assente o offset nullo", () => {
    expect(isPlaced(undefined)).toBe(false);
    expect(isPlaced(null)).toBe(false);
    expect(isPlaced({ dx: 0, dz: 0 })).toBe(false);
  });
  it("è vero appena c'è uno spostamento sensibile", () => {
    expect(isPlaced({ dx: 0.5, dz: 0 })).toBe(true);
    expect(isPlaced({ dx: 0, dz: -0.2 })).toBe(true);
  });
});

describe("placedCount", () => {
  it("conta solo i mobili davvero spostati", () => {
    const map: Record<string, FurniturePlacement> = {
      a: { dx: 1, dz: 0 },
      b: { dx: 0, dz: 0 },
      c: { dx: 0, dz: 2 },
    };
    expect(placedCount(map)).toBe(2);
  });
});
