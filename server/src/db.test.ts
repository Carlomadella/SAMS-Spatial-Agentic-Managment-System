import { describe, expect, it } from "vitest";
import {
  clearMemory,
  deleteRoutine,
  getMemory,
  insertRoutine,
  insertTask,
  listMemory,
  listRoutines,
  markRoutineRun,
  openDb,
  recentTasks,
  setMemory,
  setRoutineEnabled,
  taskStats,
  type TaskLogEntry,
} from "./db";
import type { RoutineInput } from "./routines";

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

describe("db agent_memory", () => {
  it("starts with no memories", () => {
    const db = openDb(":memory:");
    expect(listMemory(db, "agent-1")).toEqual([]);
    expect(getMemory(db, "agent-1", "key")).toBeNull();
  });

  it("sets and reads a memory entry", () => {
    const db = openDb(":memory:");
    setMemory(db, "agent-1", "arch", "monorepo React+Express");
    expect(getMemory(db, "agent-1", "arch")).toBe("monorepo React+Express");
  });

  it("updates an existing key (upsert)", () => {
    const db = openDb(":memory:");
    setMemory(db, "agent-1", "key", "old");
    setMemory(db, "agent-1", "key", "new");
    expect(getMemory(db, "agent-1", "key")).toBe("new");
    expect(listMemory(db, "agent-1")).toHaveLength(1);
  });

  it("isolates memories by agentId", () => {
    const db = openDb(":memory:");
    setMemory(db, "agent-1", "key", "value-1");
    setMemory(db, "agent-2", "key", "value-2");
    expect(getMemory(db, "agent-1", "key")).toBe("value-1");
    expect(getMemory(db, "agent-2", "key")).toBe("value-2");
  });

  it("lists all memories for an agent", () => {
    const db = openDb(":memory:");
    setMemory(db, "a", "k1", "v1");
    setMemory(db, "a", "k2", "v2");
    const rows = listMemory(db, "a");
    expect(rows).toHaveLength(2);
    const keys = rows.map((r) => r.key).sort();
    expect(keys).toEqual(["k1", "k2"]);
  });

  it("clears all memories for an agent", () => {
    const db = openDb(":memory:");
    setMemory(db, "a", "k1", "v1");
    setMemory(db, "a", "k2", "v2");
    clearMemory(db, "a");
    expect(listMemory(db, "a")).toEqual([]);
  });

  it("does not clear memories of other agents", () => {
    const db = openDb(":memory:");
    setMemory(db, "a", "key", "va");
    setMemory(db, "b", "key", "vb");
    clearMemory(db, "a");
    expect(getMemory(db, "b", "key")).toBe("vb");
  });
});

describe("db routines", () => {
  const input = (over: Partial<RoutineInput> = {}): RoutineInput => ({
    name: "Riepilogo",
    title: "Riepiloga le PR",
    branch: "",
    kind: "interval",
    intervalMin: 60,
    atHour: 9,
    atMin: 0,
    enabled: true,
    ...over,
  });

  it("starts empty and inserts/reads back routines oldest-first", () => {
    const db = openDb(":memory:");
    expect(listRoutines(db)).toEqual([]);
    insertRoutine(db, "r1", input({ name: "A" }));
    insertRoutine(db, "r2", input({ name: "B", kind: "daily", atHour: 8, atMin: 30 }));
    const rows = listRoutines(db);
    expect(rows.map((r) => r.id)).toEqual(["r1", "r2"]);
    expect(rows[1]).toMatchObject({ kind: "daily", atHour: 8, atMin: 30, lastRun: 0 });
  });

  it("toggles enabled and stamps last-run", () => {
    const db = openDb(":memory:");
    insertRoutine(db, "r1", input());
    setRoutineEnabled(db, "r1", false);
    markRoutineRun(db, "r1", 12345);
    const r = listRoutines(db)[0];
    expect(r.enabled).toBe(false);
    expect(r.lastRun).toBe(12345);
  });

  it("deletes a routine", () => {
    const db = openDb(":memory:");
    insertRoutine(db, "r1", input());
    insertRoutine(db, "r2", input());
    deleteRoutine(db, "r1");
    expect(listRoutines(db).map((r) => r.id)).toEqual(["r2"]);
  });
});
