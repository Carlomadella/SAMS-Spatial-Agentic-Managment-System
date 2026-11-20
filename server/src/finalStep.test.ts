import { describe, expect, it, vi } from "vitest";
import type { WireEvent } from "./types";

// Collaudo 2026-11-20 (simulazione sim-prenota-sale): Sim-Revisore ha esaurito i 14 passi
// leggendo e, pur avvisato, all'ultimo passo ha letto ancora: chiuso a mani vuote.
// Scelta dell'utente: (1) all'ultimo passo solo strumenti per concludere; (2) a passi
// esauriti un turno di chiusura senza strumenti, il cui testo diventa il risultato parziale.
const bodies: Array<{ tools?: Array<{ function: { name: string } }>; messages: Array<{ role: string; content: unknown }> }> = [];
vi.mock("./llmFallback", async (orig) => ({
  ...(await orig<typeof import("./llmFallback")>()),
  buildEndpoints: () => [{ id: "openrouter", label: "OpenRouter", model: "m" }],
  chatWithFallback: async (_eps: unknown, opts: { body: (typeof bodies)[number] }) => {
    bodies.push(opts.body);
    const message = opts.body.tools
      ? { content: null, tool_calls: [{ id: `c${bodies.length}`, type: "function", function: { name: "gh_list_files", arguments: "{}" } }] }
      : { content: "Trovati 3 problemi: manca la validazione delle date, JWT senza scadenza, nessun test sulle sovrapposizioni." };
    return { data: { choices: [{ message }], usage: { total_tokens: 1 } }, endpoint: { id: "openrouter", label: "OpenRouter", model: "m" } };
  },
}));
vi.mock("./github", async (orig) => ({
  ...(await orig<typeof import("./github")>()),
  effectiveSettings: () => ({ githubToken: "t", githubRepo: "o/r", mcpServers: "", requireApproval: false, baseBranch: "main", openPRs: false, notionPageId: "" }),
  listFiles: async () => ["README.md"],
}));
vi.mock("./notion", () => ({ notionConfigured: () => false }));

const { runOpenrouterTask } = await import("./openrouter");
const { MAX_STEPS, finalStepSpecs, buildToolSpecs, taskOutcome } = await import("./agentTools");

describe("ultimo passo e turno di chiusura", () => {
  it("all'ultimo passo offre solo strumenti per concludere, poi chiede il risultato parziale", async () => {
    bodies.length = 0;
    const events: WireEvent[] = [];
    await runOpenrouterTask({ agentId: "a", agentName: "Sim-Revisore", title: "Rivedi la PR #3" }, (e) => events.push(e));

    // MAX_STEPS turni con strumenti + 1 turno di chiusura senza strumenti
    expect(bodies).toHaveLength(MAX_STEPS + 1);
    const names = (b: (typeof bodies)[number]) => (b.tools ?? []).map((t) => t.function.name);
    expect(names(bodies[0]!)).toContain("gh_list_files");
    const last = names(bodies[MAX_STEPS - 1]!);
    expect(last).toContain("done");
    expect(last).not.toContain("gh_list_files");
    expect(last).not.toContain("gh_read_files");
    expect(bodies[MAX_STEPS]!.tools).toBeUndefined();

    const msgs = events.map((e) => e.message ?? "");
    expect(msgs.some((m) => m.startsWith("Risultato parziale (passi esauriti): Trovati 3 problemi"))).toBe(true);
    expect(msgs).toContain("Interrotto al limite di passi: risultato parziale nel riassunto");
  });

  it("gli strumenti dell'ultimo passo sono quelli che lasciano un risultato", () => {
    const s = { baseBranch: "main" } as Parameters<typeof buildToolSpecs>[0];
    const names = finalStepSpecs(buildToolSpecs(s, { repoEnabled: true, notionEnabled: true, mcpEnabled: false })).map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(["done", "gh_write_files", "gh_comment_pr", "notion_write", "relay_task"]));
    expect(names).not.toEqual(expect.arrayContaining(["gh_read_file"]));
  });

  it("un riassunto parziale non conta come task completato", () => {
    expect(taskOutcome({ wroteFiles: false, notionWrote: false, finished: false, doneSummary: "parziale" })).toMatchObject({
      status: "idle", completed: false, message: "Interrotto al limite di passi: risultato parziale nel riassunto",
    });
  });
});
