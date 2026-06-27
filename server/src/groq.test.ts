import { describe, expect, it } from "vitest";
import { groqModel } from "./groq";

describe("groqModel", () => {
  it("returns the default llama model when settings model is not llama-prefixed", () => {
    // groqModel() falls back to DEFAULT when the stored model is a Gemini model.
    const m = groqModel();
    expect(m).toMatch(/^llama/);
  });

  it("returns a non-empty string", () => {
    expect(groqModel().length).toBeGreaterThan(0);
  });
});
