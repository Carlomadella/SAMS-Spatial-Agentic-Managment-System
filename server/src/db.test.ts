import { describe, expect, it } from "vitest";
import { clearMemory, getMemory, insertTask, listMemory, openDb, recentTasks, setMemory, taskStats, type TaskLogEntry } from "./db";

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
