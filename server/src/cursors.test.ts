import { describe, expect, it } from "vitest";
import { sanitizeCursor } from "./cursors";

describe("sanitizeCursor", () => {
  it("accepts a valid cursor", () => {
    expect(sanitizeCursor({ id: "v1", name: "Marco", x: 2, z: -3 })).toEqual({
      id: "v1",
      name: "Marco",
      x: 2,
      z: -3,
    });
  });

  it("rejects a missing or blank id", () => {
    expect(sanitizeCursor({ name: "x", x: 0, z: 0 })).toBeNull();
    expect(sanitizeCursor({ id: "   ", x: 0, z: 0 })).toBeNull();
  });

  it("rejects non-finite coordinates", () => {
    expect(sanitizeCursor({ id: "v", x: NaN, z: 0 })).toBeNull();
    expect(sanitizeCursor({ id: "v", x: 0, z: Infinity })).toBeNull();
    expect(sanitizeCursor({ id: "v", x: "nope", z: 0 })).toBeNull();
  });

  it("rejects non-object bodies", () => {
    expect(sanitizeCursor(null)).toBeNull();
    expect(sanitizeCursor("cursor")).toBeNull();
    expect(sanitizeCursor(42)).toBeNull();
  });

  it("clamps out-of-range coordinates to a sane world range", () => {
    const c = sanitizeCursor({ id: "v", x: 9999, z: -9999 })!;
    expect(c.x).toBe(60);
    expect(c.z).toBe(-60);
  });

  it("defaults a blank name and caps long id/name", () => {
    expect(sanitizeCursor({ id: "v", name: "  ", x: 0, z: 0 })!.name).toBe("Ospite");
    const c = sanitizeCursor({ id: "a".repeat(200), name: "b".repeat(200), x: 0, z: 0 })!;
    expect(c.id).toHaveLength(64);
    expect(c.name).toHaveLength(40);
  });
});
