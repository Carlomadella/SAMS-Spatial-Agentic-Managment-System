import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./config", () => ({
  getSettings: () => ({ githubRepo: "o/r", githubToken: "t", baseBranch: "main" }),
}));

const { errorExcerpt, getWorkflowJobs } = await import("./github");

afterEach(() => vi.unstubAllGlobals());

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// Simulazione del 25/11: gh_ci_jobs diceva all'agente QUALE passo era fallito ma non il
// messaggio d'errore, quindi l'agente non poteva correggere niente. Ora per i job falliti
// arrivano anche le righe del log intorno al primo errore.

describe("errorExcerpt", () => {
  it("toglie orari e colori e si ferma al primo errore (non alla pulizia dopo)", () => {
    const raw = [
      "2026-11-25T01:00:00.0000000Z Run npm run build --workspace=server",
      "2026-11-25T01:00:01.0000000Z \u001b[31msrc/a.ts(3,7): error TS2451: Cannot redeclare block-scoped variable 'x'.\u001b[0m",
      "2026-11-25T01:00:02.0000000Z ##[error]Process completed with exit code 2.",
      "2026-11-25T01:00:03.0000000Z Post job cleanup.",
      "2026-11-25T01:00:04.0000000Z Cleaning up orphan processes",
    ].join("\n");
    const out = errorExcerpt(raw);
    expect(out).toContain("src/a.ts(3,7): error TS2451: Cannot redeclare block-scoped variable 'x'.");
    expect(out).toContain("##[error]Process completed with exit code 2.");
    expect(out).not.toContain("Post job cleanup");
    expect(out).not.toMatch(/2026-11-25T/);
    expect(out).not.toContain("\u001b");
  });

  it("senza ##[error] prende la coda, e non supera il limite di righe e caratteri", () => {
    const raw = Array.from({ length: 500 }, (_, i) => `riga ${i} ${"x".repeat(100)}`).join("\n");
    const out = errorExcerpt(raw);
    expect(out).toContain("riga 499");
    expect(out).not.toContain("riga 100 ");
    expect(out.length).toBeLessThanOrEqual(4000);
  });
});

describe("getWorkflowJobs", () => {
  it("per un job fallito aggiunge il log dell'errore, letto dall'indirizzo di GitHub senza il token", async () => {
    const calls: Array<{ url: string; auth: string | undefined; redirect: string | undefined }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const h = (init?.headers ?? {}) as Record<string, string>;
        calls.push({ url, auth: h.Authorization, redirect: init?.redirect });
        if (url.endsWith("/actions/runs/7/jobs?per_page=15")) {
          return json(200, {
            jobs: [
              { id: 1, name: "ok", status: "completed", conclusion: "success", steps: [] },
              { id: 2, name: "build", status: "completed", conclusion: "failure", steps: [{ name: "Build server", status: "completed", conclusion: "failure" }] },
            ],
          });
        }
        if (url.endsWith("/actions/jobs/2/logs")) {
          return new Response(null, { status: 302, headers: { location: "https://logs.example/blob?sig=1" } });
        }
        if (url === "https://logs.example/blob?sig=1") {
          return new Response("2026-11-25T01:00:00Z error TS2451: doppio\n2026-11-25T01:00:01Z ##[error]exit 2\n", { status: 200 });
        }
        return json(404, {});
      }),
    );
    const out = await getWorkflowJobs(7);
    expect(out).toContain("✗ Build server ← FALLITO");
    expect(out).toContain("Log dell'errore (build)");
    expect(out).toContain("error TS2451: doppio");
    const blob = calls.find((c) => c.url.startsWith("https://logs.example"));
    expect(blob?.auth).toBeUndefined();
    expect(calls.find((c) => c.url.endsWith("/logs"))?.redirect).toBe("manual");
    expect(calls.some((c) => c.url.endsWith("/actions/jobs/1/logs"))).toBe(false);
  });

  it("se il log non si legge, il riepilogo arriva lo stesso", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("/jobs?per_page=15")) {
          return json(200, { jobs: [{ id: 2, name: "build", status: "completed", conclusion: "failure", steps: [] }] });
        }
        return json(410, {});
      }),
    );
    const out = await getWorkflowJobs(7);
    expect(out).toContain("❌ build (failure)");
    expect(out).toContain("log non disponibile");
  });
});
