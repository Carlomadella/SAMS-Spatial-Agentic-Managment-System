import { describe, it, expect } from "vitest";
import type { Agent } from "../types";
import {
  AGENT_TEMPLATES,
  applyTemplate,
  serializeTemplate,
  parseTemplate,
  templateFromAgent,
} from "./agentTemplates";

const baseAgent = (over: Partial<Agent> = {}): Agent => ({
  id: "agent-x",
  name: "x-agent",
  color: "blue",
  model: "Claude Sonnet",
  role: "Generalist",
  instructions: "vecchie istruzioni",
  status: "idle",
  position: [0, 0],
  target: null,
  task: null,
  taskQueue: [],
  energy: 100,
  hunger: 0,
  mood: "happy",
  xp: 0,
  ...over,
});

describe("AGENT_TEMPLATES", () => {
  it("ha id univoci e campi completi", () => {
    const ids = AGENT_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of AGENT_TEMPLATES) {
      expect(t.name).toBeTruthy();
      expect(t.role).toBeTruthy();
      expect(t.model).toBeTruthy();
      expect(t.instructions.length).toBeGreaterThan(20);
    }
  });
});

describe("applyTemplate", () => {
  it("imposta role/model/instructions e preserva il resto", () => {
    const a = baseAgent({ energy: 42, xp: 99 });
    const t = AGENT_TEMPLATES.find((x) => x.id === "test-writer")!;
    const out = applyTemplate(a, t);
    expect(out.role).toBe(t.role);
    expect(out.model).toBe(t.model);
    expect(out.instructions).toBe(t.instructions);
    // campi non toccati
    expect(out.id).toBe(a.id);
    expect(out.energy).toBe(42);
    expect(out.xp).toBe(99);
    expect(out.color).toBe(a.color);
  });
  it("non muta l'agente originale", () => {
    const a = baseAgent();
    applyTemplate(a, AGENT_TEMPLATES[0]);
    expect(a.role).toBe("Generalist");
    expect(a.instructions).toBe("vecchie istruzioni");
  });
});

describe("serialize/parse (condivisione)", () => {
  it("round-trip: parse(serialize(t)) preserva i campi che contano", () => {
    const t = AGENT_TEMPLATES[0];
    const parsed = parseTemplate(serializeTemplate(t));
    expect(parsed).toMatchObject({ role: t.role, model: t.model, instructions: t.instructions, name: t.name });
  });
  it("rifiuta JSON non valido o privo dei campi essenziali", () => {
    expect(parseTemplate("non-json")).toBeNull();
    expect(parseTemplate("123")).toBeNull();
    expect(parseTemplate(JSON.stringify({ role: "Tester" }))).toBeNull(); // manca model/instructions
    expect(parseTemplate(JSON.stringify({ role: "Tester", model: "Claude", instructions: 5 }))).toBeNull();
  });
  it("accetta instructions vuote ma role/model presenti, con default sui campi opzionali", () => {
    const p = parseTemplate(JSON.stringify({ role: "Tester", model: "Claude Sonnet", instructions: "" }));
    expect(p).not.toBeNull();
    expect(p!.instructions).toBe("");
    expect(p!.name).toBe("Template importato");
    expect(p!.emoji).toBeTruthy();
  });
});

describe("templateFromAgent", () => {
  it("cattura role/model/instructions correnti", () => {
    const a = baseAgent({ role: "Architetto", model: "Claude Opus", instructions: "pensa in grande" });
    const t = templateFromAgent(a, "Il mio architetto");
    expect(t).toMatchObject({ name: "Il mio architetto", role: "Architetto", model: "Claude Opus", instructions: "pensa in grande" });
    // round-trip applicabile
    expect(applyTemplate(baseAgent(), t).instructions).toBe("pensa in grande");
  });
  it("ripiega su un nome di default se vuoto", () => {
    expect(templateFromAgent(baseAgent(), "   ").name).toBe("Template senza nome");
  });
});
