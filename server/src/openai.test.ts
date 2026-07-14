import { describe, expect, it } from "vitest";
import { openaiModel } from "./openai";

describe("openaiModel", () => {
  it("falls back to a default gpt model when the stored model is not an OpenAI id", () => {
    // The default env model (e.g. a Gemini id like "gemini-2.5-flash") must not leak through.
    const m = openaiModel();
    expect(m).toMatch(/^gpt-/);
  });

  it("returns a non-empty string", () => {
    expect(openaiModel().length).toBeGreaterThan(0);
  });
});
