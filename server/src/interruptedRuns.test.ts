import { describe, expect, it } from "vitest";
import { deleteTaskRun, latestTaskPerAgent, listTaskRuns, openDb, recentTasks, saveTaskRun } from "./db";
import { INTERRUPTED_SUMMARY, recoverInterruptedRuns, serverName } from "./interruptedRuns";

const run = { agentId: "a", agentName: "Sim-Revisore", title: "Rivedi la PR #3", branch: "sams/x", startedAt: 10, server: "pc:casa" };

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
    expect(await recoverInterruptedRuns(db, "pc:casa", 99)).toBe(1);
    const [row] = await recentTasks(db);
    expect(row).toMatchObject({ agentId: "a", title: "Rivedi la PR #3", status: "blocked", ts: 99 });
    expect((await latestTaskPerAgent(db)).get("a")).toMatchObject({ status: "blocked", title: "Rivedi la PR #3" });
    expect(await listTaskRuns(db)).toEqual([]);
    expect(INTERRUPTED_SUMMARY).toMatch(/riavviato/);
  });

  it("niente in corso: niente da fare", async () => {
    const db = await openDb(":memory:");
    expect(await recoverInterruptedRuns(db, "pc:casa")).toBe(0);
    expect(await recentTasks(db)).toEqual([]);
  });

  it("segna interrotti solo i task del proprio server: quelli dell'altro restano", async () => {
    const db = await openDb(":memory:");
    await saveTaskRun(db, run);
    await saveTaskRun(db, { ...run, agentId: "b", agentName: "Sim-Tester", server: "render:sams" });
    expect(await recoverInterruptedRuns(db, "render:sams", 99)).toBe(1);
    expect((await recentTasks(db)).map((t) => t.agentId)).toEqual(["b"]);
    expect(await listTaskRuns(db)).toEqual([run]);
  });

  it("le righe vecchie senza server le chiude chi si avvia (come prima)", async () => {
    const db = await openDb(":memory:");
    await saveTaskRun(db, { ...run, server: "" });
    expect(await recoverInterruptedRuns(db, "render:sams", 99)).toBe(1);
  });
});

describe("serverName", () => {
  it("Render si riconosce dalle sue variabili, il PC dal nome della macchina", () => {
    expect(serverName({ RENDER: "true", RENDER_SERVICE_NAME: "sams" }, "x")).toBe("render:sams");
    expect(serverName({}, "DESKTOP-1")).toBe("pc:DESKTOP-1");
    expect(serverName({ SAMS_SERVER_NAME: "prova" }, "x")).toBe("prova");
  });
});
