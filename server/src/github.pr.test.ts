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

// Collaudo 2026-11-19: il titolo della PR era l'intero testo del task (oltre 900
// caratteri per T1 di sim-prenota-sale). Il titolo va accorciato; il testo intero
// resta nel corpo della PR.
describe("prTitle", () => {
  it("lascia invariato un titolo breve", async () => {
    const { prTitle } = await import("./github");
    expect(prTitle("Aggiungi i test del login")).toBe("Aggiungi i test del login");
  });

  it("tiene solo la prima frase / la parte prima dei due punti", async () => {
    const { prTitle } = await import("./github");
    expect(prTitle('Progetta l\'app "Prenota Sale" nella repo sim-prenota-sale: prenotazione di sale riunioni. Requisiti: …'))
      .toBe('Progetta l\'app "Prenota Sale" nella repo sim-prenota-sale');
    expect(prTitle("Correggi il bug del logout. Poi aggiorna il README.")).toBe("Correggi il bug del logout");
  });

  it("taglia a 72 caratteri con i puntini se la prima frase è lunga", async () => {
    const { prTitle } = await import("./github");
    const t = prTitle("parola ".repeat(30));
    expect(t.length).toBeLessThanOrEqual(72);
    expect(t.endsWith("…")).toBe(true);
  });

  it("toglie il contesto del relay tra quadre e gli a capo", async () => {
    const { prTitle } = await import("./github");
    expect(prTitle("Setup monorepo npm workspaces [da Sim-Architetto: Crea la struttura]")).toBe("Setup monorepo npm workspaces");
    expect(prTitle("Prima riga\nseconda riga")).toBe("Prima riga");
  });

  it("createPullRequest invia il titolo corto e non quello intero", async () => {
    const f = vi.fn(async () => json(201, { number: 9, html_url: "u" }));
    vi.stubGlobal("fetch", f);
    await createPullRequest({ branch: "b", title: "Scrivi i test: tutti quanti, con molta cura e attenzione", body: "B" });
    const sent = JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(sent.title).toBe("Scrivi i test");
  });
});
