import { describe, expect, it } from "vitest";
import type { GardenState, Stage } from "./garden";
import {
  buildTeamGarden,
  memberScore,
  teamStageFromGrowth,
  STAGE_ORDER,
} from "./teamGarden";

function g(over: Partial<GardenState> & { user: string }): GardenState {
  return {
    user: over.user,
    waterings: 0,
    streak: 0,
    lastWateredDate: null,
    lastSeen: null,
    stage: "seed",
    growth: 0,
    thirsty: false,
    updatedAt: "",
    ...over,
  };
}

describe("memberScore", () => {
  it("weights waterings, streak and growth", () => {
    expect(memberScore({ waterings: 3, streak: 2, growth: 40 })).toBe(30 + 10 + 40);
  });
});

describe("teamStageFromGrowth", () => {
  it("maps growth bands to stages, ascending", () => {
    expect(teamStageFromGrowth(0)).toBe("seed");
    expect(teamStageFromGrowth(9)).toBe("seed");
    expect(teamStageFromGrowth(10)).toBe("sprout");
    expect(teamStageFromGrowth(30)).toBe("sapling");
    expect(teamStageFromGrowth(55)).toBe("bush");
    expect(teamStageFromGrowth(80)).toBe("tree");
    expect(teamStageFromGrowth(100)).toBe("blooming");
  });

  it("never returns a stage outside the known order", () => {
    for (let v = 0; v <= 100; v += 7) {
      expect(STAGE_ORDER).toContain(teamStageFromGrowth(v) as Stage);
    }
  });
});

describe("buildTeamGarden", () => {
  it("returns an empty, seed-stage team for no members", () => {
    const t = buildTeamGarden([]);
    expect(t.members).toBe(0);
    expect(t.totalWaterings).toBe(0);
    expect(t.avgGrowth).toBe(0);
    expect(t.teamStage).toBe("seed");
    expect(t.ranking).toEqual([]);
  });

  it("aggregates totals, average growth and best streak", () => {
    const t = buildTeamGarden([
      g({ user: "ada", waterings: 10, growth: 80, streak: 4, stage: "tree" }),
      g({ user: "linus", waterings: 6, growth: 40, streak: 9, stage: "sapling", thirsty: true }),
    ]);
    expect(t.members).toBe(2);
    expect(t.totalWaterings).toBe(16);
    expect(t.avgGrowth).toBe(60); // (80+40)/2
    expect(t.bestStreak).toBe(9);
    expect(t.thirsty).toBe(1);
    expect(t.teamStage).toBe("bush"); // 60 → bush
    expect(t.stageCounts.tree).toBe(1);
    expect(t.stageCounts.sapling).toBe(1);
  });

  it("ranks by score, then alphabetically on ties", () => {
    const t = buildTeamGarden([
      g({ user: "zoe", waterings: 5, growth: 0, streak: 0 }),
      g({ user: "ana", waterings: 5, growth: 0, streak: 0 }),
      g({ user: "max", waterings: 20, growth: 0, streak: 0 }),
    ]);
    expect(t.ranking.map((m) => m.user)).toEqual(["max", "ana", "zoe"]);
  });
});
