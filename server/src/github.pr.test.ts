import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./config", () => ({
  getSettings: () => ({ githubRepo: "o/r", githubToken: "t", baseBranch: "main" }),
}));

const { createPullRequest } = await import("./github");

afterEach(() => vi.unstubAllGlobals());

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// Collaudo 2026-11-17 (simulazione sim-prenota-sale): un agente che continua il lavoro
// di un collega sullo stesso branch (relay) riceveva "PR non creata: GitHub 422 … A pull
// request already exists" — un falso errore: la PR c'è già e i nuovi commit ci finiscono.
describe("createPullRequest", () => {
  it("crea la PR quando non esiste", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(201, { number: 7, html_url: "https://github.com/o/r/pull/7" })));
    await expect(createPullRequest({ branch: "feat/x", title: "T", body: "B" })).resolves.toMatchObject({ number: 7 });
  });

  it("se per quel branch esiste già una PR aperta la restituisce invece di fallire", async () => {
    const f = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return json(422, {
          message: "Validation Failed",
          errors: [{ resource: "PullRequest", code: "custom", message: "A pull request already exists for o:feat/x." }],
        });
      }
      return json(200, [{ number: 2, html_url: "https://github.com/o/r/pull/2" }]);
    });
    vi.stubGlobal("fetch", f);
    const pr = await createPullRequest({ branch: "feat/x", title: "T", body: "B" });
    expect(pr).toMatchObject({ number: 2, existing: true });
    const getUrl = String(f.mock.calls[1]![0]);
    expect(getUrl).toContain("/pulls?");
    expect(getUrl).toContain(`head=${encodeURIComponent("o:feat/x")}`);
  });

  it("un altro 422 (es. nessuna differenza col branch base) resta un errore", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json(422, { message: "Validation Failed", errors: [{ message: "No commits between main and feat/x" }] })),
    );
    await expect(createPullRequest({ branch: "feat/x", title: "T", body: "B" })).rejects.toThrow(/No commits/);
  });
});
