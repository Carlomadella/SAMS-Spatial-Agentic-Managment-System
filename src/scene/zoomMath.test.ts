import { describe, expect, it } from "vitest";
import { easeToward, wheelPixels, zoomGoal, zoomTowards } from "./zoomMath";

describe("wheelPixels", () => {
  it("lascia i pixel come sono", () => {
    expect(wheelPixels(40, 0, false)).toBe(40);
  });
  it("converte righe e pagine in pixel", () => {
    expect(wheelPixels(3, 1, false)).toBe(48);
    expect(wheelPixels(0.25, 2, false)).toBe(200);
  });
  it("amplifica il pizzico del trackpad (ctrl + rotella), che manda passi piccoli", () => {
    expect(wheelPixels(2, 0, true)).toBe(16);
  });
  it("taglia gli scatti enormi di certe rotelle", () => {
    expect(wheelPixels(5000, 0, false)).toBe(250);
    expect(wheelPixels(-5000, 0, false)).toBe(-250);
  });
});

describe("zoomGoal", () => {
  it("rotella in giù allontana, in su avvicina", () => {
    expect(zoomGoal(20, 100, 9, 40)).toBeGreaterThan(20);
    expect(zoomGoal(20, -100, 9, 40)).toBeLessThan(20);
  });
  it("avanti e indietro dello stesso passo torna al punto di partenza", () => {
    expect(zoomGoal(zoomGoal(20, 120, 9, 40), -120, 9, 40)).toBeCloseTo(20, 10);
  });
  it("resta tra i limiti", () => {
    expect(zoomGoal(10, -5000, 9, 40)).toBe(9);
    expect(zoomGoal(39, 5000, 9, 40)).toBe(40);
  });
});

describe("zoomTowards", () => {
  it("avvicinandosi a metà distanza il centro fa metà strada verso il punto sotto il cursore", () => {
    expect(zoomTowards([0, 0], [10, -4], 20, 10)).toEqual([5, -2]);
  });
  it("allontanandosi il centro si scosta dal punto", () => {
    const [x] = zoomTowards([0, 0], [10, 0], 10, 20);
    expect(x).toBeLessThan(0);
  });
  it("senza cambio di distanza non si muove", () => {
    expect(zoomTowards([1, 2], [10, 0], 15, 15)).toEqual([1, 2]);
  });
});

describe("easeToward", () => {
  it("si avvicina alla meta senza superarla", () => {
    const v = easeToward(10, 20, 1 / 60);
    expect(v).toBeGreaterThan(10);
    expect(v).toBeLessThan(20);
  });
  it("due fotogrammi a 120 fps valgono uno a 60 fps", () => {
    expect(easeToward(easeToward(10, 20, 1 / 120), 20, 1 / 120)).toBeCloseTo(easeToward(10, 20, 1 / 60), 10);
  });
});
