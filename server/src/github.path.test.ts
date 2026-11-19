import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./config", () => ({
  getSettings: () => ({ githubRepo: "o/r", githubToken: "t", baseBranch: "main" }),
}));

const { listFiles, safeTreePath } = await import("./github");

afterEach(() => vi.unstubAllGlobals());

// Collaudo 2026-11-19 (simulazione sim-prenota-sale): l'Architetto ha chiesto
// gh_list_files con path "." per vedere la radice e ha ricevuto
// 'Percorso non valido: "."'. "." e "./" indicano la radice; ".." resta vietato.
describe("percorsi con '.'", () => {
  it('listFiles(".") elenca la radice del repository', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify([{ name: "README.md", type: "file" }]), { status: 200 }));
    vi.stubGlobal("fetch", f);
    await expect(listFiles(".", "main")).resolves.toEqual(["README.md"]);
    expect(String((f.mock.calls[0] as unknown as [string])[0])).toContain("/contents/?ref=main");
  });

  it('"./docs" equivale a "docs"', () => {
    expect(safeTreePath("./docs/ARCHITETTURA.md")).toBe("docs/ARCHITETTURA.md");
  });

  it('".." resta vietato', () => {
    expect(() => safeTreePath("docs/../../etc")).toThrow(/Percorso non valido/);
  });
});
