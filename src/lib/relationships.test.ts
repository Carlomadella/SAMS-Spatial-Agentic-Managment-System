import { describe, expect, it } from "vitest";
import {
  affinityBetween,
  affinityTier,
  bestFriend,
  bumpAffinity,
  pairKey,
  topPairs,
  type AffinityMap,
} from "./relationships";

describe("pairKey", () => {
  it("is order-independent", () => {
    expect(pairKey("a", "b")).toBe(pairKey("b", "a"));
    expect(pairKey("b", "a")).toBe("a|b");
  });
});

describe("bumpAffinity", () => {
  it("accumulates immutably", () => {
    const m0: AffinityMap = {};
    const m1 = bumpAffinity(m0, "a", "b");
    const m2 = bumpAffinity(m1, "b", "a", 2);
    expect(m0).toEqual({}); // unchanged
    expect(m2[pairKey("a", "b")]).toBe(3);
  });

  it("ignores self and empty ids", () => {
    const m = bumpAffinity({}, "a", "a");
    expect(m).toEqual({});
    expect(bumpAffinity({}, "", "b")).toEqual({});
  });
});

describe("affinityBetween", () => {
  it("reads regardless of order, 0 when unknown", () => {
    const m = bumpAffinity({}, "x", "y", 4);
    expect(affinityBetween(m, "y", "x")).toBe(4);
    expect(affinityBetween(m, "x", "z")).toBe(0);
    expect(affinityBetween(m, "x", "x")).toBe(0);
  });
});

describe("affinityTier", () => {
  it("labels by threshold", () => {
    expect(affinityTier(0)).toBe("sconosciuti");
    expect(affinityTier(1)).toBe("conoscenti");
    expect(affinityTier(2)).toBe("colleghi");
    expect(affinityTier(6)).toBe("amici");
    expect(affinityTier(12)).toBe("inseparabili");
  });
});

describe("bestFriend", () => {
  it("picks the highest positive affinity", () => {
    let m: AffinityMap = {};
    m = bumpAffinity(m, "a", "b", 3);
    m = bumpAffinity(m, "a", "c", 7);
    const bf = bestFriend(m, "a", ["b", "c", "d"]);
    expect(bf).toEqual({ id: "c", score: 7 });
  });

  it("returns null when there is no collaboration", () => {
    expect(bestFriend({}, "a", ["b", "c"])).toBeNull();
  });
});

describe("topPairs", () => {
  it("sorts pairs by score, strongest first", () => {
    let m: AffinityMap = {};
    m = bumpAffinity(m, "a", "b", 2);
    m = bumpAffinity(m, "c", "d", 9);
    m = bumpAffinity(m, "e", "f", 5);
    expect(topPairs(m, 2).map((p) => p.score)).toEqual([9, 5]);
  });
});
