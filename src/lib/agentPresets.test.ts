import { describe, it, expect } from "vitest";
import { addPreset, removePreset, MAX_PRESETS } from "./agentPresets";
import type { AgentTemplate } from "./agentTemplates";

const preset = (id: string, name: string): AgentTemplate => ({
  id,
  name,
  emoji: "⭐",
  description: "",
  role: "Generalist",
  model: "Claude Opus",
  instructions: "istruzioni",
});

describe("addPreset", () => {
  it("inserisce in testa (più recente per primo)", () => {
    const list = addPreset(addPreset([], preset("a", "Alfa")), preset("b", "Beta"));
    expect(list.map((p) => p.id)).toEqual(["b", "a"]);
  });

  it("sostituisce un preset con lo stesso nome (case/spazi ignorati)", () => {
    const list = addPreset([preset("a", "Bug Hunter")], preset("b", "  bug hunter "));
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("b");
  });

  it("cappa la lista a MAX_PRESETS", () => {
    let list: AgentTemplate[] = [];
    for (let i = 0; i < MAX_PRESETS + 5; i++) list = addPreset(list, preset(`id${i}`, `Preset ${i}`));
    expect(list).toHaveLength(MAX_PRESETS);
    // il più recente resta, il più vecchio è caduto fuori
    expect(list[0].name).toBe(`Preset ${MAX_PRESETS + 4}`);
    expect(list.some((p) => p.name === "Preset 0")).toBe(false);
  });

  it("non muta la lista originale", () => {
    const orig = [preset("a", "Alfa")];
    addPreset(orig, preset("b", "Beta"));
    expect(orig).toHaveLength(1);
  });
});

describe("removePreset", () => {
  it("rimuove per id e lascia il resto", () => {
    const list = [preset("a", "Alfa"), preset("b", "Beta")];
    expect(removePreset(list, "a").map((p) => p.id)).toEqual(["b"]);
  });

  it("id inesistente → lista invariata (nuovo array)", () => {
    const list = [preset("a", "Alfa")];
    expect(removePreset(list, "zzz")).toEqual(list);
  });
});
