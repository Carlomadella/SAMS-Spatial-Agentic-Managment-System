import { afterEach, describe, expect, it } from "vitest";
import { engineState, isQuotaExhausted, noteEngineExhausted, noteEngineSuccess, onEngineChange, resetEngineState } from "./engineState";

afterEach(() => resetEngineState());

describe("engineState", () => {
  it("principale → ok, riserva → fallback, quote finite → exhausted", () => {
    noteEngineSuccess("OpenRouter", "OpenRouter", 1);
    expect(engineState()).toEqual({ provider: "OpenRouter", mode: "ok", since: 1 });
    noteEngineSuccess("OpenRouter", "Gemini", 2);
    expect(engineState()).toMatchObject({ provider: "Gemini", mode: "fallback" });
    noteEngineExhausted("OpenRouter", 3);
    expect(engineState()).toMatchObject({ provider: "OpenRouter", mode: "exhausted", since: 3 });
  });

  it("avvisa solo ai cambi di stato", () => {
    const seen: string[] = [];
    onEngineChange((s) => seen.push(s.mode));
    noteEngineSuccess("OpenRouter", "OpenRouter");
    noteEngineSuccess("OpenRouter", "OpenRouter");
    noteEngineSuccess("OpenRouter", "Gemini");
    expect(seen).toEqual(["ok", "fallback"]);
  });

  it("riconosce la quota finita", () => {
    expect(isQuotaExhausted(new Error('OpenRouter 429: {"message":"Rate limit exceeded: free-models-per-day"}'))).toBe(true);
    expect(isQuotaExhausted(new Error("OpenRouter 429: Too Many Requests"))).toBe(false);
    expect(isQuotaExhausted(new Error("OpenRouter 401: no auth"))).toBe(false);
  });
});
