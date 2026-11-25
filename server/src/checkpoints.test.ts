import { describe, expect, it } from "vitest";
import { openDb } from "./db";
import { createTask } from "./tasks";
import { applyStep, CHECKPOINT_TTL_MS, checkpointPrompt, emptyCheckpoint, isUsable, loadCheckpoint, pruneCheckpoints, saveCheckpoint } from "./checkpoints";

const T = 1_000_000;

describe("punto di lavoro — regole", () => {
  it("raccoglie piano, passi, file letti e scritti, ultimo problema", () => {
    let cp = emptyCheckpoint(1);
    cp = applyStep(cp, "announce_plan", { steps: ["leggi", "correggi", "testa"] }, "ok", T);
    cp = applyStep(cp, "gh_read_file", { path: "src/login.ts" }, "export function login() {\n  return true;\n}", T + 1);
    cp = applyStep(cp, "gh_read_files", { paths: ["a.ts", "b.ts"] }, "...", T + 2);
    cp = applyStep(cp, "gh_write_files", { files: [{ path: "src/login.ts" }, { path: "src/login.test.ts" }] }, "ok", T + 3);
    cp = applyStep(cp, "gh_trigger_workflow", { workflow: "ci.yml" }, "ERRORE: workflow non trovato", T + 4);
    cp = applyStep(cp, "done", { summary: "x" }, "ok", T + 5);
    expect(cp.plan).toEqual(["leggi", "correggi", "testa"]);
    expect(cp.steps.map((s) => [s.tool, s.target, s.ok])).toEqual([
      ["gh_read_file", "src/login.ts", true],
      ["gh_read_files", "a.ts, b.ts", true],
      ["gh_write_files", "src/login.ts, src/login.test.ts", true],
      ["gh_trigger_workflow", "ci.yml", false],
    ]);
    expect(cp.filesRead["src/login.ts"]).toBe("export function login() { return true; }");
    expect(Object.keys(cp.filesRead)).toEqual(["src/login.ts", "a.ts", "b.ts"]);
    expect(cp.filesWritten).toEqual(["src/login.ts", "src/login.test.ts"]);
    expect(cp.lastProblem).toMatch(/gh_trigger_workflow ci.yml: ERRORE: workflow non trovato/);
    expect(cp.updatedAt).toBe(T + 5);
  });

  it("vale 24 ore e solo se c'è qualcosa dentro", () => {
    const cp = applyStep(emptyCheckpoint(1), "gh_read_file", { path: "a" }, "x", T);
    expect(isUsable(cp, T + CHECKPOINT_TTL_MS - 1)).toBe(true);
    expect(isUsable(cp, T + CHECKPOINT_TTL_MS + 1)).toBe(false);
    expect(isUsable(emptyCheckpoint(1), T)).toBe(false);
    expect(isUsable(null, T)).toBe(false);
  });

  it("il riassunto per il tentativo dopo dice di non ripetere", () => {
    let cp = applyStep(emptyCheckpoint(2), "announce_plan", { steps: ["uno"] }, "ok", T);
    cp = applyStep(cp, "gh_read_file", { path: "README.md" }, "# Titolo", T);
    const p = checkpointPrompt(cp);
    expect(p).toMatch(/^RIPRESA: questo task è già stato iniziato \(tentativo 2\)/);
    expect(p).toContain("1. uno");
    expect(p).toContain("- README.md: # Titolo");
  });

  it("niente liste infinite", () => {
    let cp = emptyCheckpoint(1);
    for (let i = 0; i < 100; i++) cp = applyStep(cp, "gh_read_file", { path: `f${i}.ts` }, "x", T);
    expect(cp.steps).toHaveLength(40);
    expect(Object.keys(cp.filesRead)).toHaveLength(30);
    expect(cp.filesRead["f99.ts"]).toBe("x");
  });
});

describe("punto di lavoro — database", () => {
  it("si salva, si rilegge e scade", async () => {
    const db = await openDb(":memory:");
    const t = await createTask(db, { agentId: "a", agentName: "Blue", title: "x", branch: "", createdBy: "Carlo" });
    const cp = applyStep(emptyCheckpoint(1), "gh_read_file", { path: "a" }, "x", T);
    await saveCheckpoint(db, t.id, cp);
    await saveCheckpoint(db, t.id, applyStep(cp, "gh_read_file", { path: "b" }, "y", T + 10));
    expect((await loadCheckpoint(db, t.id))?.steps).toHaveLength(2);
    expect(await pruneCheckpoints(db, T + 10 + CHECKPOINT_TTL_MS - 1)).toBe(0);
    expect(await pruneCheckpoints(db, T + 10 + CHECKPOINT_TTL_MS + 1)).toBe(1);
    expect(await loadCheckpoint(db, t.id)).toBeNull();
  });
});
