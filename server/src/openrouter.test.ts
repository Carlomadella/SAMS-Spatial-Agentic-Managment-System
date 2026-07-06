import { describe, expect, it } from "vitest";
import { openrouterModel } from "./openrouter";

describe("openrouterModel", () => {
  it("falls back to a default :free model when the stored model is not an OpenRouter id", () => {
    // The default env model (e.g. a Gemini id, no "/") must not leak through.
    const m = openrouterModel();
    expect(m).toContain("/");
    expect(m).toMatch(/:free$/);
  });

  it("returns a non-empty string", () => {
    expect(openrouterModel().length).toBeGreaterThan(0);
  });
});
