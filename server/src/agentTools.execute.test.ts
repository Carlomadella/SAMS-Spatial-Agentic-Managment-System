import { afterEach, describe, expect, it, vi } from "vitest";
import type { Settings } from "./config";
import { PROGRESS_CAP, PROGRESS_START, PROGRESS_STEP, executeTool, type ToolContext } from "./agentTools";
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
    const { ctx, events } = mkCtx();
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
      ref: "main",
      inputs: { env: "staging" },
    }, ctx);
    expect((capturedBody as { inputs: { env: string } }).inputs.env).toBe("staging");
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
