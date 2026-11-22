import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Settings } from "./config";
import type { WireEvent } from "./types";

// Collaudo 2026-11-20 (simulazione sim-prenota-sale): docs/ARCHITETTURA.md è di
// 13.760 caratteri ma gh_read_file ne restituiva 8.000 troncati con "…", senza dire che
// c'era dell'altro né come leggerlo. Sim-Revisore l'ha riletto 9 volte di fila e ha
// esaurito i 14 passi senza fare la revisione.
const readFile = vi.fn();
vi.mock("./github", async (importOriginal) => {
  const orig = await importOriginal<typeof import("./github")>();
  return { ...orig, readFile };
});

const { FILE_READ_LIMIT, PROGRESS_START, executeTool } = await import("./agentTools");
type Ctx = Parameters<typeof executeTool>[2];

function mkCtx(): Ctx {
  return {
    s: { baseBranch: "main", githubRepo: "o/r", notionPageId: "", openPRs: false } as Settings,
    agentId: "a", agentName: "Rev", title: "T", branch: "main", requireApproval: false,
    emit: (_e: WireEvent) => {}, wroteFiles: false, notionWrote: false, branchReady: false,
    doneSummary: "", finished: false, progress: PROGRESS_START, stagedFiles: [],
  };
}

const big = "a".repeat(FILE_READ_LIMIT) + "B".repeat(5000);

beforeEach(() => {
  readFile.mockReset();
  readFile.mockResolvedValue(big);
});

describe("gh_read_file su un file lungo", () => {
  it("dice che il file continua e da quale offset riprendere", async () => {
    const res = await executeTool("gh_read_file", { path: "docs/A.md" }, mkCtx());
    expect(res.startsWith("a".repeat(100))).toBe(true);
    expect(res).not.toContain("B");
    expect(res).toContain(`offset=${FILE_READ_LIMIT}`);
    expect(res).toContain(`di ${big.length} caratteri`);
  });

  it("con offset legge il pezzo successivo, fino alla fine", async () => {
    const res = await executeTool("gh_read_file", { path: "docs/A.md", offset: FILE_READ_LIMIT }, mkCtx());
    expect(res).toBe("B".repeat(5000));
  });

  it("un file corto si legge intero, senza note", async () => {
    readFile.mockResolvedValue("# breve");
    expect(await executeTool("gh_read_file", { path: "README.md" }, mkCtx())).toBe("# breve");
  });

  it("un offset oltre la fine lo dice chiaramente", async () => {
    const res = await executeTool("gh_read_file", { path: "docs/A.md", offset: 999999 }, mkCtx());
    expect(res).toMatch(/oltre la fine/);
  });

  it("rileggere lo stesso pezzo nello stesso task avvisa che è già stato letto", async () => {
    const ctx = mkCtx();
    await executeTool("gh_read_file", { path: "docs/A.md" }, ctx);
    const again = await executeTool("gh_read_file", { path: "docs/A.md" }, ctx);
    expect(again).toMatch(/^Già letto in questo task/);
    expect(again).toContain(`offset=${FILE_READ_LIMIT}`);
  });
});

// Collaudo 2026-11-20: rivedere la PR #3 (60 file) un file per passo esauriva i 14 passi.
// Scelta dell'utente: gh_read_files legge più file in un passo solo.
describe("gh_read_files", () => {
  it("legge più file in un passo, ognuno col suo titolo", async () => {
    readFile.mockImplementation(async (p: string) => `// contenuto di ${p}`);
    const res = await executeTool("gh_read_files", { paths: ["a.ts", "b.ts"] }, mkCtx());
    expect(res).toContain("=== a.ts ===\n// contenuto di a.ts");
    expect(res).toContain("=== b.ts ===\n// contenuto di b.ts");
    expect(readFile).toHaveBeenCalledTimes(2);
  });

  it("un file mancante non blocca gli altri", async () => {
    const { HttpError } = await import("./http");
    readFile.mockImplementation(async (p: string) => {
      if (p === "x.ts") throw new HttpError(404, "GitHub 404");
      return "ok";
    });
    const res = await executeTool("gh_read_files", { paths: ["x.ts", "y.ts"] }, mkCtx());
    expect(res).toContain("=== x.ts ===\nERRORE: \"x.ts\" non esiste nel repository");
    expect(res).toContain("=== y.ts ===\nok");
  });

  it("legge al massimo 10 file per volta e dice quali restano", async () => {
    readFile.mockResolvedValue("x");
    const paths = Array.from({ length: 12 }, (_, i) => `f${i}.ts`);
    const res = await executeTool("gh_read_files", { paths }, mkCtx());
    expect(readFile).toHaveBeenCalledTimes(10);
    expect(res).toContain("Non letti (massimo 10 per volta): f10.ts, f11.ts");
  });

  it("oltre il budget di caratteri si ferma e dice quali file leggere dopo", async () => {
    readFile.mockResolvedValue("z".repeat(FILE_READ_LIMIT));
    const res = await executeTool("gh_read_files", { paths: ["1.ts", "2.ts", "3.ts", "4.ts", "5.ts"] }, mkCtx());
    expect(res.length).toBeLessThan(FILE_READ_LIMIT * 4 + 2000);
    expect(res).toMatch(/Non letti \(troppo testo in una volta\): 5\.ts/);
  });

  it("senza percorsi risponde con un errore chiaro", async () => {
    expect(await executeTool("gh_read_files", { paths: [] }, mkCtx())).toMatch(/^ERRORE: /);
  });
});
