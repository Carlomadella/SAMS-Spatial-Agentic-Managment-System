import { afterEach, describe, expect, it, vi } from "vitest";
import type { Settings } from "./config";
import { PROGRESS_CAP, PROGRESS_START, PROGRESS_STEP, executeTool, finalizeTask, summaryWithCiNote, summaryWithReadsNote, type ToolContext } from "./agentTools";
import { clearPending, getPending, isMainGate } from "./pendingBuffer";
import type { WireEvent } from "./types";

// web_fetch risolve il DNS per la guardia anti-SSRF: nei test l'host finto "x" risolve
// a un indirizzo pubblico, e "inside" a uno privato.
vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async (host: string) => [{ address: host === "inside" ? "10.0.0.7" : "93.184.216.34", family: 4 }]),
}));

// La richiesta vera passa da `guardedFetch` (node:http con controllo degli IP alla
// connessione, testato in netGuard.connect.test.ts). Qui la si rimanda al `fetch` globale,
// così questi test continuano a simulare le risposte con `vi.stubGlobal("fetch", …)`.
vi.mock("./netGuard", async (importOriginal) => {
  const orig = await importOriginal<typeof import("./netGuard")>();
  return { ...orig, guardedFetch: (url: string, init?: RequestInit) => globalThis.fetch(url, init) };
});

function mkCtx(over: Partial<ToolContext> = {}): { ctx: ToolContext; events: WireEvent[] } {
  const events: WireEvent[] = [];
  const ctx: ToolContext = {
    s: { baseBranch: "main", githubRepo: "o/r", notionPageId: "", openPRs: false } as Settings,
    agentId: "a",
    agentName: "Blue",
    title: "T",
    branch: "b",
    requireApproval: false,
    emit: (e) => events.push(e),
    wroteFiles: false,
    notionWrote: false,
    branchReady: false,
    doneSummary: "",
    finished: false,
    progress: PROGRESS_START,
    stagedFiles: [],
    ...over,
  };
  return { ctx, events };
}

afterEach(() => vi.unstubAllGlobals());

describe("executeTool — control tools", () => {
  it("done marks finished and captures the summary", async () => {
    const { ctx } = mkCtx();
    await executeTool("done", { summary: "all good" }, ctx);
    expect(ctx.finished).toBe(true);
    expect(ctx.doneSummary).toBe("all good");
  });

  // Stanze iconiche (23/11): prima di eseguire lo strumento si dice che azione è,
  // senza messaggio (non deve finire nel Log eventi).
  it("annuncia la fase prima di eseguire lo strumento, senza messaggio", async () => {
    const { ctx, events } = mkCtx();
    await executeTool("announce_plan", { steps: ["uno"] }, ctx);
    expect(events[0]).toEqual({ agentId: "a", agentName: "Blue", activity: "read" });
  });

  it("done non annuncia nessuna fase", async () => {
    const { ctx, events } = mkCtx();
    await executeTool("done", { summary: "ok" }, ctx);
    expect(events.some((e) => e.activity)).toBe(false);
  });

  it("gh_ci_jobs manda l'esito dei test quando è chiaro", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ jobs: [{ name: "test", status: "completed", conclusion: "failure", steps: [] }] }), { status: 200 })));
    const { ctx, events } = mkCtx();
    await executeTool("gh_ci_jobs", { run_id: 7 }, ctx);
    expect(events.find((e) => e.ci)?.ci).toBe("failure");
  });

  it("announce_plan emits the plan and coerces steps to strings", async () => {
    const { ctx, events } = mkCtx();
    const res = await executeTool("announce_plan", { steps: ["one", 2, "three"] }, ctx);
    expect(res).toBe("Piano ricevuto");
    expect(events.at(-1)!.plan).toEqual(["one", "2", "three"]);
  });

  it("relay_task emits relayTo with target and inherits the branch", async () => {
    const { ctx, events } = mkCtx();
    const res = await executeTool("relay_task", { target: "Tester", title: "write tests" }, ctx);
    expect(res).toContain("Tester");
    expect(events.at(-1)!.relayTo).toMatchObject({ target: "Tester", title: "write tests", branch: "b" });
  });

  it("an unknown tool returns a clear marker", async () => {
    const { ctx } = mkCtx();
    expect(await executeTool("nope", {}, ctx)).toBe("strumento sconosciuto: nope");
  });

  it("gh_write_files returns ERRORE on empty or invalid file list", async () => {
    const { ctx } = mkCtx();
    expect(await executeTool("gh_write_files", { files: [], message: "x" }, ctx)).toMatch(/ERRORE/);
    expect(await executeTool("gh_write_files", { files: "not-an-array", message: "x" }, ctx)).toMatch(/ERRORE/);
  });

  it("gh_write_files stages files when requireApproval=true (no network)", async () => {
    const { ctx } = mkCtx({ requireApproval: true, branchReady: true });
    const res = await executeTool("gh_write_files", {
      files: [{ path: "a.ts", content: "// a" }, { path: "b.ts", content: "// b" }],
      message: "feat: two files",
    }, ctx);
    expect(res).toContain("staged");
    expect(ctx.stagedFiles).toHaveLength(2);
    expect(ctx.stagedFiles[0].path).toBe("a.ts");
    expect(ctx.stagedFiles[1].path).toBe("b.ts");
  });

  const prStub = (over: Record<string, unknown> = {}) => vi.fn((url: string, init?: RequestInit) => {
    expect(init?.method ?? "GET").toBe("GET"); // nessun merge: solo la lettura della PR
    expect(url).toContain("/pulls/7");
    return Promise.resolve(new Response(JSON.stringify({
      title: "Aggiunge X", state: "open",
      head: { sha: "abc1234def", ref: "feat", repo: { full_name: "o/r" } },
      base: { ref: "main", repo: { full_name: "o/r" } },
      ...over,
    }), { status: 200 }));
  });

  it.each([true, false])("gh_merge_pr non mergia mai da solo (requireApproval=%s): salva la richiesta legata al commit", async (requireApproval) => {
    vi.stubGlobal("fetch", prStub());
    const { ctx, events } = mkCtx({ requireApproval });
    const res = await executeTool("gh_merge_pr", { pr_number: 7, method: "merge" }, ctx);
    expect(res).toMatch(/sala d'attesa/);
    expect(ctx.mergeRequest).toEqual({ prNumber: 7, method: "merge", headSha: "abc1234def", headRef: "feat", baseRef: "main", title: "Aggiunge X" });
    expect(events.some((e) => /Merge PR #7 chiesto .*abc1234/.test(e.message ?? ""))).toBe(true);
  });

  it("gh_merge_pr rifiuta le PR da un fork e quelle chiuse", async () => {
    vi.stubGlobal("fetch", prStub({ head: { sha: "s", ref: "x", repo: { full_name: "altro/r" } } }));
    const { ctx } = mkCtx();
    expect(await executeTool("gh_merge_pr", { pr_number: 7 }, ctx)).toMatch(/ERRORE: .*fork/);
    vi.stubGlobal("fetch", prStub({ state: "closed" }));
    expect(await executeTool("gh_merge_pr", { pr_number: 7 }, ctx)).toMatch(/ERRORE: .*non è aperta/);
    expect(ctx.mergeRequest).toBeUndefined();
  });

  it("sul branch principale le scritture restano in attesa anche senza approvazione richiesta", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { ctx } = mkCtx({ branch: "main", requireApproval: false });
    await executeTool("gh_write_file", { path: "a.txt", content: "x" }, ctx);
    await executeTool("gh_write_files", { files: [{ path: "b.txt", content: "y" }] }, ctx);
    expect(ctx.stagedFiles.map((f) => f.path)).toEqual(["a.txt", "b.txt"]);
    expect(ctx.wroteFiles).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("gh_ci_jobs rejects invalid run_id without hitting the network", async () => {
    const { ctx } = mkCtx();
    expect(await executeTool("gh_ci_jobs", { run_id: "abc" }, ctx)).toMatch(/ERRORE/);
    expect(await executeTool("gh_ci_jobs", { run_id: 0 }, ctx)).toMatch(/ERRORE/);
    expect(await executeTool("gh_ci_jobs", { run_id: -1 }, ctx)).toMatch(/ERRORE/);
  });

  it("validates pr_number before hitting the network", async () => {
    const { ctx } = mkCtx();
    expect(await executeTool("gh_read_pr", { pr_number: "#12" }, ctx)).toBe("ERRORE: pr_number non valido");
    expect(await executeTool("gh_comment_pr", { pr_number: "x", body: "hi" }, ctx)).toBe("ERRORE: pr_number non valido");
    expect(await executeTool("gh_pr_status", { pr_number: "x" }, ctx)).toBe("ERRORE: pr_number non valido");
    expect(await executeTool("gh_merge_pr", { pr_number: "x" }, ctx)).toBe("ERRORE: pr_number non valido");
  });

  it("advances progress by PROGRESS_STEP, capped at PROGRESS_CAP", async () => {
    const { ctx } = mkCtx();
    await executeTool("done", {}, ctx);
    expect(ctx.progress).toBe(PROGRESS_START + PROGRESS_STEP);
    ctx.progress = PROGRESS_CAP;
    await executeTool("done", {}, ctx);
    expect(ctx.progress).toBe(PROGRESS_CAP);
  });
});

describe("executeTool — gh_trigger_workflow", () => {
  it("returns ERRORE when workflow or ref is missing", async () => {
    const { ctx } = mkCtx();
    expect(await executeTool("gh_trigger_workflow", { workflow: "", ref: "main" }, ctx)).toMatch(/ERRORE/);
    expect(await executeTool("gh_trigger_workflow", { workflow: "ci.yml", ref: "" }, ctx)).toMatch(/ERRORE/);
    expect(await executeTool("gh_trigger_workflow", {}, ctx)).toMatch(/ERRORE/);
  });

  it("calls triggerWorkflow and emits INFO on success", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(null, { status: 204 }))));
    const { ctx, events } = mkCtx({ branch: "sams/alice/fix" });
    const res = await executeTool("gh_trigger_workflow", { workflow: "ci.yml", ref: "sams/alice/fix" }, ctx);
    expect(res).toContain("ci.yml");
    expect(res).toContain("sams/alice/fix");
    expect(res).toContain("gh_list_ci");
    const last = events.at(-1)!;
    expect(last.level).toBe("INFO");
    expect(last.message).toContain("ci.yml");
  });

  it("passes optional inputs to the workflow", async () => {
    let capturedBody: unknown;
    vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(String(init.body));
      return Promise.resolve(new Response(null, { status: 204 }));
    }));
    const { ctx } = mkCtx();
    await executeTool("gh_trigger_workflow", {
      workflow: "test.yml",
      ref: "b",
      inputs: { env: "staging" },
    }, ctx);
    expect((capturedBody as { inputs: { env: string } }).inputs.env).toBe("staging");
  });

  // Collaudo 21/11, punto 4 (limite deciso il 20/11): niente workflow fuori dal branch del
  // task, e con l'approvazione obbligatoria il workflow aspetta una persona.
  it("rifiuta un ref diverso dal branch del task, senza chiamare GitHub", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { ctx, events } = mkCtx();
    const res = await executeTool("gh_trigger_workflow", { workflow: "deploy.yml", ref: "main" }, ctx);
    expect(res).toMatch(/^NON AVVIATO/);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(events.at(-1)?.level).toBe("WARN");
  });

  it("con l'approvazione obbligatoria non parte: resta in attesa con il lavoro", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { ctx } = mkCtx({ requireApproval: true });
    const res = await executeTool("gh_trigger_workflow", { workflow: "ci.yml", ref: "b" }, ctx);
    expect(res).toMatch(/^IN ATTESA/);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(ctx.workflowRequest).toEqual({ workflow: "ci.yml", ref: "b" });
  });
});

describe("executeTool — gh_trigger_workflow senza CI (simulazione 21/11: 404 secco)", () => {
  const stub = (workflows: Array<{ name: string; path: string }>, dispatchStatus = 404) =>
    vi.stubGlobal("fetch", vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return Promise.resolve(new Response(JSON.stringify({ message: "Not Found" }), { status: dispatchStatus }));
      }
      expect(url).toContain("/actions/workflows");
      return Promise.resolve(new Response(JSON.stringify({ total_count: workflows.length, workflows }), { status: 200 }));
    }));

  it("repo senza workflow: lo dice e spiega cosa fare, senza errore", async () => {
    stub([]);
    const { ctx, events } = mkCtx();
    const res = await executeTool("gh_trigger_workflow", { workflow: "ci.yml", ref: "b" }, ctx);
    expect(res).toMatch(/non ha nessun workflow/);
    expect(res).toContain(".github/workflows/");
    expect(res).toContain("workflow_dispatch");
    expect(events.some((e) => e.level === "ERROR")).toBe(false);
  });

  it("nome sbagliato: elenca i workflow che esistono", async () => {
    stub([{ name: "Test", path: ".github/workflows/test.yml" }]);
    const { ctx } = mkCtx();
    const res = await executeTool("gh_trigger_workflow", { workflow: "ci.yml", ref: "b" }, ctx);
    expect(res).toContain("«ci.yml» non esiste");
    expect(res).toContain("test.yml");
  });

  it("repo senza workflow: il secondo tentativo con un altro nome non interroga GitHub", async () => {
    stub([]);
    const { ctx } = mkCtx();
    await executeTool("gh_trigger_workflow", { workflow: "ci.yml", ref: "b" }, ctx);
    expect(ctx.ciNotRun).toBe("no-workflows");
    const calls = (globalThis.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length;
    const res = await executeTool("gh_trigger_workflow", { workflow: "test.yml", ref: "b" }, ctx);
    expect(res).toMatch(/GIÀ VERIFICATO/);
    expect(res).toMatch(/Non riprovare/);
    expect((globalThis.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(calls);
  });

  it("nome sbagliato non blocca un secondo tentativo con il nome giusto", async () => {
    stub([{ name: "Test", path: ".github/workflows/test.yml" }]);
    const { ctx } = mkCtx();
    await executeTool("gh_trigger_workflow", { workflow: "ci.yml", ref: "b" }, ctx);
    expect(ctx.ciNotRun).toBe("failed");
    const res = await executeTool("gh_trigger_workflow", { workflow: "test.yml", ref: "b" }, ctx);
    expect(res).not.toMatch(/GIÀ VERIFICATO/);
  });

  it("workflow senza workflow_dispatch (422): lo spiega", async () => {
    stub([{ name: "CI", path: ".github/workflows/ci.yml" }], 422);
    const { ctx } = mkCtx();
    const res = await executeTool("gh_trigger_workflow", { workflow: "ci.yml", ref: "b" }, ctx);
    expect(res).toMatch(/workflow_dispatch/);
  });
});

describe("executeTool — web_fetch", () => {
  it("rejects a non-http(s) URL without fetching", async () => {
    const { ctx } = mkCtx();
    expect(await executeTool("web_fetch", { url: "ftp://x" }, ctx)).toMatch(/URL non valida/);
  });

  it("strips HTML and returns readable text on 200", async () => {
    vi.stubGlobal("fetch", vi.fn(() =>
      Promise.resolve(new Response("<p>Hello <b>world</b></p>", { status: 200, headers: { "content-type": "text/html" } })),
    ));
    const { ctx } = mkCtx();
    const res = await executeTool("web_fetch", { url: "https://x" }, ctx);
    expect(res).toContain("Hello world");
    expect(res).not.toContain("<p>");
  });

  it("returns an ERRORE on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("nope", { status: 404 }))));
    const { ctx } = mkCtx();
    expect(await executeTool("web_fetch", { url: "https://x" }, ctx)).toMatch(/HTTP 404/);
  });

  it("refuses an internal address without fetching it", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    const { ctx } = mkCtx();
    expect(await executeTool("web_fetch", { url: "http://localhost:8787/api/status" }, ctx)).toMatch(/interno/);
    expect(await executeTool("web_fetch", { url: "https://inside/secret" }, ctx)).toMatch(/interno/);
    expect(f).not.toHaveBeenCalled();
  });

  it("re-checks every redirect hop (a public URL can't bounce to localhost)", async () => {
    const f = vi.fn(() =>
      Promise.resolve(new Response(null, { status: 302, headers: { location: "http://127.0.0.1:8787/api/status" } })),
    );
    vi.stubGlobal("fetch", f);
    const { ctx } = mkCtx();
    expect(await executeTool("web_fetch", { url: "https://x" }, ctx)).toMatch(/interno/);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("refuses a body over the cap even without content-length (chunked)", async () => {
    const big = "y".repeat(2_100_000);
    vi.stubGlobal("fetch", vi.fn(() =>
      Promise.resolve(new Response(new Blob([big]).stream(), { status: 200, headers: { "content-type": "text/plain" } })),
    ));
    const { ctx } = mkCtx();
    expect(await executeTool("web_fetch", { url: "https://x" }, ctx)).toMatch(/troppo grande/);
  });

  it("refuses an over-large response by content-length", async () => {
    vi.stubGlobal("fetch", vi.fn(() =>
      Promise.resolve(new Response("x", { status: 200, headers: { "content-length": "9999999" } })),
    ));
    const { ctx } = mkCtx();
    expect(await executeTool("web_fetch", { url: "https://x" }, ctx)).toMatch(/troppo grande/);
  });
});

// Ultrareview 2026-11-11: uscendo prima di leggere la risposta (redirect, non-ok,
// Content-Length eccessivo) il body non veniva annullato e il socket continuava a riempire
// la memoria fino al timeout.
describe("executeTool — web_fetch annulla i body che non legge", () => {
  function trackedResponse(status: number, headers: Record<string, string> = {}) {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ pull() { /* non finisce mai da solo */ }, cancel });
    return { res: new Response(body, { status, headers }), cancel };
  }

  it("risposta non-ok", async () => {
    const t = trackedResponse(500);
    vi.stubGlobal("fetch", vi.fn(async () => t.res));
    const { ctx } = mkCtx();
    expect(await executeTool("web_fetch", { url: "https://x" }, ctx)).toMatch(/HTTP 500/);
    expect(t.cancel).toHaveBeenCalled();
  });

  it("Content-Length oltre il limite", async () => {
    const t = trackedResponse(200, { "content-length": String(50_000_000) });
    vi.stubGlobal("fetch", vi.fn(async () => t.res));
    const { ctx } = mkCtx();
    expect(await executeTool("web_fetch", { url: "https://x" }, ctx)).toMatch(/troppo grande/);
    expect(t.cancel).toHaveBeenCalled();
  });

  it("redirect: il body della risposta 3xx si annulla prima di seguirlo", async () => {
    const hop = trackedResponse(302, { location: "https://x/dopo" });
    const f = vi.fn().mockResolvedValueOnce(hop.res).mockResolvedValueOnce(new Response("fine", { status: 200 }));
    vi.stubGlobal("fetch", f);
    const { ctx } = mkCtx();
    expect(await executeTool("web_fetch", { url: "https://x" }, ctx)).toBe("fine");
    expect(hop.cancel).toHaveBeenCalled();
  });
});

describe("summaryWithCiNote — i test non girati finiscono nel riassunto (simulazione 21/11)", () => {
  it("repo senza CI: aggiunge la nota una volta sola", () => {
    const ctx = { doneSummary: "Fatto il ripristino.", ciNotRun: "no-workflows" as const };
    const once = summaryWithCiNote(ctx);
    expect(once).toBe("Fatto il ripristino.\n\nNota di SAMS: i test non sono stati eseguiti (la repo non ha una CI).");
    expect(summaryWithCiNote({ ...ctx, doneSummary: once })).toBe(once);
  });

  it("se un workflow è partito o la CI non è stata toccata, il riassunto resta com'è", () => {
    expect(summaryWithCiNote({ doneSummary: "ok", ciNotRun: "failed", ciStarted: true })).toBe("ok");
    expect(summaryWithCiNote({ doneSummary: "ok" })).toBe("ok");
  });
});

describe("summaryWithReadsNote — i file letti davvero finiscono nel riassunto (simulazione 22/11)", () => {
  it("elenca ogni file una volta sola, anche se letto a pezzi, nell'ordine di lettura", () => {
    const reads = new Set(["package.json@0", "server/src/a.ts@0", "server/src/a.ts@12000", "client/x.tsx@0"]);
    const once = summaryWithReadsNote({ doneSummary: "Tutto valido.", reads });
    expect(once).toBe("Tutto valido.\n\nNota di SAMS: file letti davvero in questo task (3): package.json, server/src/a.ts, client/x.tsx");
    expect(summaryWithReadsNote({ doneSummary: once, reads, readsNoted: true })).toBe(once);
  });

  it("una nota scritta dal modello nel riassunto non fa saltare quella vera", () => {
    const forged = "Tutto valido.\n\nNota di SAMS: file letti davvero in questo task (9): tutto";
    const out = summaryWithReadsNote({ doneSummary: forged, reads: new Set(["package.json@0"]) });
    expect(out.endsWith("Nota di SAMS: file letti davvero in questo task (1): package.json")).toBe(true);
  });

  it("senza letture o senza riassunto non aggiunge niente", () => {
    expect(summaryWithReadsNote({ doneSummary: "ok" })).toBe("ok");
    expect(summaryWithReadsNote({ doneSummary: "ok", reads: new Set() })).toBe("ok");
    expect(summaryWithReadsNote({ doneSummary: "  ", reads: new Set(["a@0"]) })).toBe("  ");
  });

  it("oltre il limite elenca i primi e conta gli altri", () => {
    const reads = new Set(Array.from({ length: 45 }, (_, i) => `f${i}.ts@0`));
    const out = summaryWithReadsNote({ doneSummary: "ok", reads });
    expect(out).toContain("(45): f0.ts, ");
    expect(out).toContain("f39.ts e altri 5");
    expect(out).not.toContain("f40.ts");
  });
});

describe("finalizeTask — workflow in attesa (collaudo 21/11, punto 4)", () => {
  afterEach(() => { clearPending("a"); });
  it("solo un workflow chiesto: l'agente aspetta l'approvazione con il workflow in sospeso", async () => {
    const { ctx, events } = mkCtx({ requireApproval: true, workflowRequest: { workflow: "ci.yml", ref: "b" }, finished: true });
    await finalizeTask(ctx, { totalTokens: 0, repoEnabled: false, notionEnabled: false, prProviderLabel: "t" });
    const ev = events.find((e) => e.status === "awaiting_approval");
    expect(ev?.pendingWorkflow).toEqual({ workflow: "ci.yml", ref: "b" });
    expect(ev?.mainGate).toBeUndefined();
    expect(getPending("a")?.workflow).toEqual({ workflow: "ci.yml", ref: "b" });
  });
});

describe("finalizeTask — sala d'attesa per il branch principale (scelta del 21/11)", () => {
  afterEach(() => { clearPending("a"); });
  const opts = { totalTokens: 0, repoEnabled: false, notionEnabled: false, prProviderLabel: "t" };

  it("file per main: in attesa con mainGate, mai committati", async () => {
    const { ctx, events } = mkCtx({ branch: "main", stagedFiles: [{ path: "a.txt", content: "x", message: "m" }], finished: true });
    await finalizeTask(ctx, opts);
    const ev = events.find((e) => e.status === "awaiting_approval");
    expect(ev?.mainGate).toBe(true);
    expect(ev?.message).toMatch(/sala d'attesa/);
    expect(isMainGate(getPending("a"))).toBe(true);
  });

  it("merge chiesto: l'agente finisce in sala d'attesa con il merge in sospeso", async () => {
    const { ctx, events } = mkCtx({ mergeRequest: { prNumber: 3, method: "squash", headSha: "abc1234def", headRef: "feat", baseRef: "main", title: "T" }, finished: true });
    await finalizeTask(ctx, opts);
    const last = events.filter((e) => e.status).pop();
    expect(last?.status).toBe("awaiting_approval");
    expect(last?.pendingMerge).toEqual({ prNumber: 3, method: "squash", headSha: "abc1234def", headRef: "feat", baseRef: "main", title: "T" });
    expect(getPending("a")?.merge?.prNumber).toBe(3);
  });

  it("file su un branch di lavoro con approvazione: attesa normale, niente sala d'attesa", async () => {
    const { ctx, events } = mkCtx({ requireApproval: true, stagedFiles: [{ path: "a.txt", content: "x", message: "m" }], finished: true });
    await finalizeTask(ctx, opts);
    expect(events.find((e) => e.status === "awaiting_approval")?.mainGate).toBeUndefined();
    expect(isMainGate(getPending("a"))).toBe(false);
  });
});

// Collaudo 21/11, punto 1: la proposta di un task di sola lettura arrivava alla UI solo
// tagliata a una riga. Ora il riassunto completo viaggia in un evento `result` a parte.
describe("finalizeTask — risultato completo alla UI", () => {
  const opts = { totalTokens: 0, repoEnabled: false, notionEnabled: false, prProviderLabel: "t" };

  it("manda il riassunto intero, non tagliato, con il titolo del task", async () => {
    const long = "Proposta per il README:\n" + "riga lunga ".repeat(60);
    const { ctx, events } = mkCtx({ doneSummary: long, finished: true });
    await finalizeTask(ctx, opts);
    const ev = events.find((e) => e.result);
    expect(ev?.result?.summary.startsWith(long)).toBe(true);
    expect(ev?.result?.title).toBe(ctx.title);
    expect(ev?.message).toBeUndefined();
  });

  it("senza riassunto non manda niente", async () => {
    const { ctx, events } = mkCtx({ doneSummary: "", finished: true });
    await finalizeTask(ctx, opts);
    expect(events.some((e) => e.result)).toBe(false);
  });
});
