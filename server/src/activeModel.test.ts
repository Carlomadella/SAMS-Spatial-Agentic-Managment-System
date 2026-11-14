import { beforeEach, describe, expect, it, vi } from "vitest";

const settings = { provider: "gemini", model: "" };
vi.mock("./config", async (orig) => ({
  ...(await orig<typeof import("./config")>()),
  getSettings: () => settings,
}));

import { activeModel } from "./activeModel";

describe("activeModel — il modello usato davvero dal provider attivo", () => {
  beforeEach(() => {
    settings.provider = "gemini";
    settings.model = "";
  });

  it("OpenRouter con un id Gemini salvato → il default :free di OpenRouter, non l'id Gemini", () => {
    settings.provider = "openrouter";
    settings.model = "gemini-2.5-flash";
    expect(activeModel()).toMatch(/\/.*:free$/);
  });

  it("OpenRouter con un id valido → quell'id", () => {
    settings.provider = "openrouter";
    settings.model = "meta-llama/llama-3.3-70b-instruct:free";
    expect(activeModel()).toBe("meta-llama/llama-3.3-70b-instruct:free");
  });

  it("Gemini con un modello non Gemini → gemini-2.5-flash", () => {
    settings.model = "gpt-4o";
    expect(activeModel()).toBe("gemini-2.5-flash");
  });

  it("Groq e OpenAI ripiegano sui loro default", () => {
    settings.model = "gemini-2.5-flash";
    settings.provider = "groq";
    expect(activeModel()).toMatch(/^llama/);
    settings.provider = "openai";
    expect(activeModel()).toMatch(/^gpt-/);
  });

  it("Claude passa il valore così com'è", () => {
    settings.provider = "claude";
    settings.model = "claude-sonnet-4-6";
    expect(activeModel()).toBe("claude-sonnet-4-6");
  });
});
