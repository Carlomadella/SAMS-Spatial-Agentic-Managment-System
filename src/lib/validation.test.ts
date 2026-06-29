import { describe, expect, it } from "vitest";
import { hasUnfilledPlaceholders, isValidRepo } from "./validation";

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

describe("hasUnfilledPlaceholders", () => {
  it("detects an unfilled template placeholder", () => {
    expect(hasUnfilledPlaceholders('Scrivi una guida su {argomento} nella pagina "{pagina}"')).toBe(true);
    expect(hasUnfilledPlaceholders("Aggiungi test per {modulo}")).toBe(true);
  });

  it("returns false once placeholders are filled or absent", () => {
    expect(hasUnfilledPlaceholders('Scrivi una guida su React nella pagina "Note"')).toBe(false);
    expect(hasUnfilledPlaceholders("Correggi il bug del login")).toBe(false);
    expect(hasUnfilledPlaceholders("")).toBe(false);
  });

  it("ignores empty braces (not a placeholder)", () => {
    expect(hasUnfilledPlaceholders("usa interface{} in Go")).toBe(false);
  });
});
