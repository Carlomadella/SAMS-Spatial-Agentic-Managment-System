import { describe, expect, it } from "vitest";
import { emptyGarden, growthFor, stageFor, water } from "./model";

describe("stageFor", () => {
  it("maps waterings to the right stage at thresholds", () => {
    expect(stageFor(0)).toBe("seed");
    expect(stageFor(1)).toBe("sprout");
    expect(stageFor(5)).toBe("sprout");
    expect(stageFor(6)).toBe("sapling");
    expect(stageFor(15)).toBe("bush");
    expect(stageFor(30)).toBe("tree");
    expect(stageFor(60)).toBe("blooming");
    expect(stageFor(999)).toBe("blooming");
  });
});

describe("growthFor", () => {
  it("is 0 at a stage's threshold and grows toward the next", () => {
    expect(growthFor(0)).toBe(0); // start of seed (0→1)
    expect(growthFor(6)).toBe(0); // start of sapling (6→15)
    expect(growthFor(10)).toBeGreaterThan(0);
    expect(growthFor(10)).toBeLessThan(100);
  });
  it("is 100 once blooming", () => {
    expect(growthFor(60)).toBe(100);
    expect(growthFor(120)).toBe(100);
  });
});

describe("water", () => {
  it("adds waterings and advances the stage", () => {
    const g = water(emptyGarden("alice"), 6, "2026-01-01T00:00:00Z", "2026-01-01");
    expect(g.waterings).toBe(6);
    expect(g.stage).toBe("sapling");
    expect(g.thirsty).toBe(false);
    expect(g.lastSeen).toBe("2026-01-01T00:00:00Z");
  });

  it("starts a streak, keeps it same-day, increments next-day, resets after a gap", () => {
    let g = water(emptyGarden("bob"), 1, "2026-01-01T09:00:00Z", "2026-01-01");
    expect(g.streak).toBe(1);
    g = water(g, 1, "2026-01-01T18:00:00Z", "2026-01-01"); // same day
    expect(g.streak).toBe(1);
    g = water(g, 1, "2026-01-02T10:00:00Z", "2026-01-02"); // next day
    expect(g.streak).toBe(2);
    g = water(g, 1, "2026-01-05T10:00:00Z", "2026-01-05"); // 3-day gap
    expect(g.streak).toBe(1);
  });

  it("with no new waterings only updates thirst, not counts", () => {
    const base = water(emptyGarden("carol"), 3, "2026-01-01T00:00:00Z", "2026-01-01");
    const sameDay = water(base, 0, base.lastSeen, "2026-01-01");
    expect(sameDay.waterings).toBe(3);
    expect(sameDay.thirsty).toBe(false); // watered today
    const laterDay = water(base, 0, base.lastSeen, "2026-01-03");
    expect(laterDay.waterings).toBe(3);
    expect(laterDay.thirsty).toBe(true); // not watered today
  });
});
