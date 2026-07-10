import { describe, expect, it } from "vitest";
import { daynessAt, lampGain } from "./daylight";

const at = (h: number, m = 0) => new Date(2026, 6, 10, h, m, 0);

describe("daynessAt", () => {
  it("is 0 at midnight and peaks at noon", () => {
    expect(daynessAt(at(0))).toBeCloseTo(0, 5);
    expect(daynessAt(at(12))).toBeCloseTo(1, 5);
  });

  it("never goes negative while the sun is down", () => {
    for (const h of [0, 1, 2, 3, 21, 22, 23]) {
      expect(daynessAt(at(h))).toBeGreaterThanOrEqual(0);
    }
  });

  it("rises through the morning and falls through the evening", () => {
    expect(daynessAt(at(6))).toBeLessThan(daynessAt(at(9)));
    expect(daynessAt(at(9))).toBeLessThan(daynessAt(at(12)));
    expect(daynessAt(at(15))).toBeGreaterThan(daynessAt(at(18)));
  });
});

describe("lampGain", () => {
  it("is full at night and drops to the floor at noon", () => {
    expect(lampGain(0)).toBeCloseTo(1, 5);
    expect(lampGain(1)).toBeCloseTo(0.12, 5);
  });

  it("decreases monotonically as daylight grows", () => {
    expect(lampGain(0.2)).toBeGreaterThan(lampGain(0.5));
    expect(lampGain(0.5)).toBeGreaterThan(lampGain(0.8));
  });

  it("respects a custom floor and clamps out-of-range dayness", () => {
    expect(lampGain(1, 0.3)).toBeCloseTo(0.3, 5);
    expect(lampGain(-0.5)).toBeCloseTo(1, 5); // clamped to 0 → full
    expect(lampGain(2)).toBeCloseTo(0.12, 5); // clamped to 1 → floor
  });
});
