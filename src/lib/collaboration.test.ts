import { describe, expect, it } from "vitest";
import {
  BUILTIN_PLAYBOOKS,
  addContributor,
  advanceRun,
  formatDuration,
  runRetrospective,
  currentStage,
  expandStageTitle,
  isRunComplete,
  MAX_STAGES,
  playbookSummary,
  runLabel,
  runMatching,
  runProgress,
  sanitizePlaybookInput,
  sanitizeStage,
  startRun,
  type Playbook,
  type PlaybookRun,
} from "./collaboration";

const pb = (over: Partial<Playbook> = {}): Playbook => ({
  id: "pb1",
  name: "Rilascio",
  goal: "modulo auth",
  branch: "main",
  stages: [
    { role: "dev", title: "Implementa {goal}" },
    { role: "reviewer", title: "Rivedi {goal}" },
    { role: "qa", title: "Testa {goal}" },
  ],
  ...over,
});

describe("sanitizeStage", () => {
  it("trims and keeps valid stages", () => {
    expect(sanitizeStage({ role: " dev ", title: " fai x " })).toEqual({ role: "dev", title: "fai x" });
  });
  it("rejects empty role or title", () => {
    expect(sanitizeStage({ role: "", title: "x" })).toBeNull();
    expect(sanitizeStage({ role: "dev", title: "   " })).toBeNull();
  });
});

describe("sanitizePlaybookInput", () => {
  it("keeps a valid playbook and drops invalid stages", () => {
    const out = sanitizePlaybookInput({
      name: " Rilascio ",
      goal: "auth",
      branch: "",
      stages: [
        { role: "dev", title: "a" },
        { role: "", title: "invalido" },
        { role: "qa", title: "" },
      ],
    });
    expect(out).not.toBeNull();
    expect(out!.name).toBe("Rilascio");
    expect(out!.stages).toEqual([{ role: "dev", title: "a" }]);
  });
  it("returns null without a name or without any valid stage", () => {
    expect(sanitizePlaybookInput({ name: "", stages: [{ role: "dev", title: "a" }] })).toBeNull();
    expect(sanitizePlaybookInput({ name: "X", stages: [] })).toBeNull();
    expect(sanitizePlaybookInput({ name: "X", stages: [{ role: "", title: "" }] })).toBeNull();
  });
  it("caps the number of stages", () => {
    const many = Array.from({ length: MAX_STAGES + 5 }, (_, i) => ({ role: "r", title: `t${i}` }));
    const out = sanitizePlaybookInput({ name: "X", stages: many });
    expect(out!.stages).toHaveLength(MAX_STAGES);
  });
});

describe("expandStageTitle", () => {
  it("replaces the {goal} placeholder", () => {
    expect(expandStageTitle({ title: "Implementa {goal} ora" }, "auth")).toBe("Implementa auth ora");
  });
  it("leaves a title without placeholder untouched", () => {
    expect(expandStageTitle({ title: "Fai la cosa" }, "auth")).toBe("Fai la cosa");
  });
});

describe("run lifecycle", () => {
  it("startRun snapshots the playbook at stage 0", () => {
    const run = startRun(pb(), "run1", 1000);
    expect(run.stageIndex).toBe(0);
    expect(run.done).toBe(false);
    expect(run.stages).toHaveLength(3);
    expect(currentStage(run)).toEqual({ role: "dev", title: "Implementa {goal}" });
    expect(run.startedAt).toBe(1000);
  });

  it("startRun on an empty playbook is born done", () => {
    const run = startRun(pb({ stages: [] }), "run1", 0);
    expect(run.done).toBe(true);
    expect(isRunComplete(run)).toBe(true);
    expect(currentStage(run)).toBeNull();
  });

  it("advanceRun steps through and completes after the last stage", () => {
    let run = startRun(pb(), "run1", 0);
    run = advanceRun(run); // -> stage 1
    expect(run.stageIndex).toBe(1);
    expect(run.done).toBe(false);
    run = advanceRun(run); // -> stage 2
    run = advanceRun(run); // -> past end
    expect(run.done).toBe(true);
    expect(isRunComplete(run)).toBe(true);
    expect(currentStage(run)).toBeNull();
  });

  it("advanceRun is idempotent once done", () => {
    let run = startRun(pb({ stages: [{ role: "dev", title: "x" }] }), "run1", 0);
    run = advanceRun(run);
    const after = advanceRun(run);
    expect(after).toBe(run);
  });

  it("runProgress reports 0..1", () => {
    let run = startRun(pb(), "run1", 0);
    expect(runProgress(run)).toBe(0);
    run = advanceRun(run);
    expect(runProgress(run)).toBeCloseTo(1 / 3);
    run = advanceRun(run);
    run = advanceRun(run);
    expect(runProgress(run)).toBe(1);
  });
});

describe("contributors & retrospective", () => {
  it("startRun begins with no contributors", () => {
    expect(startRun(pb(), "r", 0).contributors).toEqual([]);
  });

  it("addContributor appends, dedups and trims", () => {
    let run = startRun(pb(), "r", 0);
    run = addContributor(run, " dev ");
    run = addContributor(run, "qa");
    run = addContributor(run, "dev"); // dup, ignored
    expect(run.contributors).toEqual(["dev", "qa"]);
  });

  it("addContributor ignores blank names", () => {
    const run = addContributor(startRun(pb(), "r", 0), "   ");
    expect(run.contributors).toEqual([]);
  });

  it("formatDuration renders s / m / h", () => {
    expect(formatDuration(45_000)).toBe("45s");
    expect(formatDuration(192_000)).toBe("3m 12s");
    expect(formatDuration(3_840_000)).toBe("1h 4m");
  });

  it("runRetrospective summarizes stages, duration and people", () => {
    let run = startRun(pb(), "r", 1000);
    run = addContributor(run, "dev");
    run = addContributor(run, "qa");
    expect(runRetrospective(run, 1000 + 130_000)).toBe('Tavolo "Rilascio" · 3 stadi · 2m 10s · con dev, qa');
  });

  it("runRetrospective omits the people clause when there are none", () => {
    const run = startRun(pb({ stages: [{ role: "d", title: "t" }] }), "r", 0);
    expect(runRetrospective(run, 5000)).toBe('Tavolo "Rilascio" · 1 stadio · 5s');
  });
});

describe("runMatching", () => {
  const runs = (): PlaybookRun[] => [startRun(pb(), "run1", 0)];

  it("matches the current stage by expanded title and role", () => {
    expect(runMatching(runs(), { title: "Implementa modulo auth", role: "dev" })?.id).toBe("run1");
  });
  it("is case-insensitive on role and title", () => {
    expect(runMatching(runs(), { title: "implementa MODULO auth", role: "DEV" })?.id).toBe("run1");
  });
  it("does not match a later stage's title", () => {
    expect(runMatching(runs(), { title: "Rivedi modulo auth", role: "reviewer" })).toBeUndefined();
  });
  it("does not match when the role differs", () => {
    expect(runMatching(runs(), { title: "Implementa modulo auth", role: "qa" })).toBeUndefined();
  });
  it("skips done runs", () => {
    const done = [{ ...startRun(pb(), "run1", 0), done: true }];
    expect(runMatching(done, { title: "Implementa modulo auth", role: "dev" })).toBeUndefined();
  });
});

describe("BUILTIN_PLAYBOOKS", () => {
  it("are all valid inputs (survive sanitize unchanged)", () => {
    for (const t of BUILTIN_PLAYBOOKS) {
      const out = sanitizePlaybookInput(t);
      expect(out).not.toBeNull();
      expect(out!.stages).toEqual(t.stages);
      expect(out!.name).toBe(t.name);
    }
  });
  it("have unique names and at least two stages each", () => {
    const names = BUILTIN_PLAYBOOKS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const t of BUILTIN_PLAYBOOKS) expect(t.stages.length).toBeGreaterThanOrEqual(2);
  });
});

describe("labels", () => {
  it("playbookSummary counts stages with singular/plural", () => {
    expect(playbookSummary(pb())).toBe("Rilascio · 3 stadi");
    expect(playbookSummary(pb({ stages: [{ role: "d", title: "t" }] }))).toBe("Rilascio · 1 stadio");
  });
  it("runLabel shows progress then a check", () => {
    let run = startRun(pb(), "run1", 0);
    expect(runLabel(run)).toBe("Rilascio — 1/3");
    run = advanceRun(run);
    expect(runLabel(run)).toBe("Rilascio — 2/3");
    run = advanceRun(run);
    run = advanceRun(run);
    expect(runLabel(run)).toBe("Rilascio — ✓");
  });
});
