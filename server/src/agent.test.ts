import { describe, expect, it } from "vitest";
import { composeSystem } from "./agent";

describe("composeSystem", () => {
  it("mentions the agent name and both tools when enabled", () => {
    const s = composeSystem({ agentName: "red-agent", notionEnabled: true, repoEnabled: true });
    expect(s).toContain("red-agent");
    expect(s).toContain("notion_read");
    expect(s).toContain("notion_write");
    expect(s).toContain("gh_*");
  });

  it("includes CI workflow instruction to run tests after writing code", () => {
    const s = composeSystem({ agentName: "x", notionEnabled: false, repoEnabled: true });
    expect(s).toContain("gh_trigger_workflow");
    expect(s).toContain("gh_ci_jobs");
    expect(s).toContain("gh_list_ci");
  });

  it("omits auto-verifica when repo is not configured", () => {
    const s = composeSystem({ agentName: "x", notionEnabled: true, repoEnabled: false });
    expect(s).not.toContain("verifica mentalmente");
  });

  it("states clearly when a tool is not configured", () => {
    const s = composeSystem({ agentName: "blue", notionEnabled: false, repoEnabled: true });
    expect(s).toContain("Notion non è configurato");
    expect(s).not.toContain("usa SOLO lo strumento notion_write");
  });

  it("appends project guidelines when a guide is provided", () => {
    const guide = "Usa sempre TypeScript. Niente var.";
    const s = composeSystem({ agentName: "x", notionEnabled: true, repoEnabled: true, guide });
    expect(s).toContain("Linee guida del progetto");
    expect(s).toContain(guide);
  });

  it("omits the guidelines section when the guide is empty/whitespace", () => {
    const s = composeSystem({ agentName: "x", notionEnabled: true, repoEnabled: true, guide: "   " });
    expect(s).not.toContain("Linee guida del progetto");
  });

  it("il ruolo non aggiunge vincoli: il prompt dipende solo dalle istruzioni", () => {
    // 20/11/2026: tolti i vincoli cablati sul ruolo (ROLE_PROMPTS). Il ruolo resta
    // un'etichetta; le regole stanno nelle istruzioni, che l'utente vede e cambia.
    const base = composeSystem({ agentName: "a", notionEnabled: true, repoEnabled: true });
    for (const role of ["Revisore", "Tester", "Documentatore", "Architetto", "Generalist"]) {
      const s = composeSystem({ agentName: "a", notionEnabled: true, repoEnabled: true, ...({ role } as object) });
      expect(s).toBe(base);
      expect(s).not.toContain("VINCOLI ASSOLUTI");
    }
  });

  it("un Revisore con istruzioni sue può scrivere codice: nessun vincolo nascosto", () => {
    const s = composeSystem({ agentName: "r", notionEnabled: true, repoEnabled: true, instructions: "Correggi tu i bug che trovi." });
    expect(s).toContain("Correggi tu i bug che trovi.");
    expect(s).not.toContain("Non modificare MAI");
  });

  it("injects memories block when memories are provided", () => {
    const s = composeSystem({ agentName: "x", notionEnabled: false, repoEnabled: true, memories: "[architettura]: monorepo React+Express" });
    expect(s).toContain("Memoria di progetto");
    expect(s).toContain("[architettura]");
  });

  it("omits memories block when memories is empty or whitespace", () => {
    const s1 = composeSystem({ agentName: "x", notionEnabled: false, repoEnabled: true, memories: "" });
    const s2 = composeSystem({ agentName: "x", notionEnabled: false, repoEnabled: true, memories: "  " });
    expect(s1).not.toContain("Memoria di progetto");
    expect(s2).not.toContain("Memoria di progetto");
  });

  it("stacks user instructions and project guidelines together", () => {
    const guide = "Segui le convenzioni.";
    const s = composeSystem({ agentName: "x", notionEnabled: true, repoEnabled: true, instructions: "Scrivi solo test.", guide });
    expect(s).toContain("Scrivi solo test.");
    expect(s).toContain("Linee guida del progetto");
    expect(s).toContain(guide);
  });

  it("injects user instructions with highest-priority label", () => {
    const instr = "Scrivi sempre in inglese. Usa solo funzioni pure.";
    const s = composeSystem({ agentName: "x", notionEnabled: true, repoEnabled: true, instructions: instr });
    expect(s).toContain("Istruzioni specifiche per questo agente");
    expect(s).toContain(instr);
  });

  it("omits the instructions section when empty or whitespace", () => {
    const s1 = composeSystem({ agentName: "x", notionEnabled: true, repoEnabled: true, instructions: "" });
    const s2 = composeSystem({ agentName: "x", notionEnabled: true, repoEnabled: true, instructions: "  " });
    expect(s1).not.toContain("Istruzioni specifiche");
    expect(s2).not.toContain("Istruzioni specifiche");
  });

  // Collaudo 21/11, punto 3A: le regole in cima e un controllo prima di done.
  it("le regole dell'agente vanno in cima, prima di tutto il resto, con il controllo finale", () => {
    const instr = "Scrivi solo file di test.";
    const s = composeSystem({ agentName: "x", notionEnabled: true, repoEnabled: true, instructions: instr });
    expect(s.startsWith("REGOLE DI QUESTO AGENTE")).toBe(true);
    expect(s.indexOf(instr)).toBeLessThan(s.indexOf('Sei "x"'));
    expect(s.trimEnd().endsWith("con il motivo.")).toBe(true);
    expect(s).toContain("Regole rispettate: sì");
  });

  it("senza regole niente controllo finale", () => {
    const s = composeSystem({ agentName: "x", notionEnabled: true, repoEnabled: true });
    expect(s.startsWith('Sei "x"')).toBe(true);
    expect(s).not.toContain("Regole rispettate");
  });

  it("mette le istruzioni dell'agente prima delle linee guida del progetto", () => {
    const instr = "Evita le classi.";
    const guide = "Usa ESLint strict.";
    const s = composeSystem({ agentName: "x", notionEnabled: true, repoEnabled: true, instructions: instr, guide });
    const instrIdx = s.indexOf("Istruzioni specifiche");
    const guideIdx = s.indexOf("Linee guida");
    expect(instrIdx).toBeGreaterThan(-1);
    expect(instrIdx).toBeLessThan(guideIdx);
    expect(s).toContain(instr);
    expect(s).toContain(guide);
  });
});
