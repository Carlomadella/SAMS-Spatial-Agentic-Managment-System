import { describe, it, expect } from "vitest";
import type { Agent } from "../types";
import {
  AGENT_TEMPLATES,
  applyTemplate,
  serializeTemplate,
  parseTemplate,
  templateFromAgent,
  findTemplate,
  migrateLegacyRoleRules,
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

describe("preimpostati e migrazione dei vecchi vincoli di ruolo (20/11/2026)", () => {
  it("le regole stanno nel limite delle istruzioni permanenti (1200)", () => {
    for (const t of AGENT_TEMPLATES) expect(t.instructions.length).toBeLessThanOrEqual(1200);
  });

  it("l'Architetto scrive il piano in docs/ARCHITETTURA.md e passa il primo passo", () => {
    const a = findTemplate("architect")!;
    expect(a.instructions).toContain("docs/ARCHITETTURA.md");
    expect(a.instructions).toContain("relay_task");
  });

  it("applyTemplate ricorda da quale preimpostato è partito l'agente", () => {
    expect(applyTemplate(baseAgent(), findTemplate("reviewer")!).presetId).toBe("reviewer");
  });

  it("findTemplate cerca anche tra i preset dell'utente", () => {
    const mine = templateFromAgent(baseAgent(), "Mio");
    expect(findTemplate(mine.id, [mine])).toBe(mine);
    expect(findTemplate(undefined)).toBeUndefined();
    expect(findTemplate("inesistente")).toBeUndefined();
  });

  it("copia le vecchie regole agli agenti con quei ruoli e senza istruzioni", () => {
    const out = migrateLegacyRoleRules([
      baseAgent({ role: "Revisore", instructions: "" }),
      baseAgent({ role: "QA", instructions: "   " }),
      baseAgent({ role: "Architetto", instructions: "" }),
      baseAgent({ role: "Documentatore", instructions: "" }),
    ]);
    expect(out.map((a) => a.presetId)).toEqual(["reviewer", "test-writer", "architect", "doc-writer"]);
    expect(out[0].instructions).toBe(findTemplate("reviewer")!.instructions);
  });

  it("non tocca chi ha già istruzioni sue né i Generalisti", () => {
    const mine = baseAgent({ role: "Revisore", instructions: "Correggi tu i bug." });
    const gen = baseAgent({ role: "Generalist", instructions: "" });
    const [a, b] = migrateLegacyRoleRules([mine, gen]);
    expect(a).toBe(mine);
    expect(b).toBe(gen);
  });

  it("ci sono i preimpostati scelti il 20/11", () => {
    for (const id of ["developer", "researcher", "security-guard", "ci-keeper", "triager", "a11y-reviewer"]) {
      expect(findTemplate(id), id).toBeTruthy();
    }
  });

  it("il Ricercatore usa Scrapling e, se manca, web_fetch (opzione A2)", () => {
    const r = findTemplate("researcher")!.instructions;
    expect(r).toContain("scrapling");
    expect(r).toContain("web_fetch");
  });

  it("lo Smistatore legge le issue con gh_list_issues", () => {
    expect(findTemplate("triager")!.instructions).toContain("gh_list_issues");
  });
});
