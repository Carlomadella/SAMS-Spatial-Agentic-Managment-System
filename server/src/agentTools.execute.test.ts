import { afterEach, describe, expect, it, vi } from "vitest";
import type { Settings } from "./config";
import { PROGRESS_CAP, PROGRESS_START, PROGRESS_STEP, executeTool, type ToolContext } from "./agentTools";
import type { WireEvent } from "./types";

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

  it("refuses an over-large response by content-length", async () => {
    vi.stubGlobal("fetch", vi.fn(() =>
      Promise.resolve(new Response("x", { status: 200, headers: { "content-length": "9999999" } })),
    ));
    const { ctx } = mkCtx();
    expect(await executeTool("web_fetch", { url: "https://x" }, ctx)).toMatch(/troppo grande/);
  });
});
