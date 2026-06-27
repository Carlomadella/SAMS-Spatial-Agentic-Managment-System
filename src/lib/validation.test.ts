import { describe, expect, it } from "vitest";
import { isValidRepo } from "./validation";

describe("isValidRepo", () => {
  it("accepts a well-formed owner/repo slug", () => {
    expect(isValidRepo("Carlomadella/SAMS")).toBe(true);
    expect(isValidRepo("owner/repo")).toBe(true);
    expect(isValidRepo("a.b-c/d_e.f")).toBe(true);
    expect(isValidRepo("  owner/repo  ")).toBe(true); // trimmed
  });

  it("rejects missing or extra path segments", () => {
    expect(isValidRepo("owner")).toBe(false);
    expect(isValidRepo("owner/repo/extra")).toBe(false);
    expect(isValidRepo("")).toBe(false);
  });

  it("rejects spaces and illegal characters", () => {
    expect(isValidRepo("owner /repo")).toBe(false);
    expect(isValidRepo("owner/repo name")).toBe(false);
    expect(isValidRepo("owner/")).toBe(false);
  });
});
