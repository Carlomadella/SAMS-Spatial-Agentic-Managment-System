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

  it("injects Revisore role instructions and discourages code edits", () => {
    const s = composeSystem({ agentName: "r", notionEnabled: true, repoEnabled: true, role: "Revisore" });
    expect(s).toContain("REVISORE");
    expect(s).toContain("Non modificare MAI");
  });

  it("injects Tester role instructions about writing test files", () => {
    const s = composeSystem({ agentName: "t", notionEnabled: true, repoEnabled: true, role: "Tester" });
    expect(s).toContain("TESTER");
    expect(s).toContain("file di test");
  });

  it("injects Documentatore role instructions", () => {
    const s = composeSystem({ agentName: "d", notionEnabled: true, repoEnabled: true, role: "Documentatore" });
    expect(s).toContain("DOCUMENTATORE");
  });

  it("injects Architetto role instructions about analysis", () => {
    const s = composeSystem({ agentName: "a", notionEnabled: true, repoEnabled: true, role: "Architetto" });
    expect(s).toContain("ARCHITETTO");
    expect(s).toContain("analizza");
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

  it("adds no role text for Generalist or unknown role", () => {
    const g = composeSystem({ agentName: "x", notionEnabled: true, repoEnabled: true, role: "Generalist" });
    const u = composeSystem({ agentName: "x", notionEnabled: true, repoEnabled: true, role: "UnknownRole" });
    expect(g).not.toContain("Ruolo");
    expect(u).not.toContain("Ruolo");
  });

  it("stacks role instructions and project guidelines together", () => {
    const guide = "Segui le convenzioni.";
    const s = composeSystem({ agentName: "x", notionEnabled: true, repoEnabled: true, role: "Tester", guide });
    expect(s).toContain("TESTER");
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

  it("stacks user instructions, role, and project guide in that order", () => {
    const instr = "Evita le classi.";
    const guide = "Usa ESLint strict.";
    const s = composeSystem({
      agentName: "x",
      notionEnabled: true,
      repoEnabled: true,
      instructions: instr,
      role: "Tester",
      guide,
    });
    const instrIdx = s.indexOf("Istruzioni specifiche");
    const roleIdx = s.indexOf("TESTER");
    const guideIdx = s.indexOf("Linee guida");
    expect(instrIdx).toBeLessThan(roleIdx);
    expect(roleIdx).toBeLessThan(guideIdx);
    expect(s).toContain(instr);
    expect(s).toContain(guide);
  });
});
