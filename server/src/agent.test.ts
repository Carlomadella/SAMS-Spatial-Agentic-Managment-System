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
});
