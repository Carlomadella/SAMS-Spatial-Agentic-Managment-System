import { describe, expect, it } from "vitest";
import { forestSlots, FRONT_GAP } from "./forest";

/** Angolo in gradi 0..360 di uno slot (atan2 su z,x). */
function angleDeg(x: number, z: number): number {
  const a = (Math.atan2(z, x) * 180) / Math.PI;
  return (a + 360) % 360;
}

describe("forestSlots", () => {
  it("returns exactly n slots", () => {
    expect(forestSlots(0)).toHaveLength(0);
    expect(forestSlots(12)).toHaveLength(12);
  });

  it("is deterministic across calls", () => {
    expect(forestSlots(10)).toEqual(forestSlots(10));
  });

  it("keeps the frontal cone toward the camera clear", () => {
    const [lo, hi] = FRONT_GAP;
    for (const s of forestSlots(24)) {
      const ang = angleDeg(s.x, s.z);
      expect(ang <= lo || ang >= hi).toBe(true);
    }
  });

  it("places trees within a sensible radius and scale", () => {
    for (const s of forestSlots(18)) {
      const r = Math.hypot(s.x, s.z);
      expect(r).toBeGreaterThan(5);
      expect(r).toBeLessThan(14);
      expect(s.scale).toBeGreaterThanOrEqual(0.4);
      expect(s.scale).toBeLessThanOrEqual(1.3);
    }
  });

  it("pushes outer rings farther out than the first ring", () => {
    const slots = forestSlots(12, 6);
    const r0 = Math.hypot(slots[0].x, slots[0].z);
    const r7 = Math.hypot(slots[7].x, slots[7].z); // ring 1
    expect(r7).toBeGreaterThan(r0);
  });
});
