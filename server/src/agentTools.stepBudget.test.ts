import { describe, expect, it, vi } from "vitest";
import type { Settings } from "./config";
import type { WireEvent } from "./types";

// Collaudo 2026-11-20 (simulazione sim-prenota-sale): Sim-Revisore ha esaurito i 14
// passi leggendo file e si è chiuso a mani vuote, senza commento né riassunto. Scelta
// dell'utente: agli ultimi passi SAMS avvisa l'agente di lasciare il risultato parziale.
const readFile = vi.fn(async () => "contenuto");
vi.mock("./github", async (importOriginal) => ({ ...(await importOriginal<typeof import("./github")>()), readFile }));

const { PROGRESS_START, executeTool, stepBudgetNote } = await import("./agentTools");
type Ctx = Parameters<typeof executeTool>[2];

const mkCtx = (stepsLeft?: number): Ctx => ({
  s: { baseBranch: "main", githubRepo: "o/r", notionPageId: "", openPRs: false } as Settings,
  agentId: "a", agentName: "Rev", title: "T", branch: "main", requireApproval: false,
  emit: (_e: WireEvent) => {}, wroteFiles: false, notionWrote: false, branchReady: false,
  doneSummary: "", finished: false, progress: PROGRESS_START, stagedFiles: [],
  ...(stepsLeft != null ? { stepsLeft } : {}),
});

describe("avviso di fine passi", () => {
  it("con molti passi rimasti non aggiunge nulla", async () => {
    expect(await executeTool("gh_read_file", { path: "a.ts" }, mkCtx(6))).toBe("contenuto");
    expect(await executeTool("gh_read_file", { path: "a.ts" }, mkCtx())).toBe("contenuto");
  });

  it("a 2 passi dalla fine avvisa di prepararsi a concludere", async () => {
    const res = await executeTool("gh_read_file", { path: "a.ts" }, mkCtx(2));
    expect(res.startsWith("contenuto")).toBe(true);
    expect(res).toContain("ATTENZIONE: ti restano 2 passi");
  });

  it("all'ultimo passo chiede di lasciare subito il risultato parziale e chiamare done", async () => {
    const res = await executeTool("gh_read_file", { path: "a.ts" }, mkCtx(1));
    expect(res).toContain("ATTENZIONE: ti resta 1 solo passo");
    expect(res).toMatch(/done/);
  });

  it("il testo dell'avviso è vuoto quando non serve", () => {
    expect(stepBudgetNote(3)).toBe("");
    expect(stepBudgetNote(undefined)).toBe("");
    expect(stepBudgetNote(0)).toBe("");
  });
});

// Collaudo 2026-11-20: all'ultimo passo SAMS offre solo gli strumenti per concludere, ma il
// modello (Nemotron :free) ha chiamato lo stesso gh_read_files ("read 0 file"). Il vincolo
// va applicato anche all'esecuzione, non solo all'elenco offerto.
describe("ultimo passo vincolante", () => {
  it("all'ultimo passo rifiuta gli strumenti di lettura senza eseguirli", async () => {
    readFile.mockClear();
    const res = await executeTool("gh_read_file", { path: "a.ts" }, mkCtx(0));
    expect(res).toMatch(/^ERRORE: all'ultimo passo/);
    expect(readFile).not.toHaveBeenCalled();
  });

  it("all'ultimo passo done funziona", async () => {
    const ctx = mkCtx(0);
    await executeTool("done", { summary: "fatto" }, ctx);
    expect(ctx.finished).toBe(true);
  });

  it("prima dell'ultimo passo la lettura è permessa", async () => {
    expect(await executeTool("gh_read_file", { path: "a.ts" }, mkCtx(1))).toContain("contenuto");
  });
});
