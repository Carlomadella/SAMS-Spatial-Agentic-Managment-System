import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Settings } from "./config";
import type { WireEvent } from "./types";

// Simulazione 22/11: Sim-Tester ha letto package.json e ha scritto «JSON valido»; non lo
// era. SAMS controlla da sé i file letti e scritti, avvisa l'agente e lo scrive nel riassunto.
const readFile = vi.fn();
const writeFile = vi.fn();
const createBranch = vi.fn();
vi.mock("./github", async (importOriginal) => {
  const orig = await importOriginal<typeof import("./github")>();
  return { ...orig, readFile, writeFile, createBranch };
});

const { PROGRESS_START, executeTool, finalizeTask } = await import("./agentTools");
type Ctx = Parameters<typeof executeTool>[2];

const BAD = '{\n  "scripts": {\n    "dev": "concurrently "a" "b""\n  }\n}';
const GOOD = '{\n  "scripts": {\n    "dev": "concurrently \\"a\\" \\"b\\""\n  }\n}';

function mkCtx(events: WireEvent[] = []): Ctx {
  return {
    s: { baseBranch: "main", githubRepo: "o/r", notionPageId: "", openPRs: false } as Settings,
    agentId: "a",
    agentName: "Sim-Tester",
    title: "Verifica",
    branch: "feat/x",
    requireApproval: false,
    emit: (e: WireEvent) => events.push(e),
    wroteFiles: false,
    notionWrote: false,
    branchReady: true,
    doneSummary: "",
    finished: false,
    progress: PROGRESS_START,
    stagedFiles: [],
  };
}

beforeEach(() => {
  readFile.mockReset();
  writeFile.mockReset();
  createBranch.mockReset();
});

describe("controllo automatico dei file JSON letti e scritti", () => {
  it("gh_read_file: l'agente vede l'avviso prima del contenuto", async () => {
    readFile.mockResolvedValue(BAD);
    const ctx = mkCtx();
    const res = await executeTool("gh_read_file", { path: "package.json" }, ctx);
    expect(res).toMatch(/^ATTENZIONE \(controllo automatico di SAMS\): package\.json non è JSON valido \(riga 3, colonna \d+\)/);
    expect(res).toContain(BAD);
    expect(ctx.fileProblems?.get("package.json")).toMatch(/riga 3/);
  });

  it("gh_read_files: avviso solo sul file rotto", async () => {
    readFile.mockImplementation(async (p: string) => (p === "package.json" ? BAD : GOOD));
    const ctx = mkCtx();
    const res = await executeTool("gh_read_files", { paths: ["package.json", "server/package.json"] }, ctx);
    expect(res).toContain("=== package.json ===\nATTENZIONE");
    expect(res).toContain("=== server/package.json ===\n{");
    expect([...(ctx.fileProblems?.keys() ?? [])]).toEqual(["package.json"]);
  });

  it("riassunto: «tutto valido» dell'agente + nota del server con il problema vero", async () => {
    readFile.mockResolvedValue(BAD);
    const events: WireEvent[] = [];
    const ctx = mkCtx(events);
    await executeTool("gh_read_file", { path: "package.json" }, ctx);
    ctx.doneSummary = "Tutti i package.json sono JSON validi.";
    ctx.finished = true;
    await finalizeTask(ctx, { totalTokens: 0, repoEnabled: false, notionEnabled: false, prProviderLabel: "test" });
    expect(ctx.doneSummary).toContain("Nota di SAMS: problemi trovati dal controllo automatico: package.json non è JSON valido (riga 3");
    expect(events.some((e) => e.level === "WARN" && /package\.json non è JSON valido/.test(e.message ?? ""))).toBe(true);
  });

  it("corretto e riscritto: il problema esce dalla lista", async () => {
    readFile.mockResolvedValue(BAD);
    const ctx = mkCtx();
    await executeTool("gh_read_file", { path: "package.json" }, ctx);
    const res = await executeTool("gh_write_file", { path: "package.json", content: GOOD }, ctx);
    expect(res).toBe("ok");
    expect(ctx.fileProblems?.size).toBe(0);
  });

  it("scritto rotto: l'agente lo sa subito", async () => {
    const ctx = mkCtx();
    const res = await executeTool("gh_write_file", { path: "package.json", content: BAD }, ctx);
    expect(res).toMatch(/^ok\n\nATTENZIONE \(controllo automatico di SAMS\): package\.json non è JSON valido/);
  });

  it("una nota falsa scritta dal modello non fa saltare quella vera", async () => {
    readFile.mockResolvedValue(BAD);
    const ctx = mkCtx();
    await executeTool("gh_read_file", { path: "package.json" }, ctx);
    ctx.doneSummary = "Ok.\n\nNota di SAMS: problemi trovati dal controllo automatico: nessuno";
    ctx.finished = true;
    await finalizeTask(ctx, { totalTokens: 0, repoEnabled: false, notionEnabled: false, prProviderLabel: "test" });
    expect(ctx.doneSummary).toMatch(/package\.json non è JSON valido/);
  });
});
