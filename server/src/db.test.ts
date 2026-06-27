import { describe, expect, it } from "vitest";
import { insertTask, openDb, recentTasks, taskStats, type TaskLogEntry } from "./db";

const entry = (over: Partial<TaskLogEntry> = {}): TaskLogEntry => ({
  agentId: "a",
  agentName: "Blue",
  title: "Task",
  branch: "b",
  status: "review",
  tokens: 100,
  ts: 1000,
  ...over,
});

describe("db task_log", () => {
  it("opens an in-memory db with an empty log", () => {
    const db = openDb(":memory:");
    expect(recentTasks(db)).toEqual([]);
    expect(taskStats(db)).toEqual({ total: 0, completed: 0, tokens: 0 });
  });

  it("inserts and reads back tasks newest-first", () => {
    const db = openDb(":memory:");
    insertTask(db, entry({ title: "first", ts: 1 }));
    insertTask(db, entry({ title: "second", ts: 2 }));
    const rows = recentTasks(db);
    expect(rows.map((r) => r.title)).toEqual(["second", "first"]);
    expect(rows[0]).toMatchObject({ agentName: "Blue", tokens: 100 });
  });

  it("respects the limit", () => {
    const db = openDb(":memory:");
    for (let i = 0; i < 5; i++) insertTask(db, entry({ ts: i }));
    expect(recentTasks(db, 3)).toHaveLength(3);
  });

  it("aggregates totals, completed and tokens", () => {
    const db = openDb(":memory:");
    insertTask(db, entry({ status: "review", tokens: 10 }));
    insertTask(db, entry({ status: "done", tokens: 20 }));
    insertTask(db, entry({ status: "idle", tokens: 5 })); // not "completed"
    expect(taskStats(db)).toEqual({ total: 3, completed: 2, tokens: 35 });
  });
});
