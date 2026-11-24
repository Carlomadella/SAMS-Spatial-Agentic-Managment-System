import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Settings } from "./config";
import { HttpError } from "./http";
import type { WireEvent } from "./types";

// Collaudo 2026-11-17 (simulazione sim-prenota-sale): l'Architetto scrive
// docs/ARCHITETTURA.md sul suo branch e passa il lavoro (relay) al Generalist sullo
// stesso branch; il Generalist però leggeva solo da `main`, riceveva 404 e girava a
// vuoto fino al limite di passi. Le letture devono vedere il branch del task.
const readFile = vi.fn();
const listFiles = vi.fn();
const listFilesRecursive = vi.fn();
vi.mock("./github", async (importOriginal) => {
  const orig = await importOriginal<typeof import("./github")>();
  return { ...orig, readFile, listFiles, listFilesRecursive };
});

const { PROGRESS_START, executeTool } = await import("./agentTools");
type Ctx = Parameters<typeof executeTool>[2];

function mkCtx(): Ctx {
  return {
    s: { baseBranch: "main", githubRepo: "o/r", notionPageId: "", openPRs: false } as Settings,
    agentId: "a",
    agentName: "Dev",
    title: "T",
    branch: "docs/architettura",
    requireApproval: false,
    emit: (_e: WireEvent) => {},
    wroteFiles: false,
    notionWrote: false,
    branchReady: false,
    doneSummary: "",
    finished: false,
    progress: PROGRESS_START,
    stagedFiles: [],
  };
}

const notFound = () => new HttpError(404, 'GitHub 404: {"message":"Not Found"}');

beforeEach(() => {
  readFile.mockReset();
  listFiles.mockReset();
  listFilesRecursive.mockReset();
});

// Simulazione 24/11: Sim-Revisore ha speso 10 dei 24 passi con un `ls` per cartella e non
// è arrivato a lasciare la revisione. Con `recursive` l'albero arriva in un passo solo.
describe("gh_list_files con recursive", () => {
  it("elenca tutti i file sotto la cartella, dal branch del task", async () => {
    listFilesRecursive.mockImplementation(async (_p: string, ref: string) =>
      ref === "docs/architettura" ? ["src/a.ts", "src/b/c.ts"] : [],
    );
    const res = await executeTool("gh_list_files", { path: "client", recursive: true }, mkCtx());
    expect(listFilesRecursive).toHaveBeenCalledWith("client", "docs/architettura");
    expect(listFiles).not.toHaveBeenCalled();
    expect(res.split("\n")).toEqual(["src/a.ts", "src/b/c.ts"]);
  });
});

describe("gh_read_file / gh_list_files leggono il branch del task", () => {
  it("legge dal branch del task, dove il collega ha appena scritto", async () => {
    readFile.mockImplementation(async (_p: string, ref: string) => {
      if (ref === "docs/architettura") return "# Architettura";
      throw notFound();
    });
    const res = await executeTool("gh_read_file", { path: "docs/ARCHITETTURA.md" }, mkCtx());
    expect(res).toBe("# Architettura");
    expect(readFile).toHaveBeenCalledWith("docs/ARCHITETTURA.md", "docs/architettura");
  });

  it("se sul branch non c'è (o il branch non esiste ancora) ricade sul branch base", async () => {
    readFile.mockImplementation(async (_p: string, ref: string) => {
      if (ref === "main") return "readme di main";
      throw notFound();
    });
    const res = await executeTool("gh_read_file", { path: "README.md" }, mkCtx());
    expect(res).toBe("readme di main");
    expect(readFile.mock.calls.map((c) => c[1])).toEqual(["docs/architettura", "main"]);
  });

  it("un errore diverso da 404 non viene mascherato dal ripiego", async () => {
    readFile.mockRejectedValue(new HttpError(401, "GitHub 401: Bad credentials"));
    const res = await executeTool("gh_read_file", { path: "README.md" }, mkCtx());
    expect(res).toContain("401");
    expect(readFile).toHaveBeenCalledOnce();
  });

  it("anche l'elenco dei file guarda prima il branch del task", async () => {
    listFiles.mockImplementation(async (_p: string, ref: string) => (ref === "docs/architettura" ? ["docs", "package.json"] : [".gitignore"]));
    const res = await executeTool("gh_list_files", { path: "" }, mkCtx());
    expect(res).toBe("docs\npackage.json");
    expect(listFiles).toHaveBeenCalledWith("", "docs/architettura");
  });
});

// Collaudo 2026-11-19: un percorso inesistente produceva un WARN col JSON grezzo di
// GitHub ('GitHub 404: {"message":"Not Found",…}'), poco utile al modello e al log.
describe("percorso inesistente: messaggio chiaro", () => {
  it("gh_list_files dice quale cartella non esiste e su quali branch ha cercato", async () => {
    listFiles.mockImplementation(async () => { throw notFound(); });
    const events: WireEvent[] = [];
    const ctx = { ...mkCtx(), emit: (e: WireEvent) => { events.push(e); } };
    const res = await executeTool("gh_list_files", { path: "src" }, ctx);
    expect(res).toBe('ERRORE: "src" non esiste nel repository (cercato su docs/architettura e main)');
    expect(events.find((e) => e.level === "WARN")?.message).not.toContain("{");
  });

  it("gh_read_file idem per un file", async () => {
    readFile.mockImplementation(async () => { throw notFound(); });
    const res = await executeTool("gh_read_file", { path: "package.json" }, mkCtx());
    expect(res).toBe('ERRORE: "package.json" non esiste nel repository (cercato su docs/architettura e main)');
  });
});
