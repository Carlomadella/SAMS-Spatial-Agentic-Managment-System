import { describe, expect, it } from "vitest";
import { levelFromXp, LEVELS, XP_PER_TASK } from "./skill";

describe("levelFromXp", () => {
  it("starts at level 1 (Novizio) with zero progress", () => {
    const l = levelFromXp(0);
    expect(l.level).toBe(1);
    expect(l.name).toBe("Novizio");
    expect(l.xpIntoLevel).toBe(0);
    expect(l.xpForNext).toBe(60);
    expect(l.progress).toBe(0);
  });

  it("crosses to the next rank exactly at its threshold", () => {
    expect(levelFromXp(59).level).toBe(1);
    const l = levelFromXp(60);
    expect(l.level).toBe(2);
    expect(l.name).toBe("Apprendista");
    expect(l.xpIntoLevel).toBe(0);
  });

  it("reports fractional progress within a level", () => {
    // level 2 spans 60..150 (90 XP); 105 XP → 45/90 = 0.5
    expect(levelFromXp(105).progress).toBeCloseTo(0.5, 5);
  });

  it("caps at the top rank with full progress and no next", () => {
    const l = levelFromXp(99999);
    expect(l.level).toBe(LEVELS.length);
    expect(l.name).toBe("Maestro");
    expect(l.xpForNext).toBeNull();
    expect(l.progress).toBe(1);
  });

  it("clamps negative/garbage XP to level 1", () => {
    expect(levelFromXp(-100).level).toBe(1);
  });

  it("two completed tasks (XP_PER_TASK each) reach Apprendista", () => {
    expect(levelFromXp(XP_PER_TASK * 2).level).toBe(2);
  });
});
