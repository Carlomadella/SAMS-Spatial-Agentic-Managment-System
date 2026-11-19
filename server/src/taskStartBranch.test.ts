import { describe, expect, it, vi } from "vitest";
import type { WireEvent } from "./types";

// Collaudo 2026-11-19 (simulazione sim-prenota-sale): un task assegnato senza
// branch lavorava su sams/<agente>/<slug> ma la UI mostrava "Branch main".
// L'evento di avvio porta il branch vero, così il pannello lo mostra.
vi.mock("./github", async (orig) => ({
  ...(await orig<typeof import("./github")>()),
  effectiveSettings: () => ({ githubToken: "", githubRepo: "", mcpServers: "", requireApproval: false, baseBranch: "main" }),
}));
vi.mock("./notion", () => ({ notionConfigured: () => false }));

const { runOpenrouterTask } = await import("./openrouter");

describe("evento di avvio del task", () => {
  it("annuncia il branch generato quando il task non ne indica uno", async () => {
    const events: WireEvent[] = [];
    await runOpenrouterTask({ agentId: "a1", agentName: "Sim-Dev", title: "Setup monorepo" }, (e) => events.push(e));
    expect(events[0]!.branch).toMatch(/^sams\/sim-dev\/setup-monorepo-/);
  });

  it("annuncia il branch scelto quando il task lo indica", async () => {
    const events: WireEvent[] = [];
    await runOpenrouterTask({ agentId: "a1", agentName: "Sim-Dev", title: "T", branch: "feat/x" }, (e) => events.push(e));
    expect(events[0]!.branch).toBe("feat/x");
  });
});
