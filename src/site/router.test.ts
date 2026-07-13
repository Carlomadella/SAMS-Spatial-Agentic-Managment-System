import { describe, expect, it } from "vitest";
import { normalizePath } from "./router";

describe("normalizePath", () => {
  it("lascia la root invariata", () => {
    expect(normalizePath("/")).toBe("/");
  });

  it("toglie lo slash finale", () => {
    expect(normalizePath("/docs/")).toBe("/docs");
  });

  it("non tocca un percorso senza slash finale", () => {
    expect(normalizePath("/login")).toBe("/login");
  });

  it("percorso vuoto → root", () => {
    expect(normalizePath("")).toBe("/");
  });

  it("conserva i segmenti annidati", () => {
    expect(normalizePath("/docs/agenti/")).toBe("/docs/agenti");
  });
});
