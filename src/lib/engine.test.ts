import { describe, expect, it } from "vitest";
import { engineLabel } from "./engine";
import { useStore } from "../store/useStore";

describe("engineLabel", () => {
  it("tre stati con testo e tono", () => {
    expect(engineLabel({ provider: "OpenRouter", mode: "ok", since: 0 })).toMatchObject({ text: "Motore: OpenRouter", tone: "ok" });
    expect(engineLabel({ provider: "Gemini", mode: "fallback", since: 0 })).toMatchObject({ text: "Motore: Gemini (riserva)", tone: "warn" });
    const bad = engineLabel({ provider: "OpenRouter", mode: "exhausted", since: 0 });
    expect(bad).toMatchObject({ text: "Motore: quote finite", tone: "bad" });
    expect(bad.title).toMatch(/⚙/);
  });

  it("l'evento engine aggiorna lo store senza toccare agenti né log", () => {
    const before = useStore.getState().events.length;
    useStore.getState().applyRemote({ agentId: "engine", engine: { provider: "Gemini", mode: "fallback", since: 5 } });
    expect(useStore.getState().engine).toEqual({ provider: "Gemini", mode: "fallback", since: 5 });
    expect(useStore.getState().events.length).toBe(before);
    expect(useStore.getState().agents.some((a) => a.id === "engine")).toBe(false);
  });
});
