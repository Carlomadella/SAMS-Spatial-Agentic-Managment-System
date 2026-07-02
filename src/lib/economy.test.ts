import { describe, expect, it } from "vitest";
import {
  balanceOf,
  coinsForCompletion,
  COIN_BASE,
  COIN_RESULT_BONUS,
  earnCoins,
  formatCoins,
  wealthRanking,
  type Wallets,
} from "./economy";

describe("coinsForCompletion", () => {
  it("pays the base, plus a bonus for a concrete result", () => {
    expect(coinsForCompletion({ hasResult: false })).toBe(COIN_BASE);
    expect(coinsForCompletion({ hasResult: true })).toBe(COIN_BASE + COIN_RESULT_BONUS);
  });
});

describe("earnCoins", () => {
  it("accumulates immutably", () => {
    const w0: Wallets = {};
    const w1 = earnCoins(w0, "a", 15);
    const w2 = earnCoins(w1, "a", 50);
    expect(w0).toEqual({});
    expect(w2.a).toBe(65);
  });

  it("ignores non-positive amounts and empty ids", () => {
    expect(earnCoins({}, "a", 0)).toEqual({});
    expect(earnCoins({}, "a", -5)).toEqual({});
    expect(earnCoins({}, "", 10)).toEqual({});
  });
});

describe("balanceOf", () => {
  it("defaults to 0", () => {
    expect(balanceOf({ a: 30 }, "a")).toBe(30);
    expect(balanceOf({}, "z")).toBe(0);
  });
});

describe("wealthRanking", () => {
  it("ranks by coins, then name", () => {
    const wallets: Wallets = { a: 50, b: 50, c: 100 };
    const agents = [
      { id: "a", name: "zoe" },
      { id: "b", name: "ada" },
      { id: "c", name: "max" },
    ];
    expect(wealthRanking(wallets, agents).map((r) => r.name)).toEqual(["max", "ada", "zoe"]);
  });
});

describe("formatCoins", () => {
  it("compacts thousands", () => {
    expect(formatCoins(0)).toBe("0");
    expect(formatCoins(999)).toBe("999");
    expect(formatCoins(1500)).toBe("1.5k");
  });
});
