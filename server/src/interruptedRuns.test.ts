import { describe, expect, it } from "vitest";
import { deleteTaskRun, latestTaskPerAgent, listTaskRuns, openDb, recentTasks, saveTaskRun } from "./db";
import { INTERRUPTED_SUMMARY, recoverInterruptedRuns } from "./interruptedRuns";

const run = { agentId: "a", agentName: "Sim-Revisore", title: "Rivedi la PR #3", branch: "sams/x", startedAt: 10 };

describe("task_runs", () => {
  it("salva, sostituisce e toglie il task in corso di un agente", async () => {
    const db = await openDb(":memory:");
    await saveTaskRun(db, run);
    await saveTaskRun(db, { ...run, title: "nuovo", startedAt: 20 });
    expect(await listTaskRuns(db)).toEqual([{ ...run, title: "nuovo", startedAt: 20 }]);
    await deleteTaskRun(db, "a");
    expect(await listTaskRuns(db)).toEqual([]);
  });
});

describe("recoverInterruptedRuns", () => {
  it("un task rimasto in corso diventa «blocked» nello storico e nel mondo", async () => {
    const db = await openDb(":memory:");
    await saveTaskRun(db, run);
    expect(await recoverInterruptedRuns(db, 99)).toBe(1);
    const [row] = await recentTasks(db);
    expect(row).toMatchObject({ agentId: "a", title: "Rivedi la PR #3", status: "blocked", ts: 99 });
    expect((await latestTaskPerAgent(db)).get("a")).toMatchObject({ status: "blocked", title: "Rivedi la PR #3" });
    expect(await listTaskRuns(db)).toEqual([]);
    expect(INTERRUPTED_SUMMARY).toMatch(/riavviato/);
  });

  it("niente in corso: niente da fare", async () => {
    const db = await openDb(":memory:");
    expect(await recoverInterruptedRuns(db)).toBe(0);
    expect(await recentTasks(db)).toEqual([]);
  });
});
