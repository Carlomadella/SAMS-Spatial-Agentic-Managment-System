import { beforeEach, describe, expect, it } from "vitest";
import { RUN_STALE_MS, TaskCancelledError, beginRun, currentRun, endRun, requestCancel, resetRuns, throwIfCancelled } from "./taskRuns";

describe("un task alla volta per agente", () => {
  beforeEach(() => resetRuns());

  it("il secondo task per lo stesso agente è rifiutato finché il primo non finisce", () => {
    expect(beginRun("a1", "primo", 0)).toBe(true);
    expect(beginRun("a1", "secondo", 1000)).toBe(false);
    expect(beginRun("a2", "altro agente", 1000)).toBe(true);
    endRun("a1");
    expect(beginRun("a1", "secondo", 2000)).toBe(true);
  });

  it("un task rimasto appeso oltre il limite non blocca per sempre", () => {
    beginRun("a1", "appeso", 0);
    expect(beginRun("a1", "nuovo", RUN_STALE_MS + 1)).toBe(true);
  });

  it("annullare ferma il ciclo al prossimo strumento", () => {
    beginRun("a1", "lungo", 0);
    expect(() => throwIfCancelled("a1")).not.toThrow();
    expect(requestCancel("a1", "Mario", 10)).toBe(true);
    expect(() => throwIfCancelled("a1")).toThrow(TaskCancelledError);
    expect(() => throwIfCancelled("a1")).toThrow("Task annullato da Mario");
  });

  it("annullare un agente libero non fa nulla", () => {
    expect(requestCancel("a1", "Mario")).toBe(false);
    expect(currentRun("a1")).toBeNull();
  });
});

describe("executeTool si ferma su un task annullato", () => {
  beforeEach(() => resetRuns());

  it("lancia TaskCancelledError invece di eseguire lo strumento", async () => {
    const { executeTool } = await import("./agentTools");
    const { getSettings } = await import("./config");
    const ctx = {
      s: getSettings(), agentId: "a1", agentName: "Ada", title: "t", branch: "b", requireApproval: true,
      emit: () => {}, wroteFiles: false, notionWrote: false, branchReady: false, doneSummary: "",
      finished: false, progress: 0, stagedFiles: [],
    };
    beginRun("a1", "t");
    requestCancel("a1", "Mario");
    await expect(executeTool("done", { summary: "x" }, ctx)).rejects.toBeInstanceOf(TaskCancelledError);
    expect(ctx.finished).toBe(false);
  });
});
