import { afterAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  clearMemory,
  deleteRoutine,
  getMemory,
  insertChatMessage,
  insertRoutine,
  insertTask,
  listChatMessages,
  listMemory,
  listRoutines,
  loadWorldAgents,
  loadWorldSnapshot,
  markRoutineRun,
  openDb,
  pruneWorldTombstones,
  recentTasks,
  saveWorldAgents,
  setMemory,
  setRoutineEnabled,
  taskStats,
  TOMBSTONE_TTL_MS,
  type TaskLogEntry,
} from "./db";
import type { RoutineInput } from "./routines";
import type { WorldAgentSnapshot } from "./worldState";

// Directory temporanee create dai test su file (migrazione), ripulite alla fine.
const tmpDirs: string[] = [];
afterAll(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
});

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

describe("db world_agents (roster per-riga + tombstone)", () => {
  const agent = (over: Partial<WorldAgentSnapshot> = {}): WorldAgentSnapshot => ({
    id: "a1",
    name: "Blue",
    color: "blue",
    role: "Dev",
    status: "working",
    task: "Fix",
    progress: 40,
    ...over,
  });

  it("returns an empty snapshot before anything is saved", () => {
    const db = openDb(":memory:");
    expect(loadWorldSnapshot(db)).toEqual({ agents: [], version: 0, updatedAt: 0 });
  });

  it("saves, bumps the version and reads back", () => {
    const db = openDb(":memory:");
    const first = saveWorldAgents(db, [agent()]);
    expect(first.version).toBe(1);
    expect(first.updatedAt).toBeGreaterThan(0);

    const second = saveWorldAgents(db, [agent({ id: "a1", status: "done" }), agent({ id: "a2" })]);
    expect(second.version).toBe(2);

    const loaded = loadWorldSnapshot(db);
    expect(loaded.version).toBe(2);
    expect(loaded.agents.map((a) => a.id)).toEqual(["a1", "a2"]);
    expect(loaded.agents[0].status).toBe("done");
  });

  it("tombstona (non elimina) un agente sparito dal roster in arrivo", () => {
    const db = openDb(":memory:");
    saveWorldAgents(db, [agent({ id: "a1" }), agent({ id: "a2" })]);
    const snap = saveWorldAgents(db, [agent({ id: "a1" })]); // a2 sparito → tombstone
    const a2 = snap.agents.find((a) => a.id === "a2");
    expect(a2).toBeDefined();
    expect(a2!.deleted).toBe(true);
    // a1 resta vivo (nessun flag deleted)
    expect(snap.agents.find((a) => a.id === "a1")!.deleted).toBeUndefined();
  });

  it("un merge NON tombstona agenti solo perché un altro push arriva dopo", () => {
    const db = openDb(":memory:");
    saveWorldAgents(db, [agent({ id: "a1" })]);
    // push che aggiunge a2 tenendo a1: a1 non deve diventare tombstone
    const snap = saveWorldAgents(db, [agent({ id: "a1" }), agent({ id: "a2" })]);
    expect(snap.agents.every((a) => !a.deleted)).toBe(true);
    expect(snap.agents.map((a) => a.id).sort()).toEqual(["a1", "a2"]);
  });

  it("resuscita un id tombstoned se ricompare nel roster", () => {
    const db = openDb(":memory:");
    saveWorldAgents(db, [agent({ id: "a1" }), agent({ id: "a2" })]);
    saveWorldAgents(db, [agent({ id: "a1" })]); // a2 → tombstone
    const snap = saveWorldAgents(db, [agent({ id: "a1" }), agent({ id: "a2", status: "idle" })]); // a2 torna
    const a2 = snap.agents.find((a) => a.id === "a2");
    expect(a2!.deleted).toBeUndefined();
    expect(a2!.status).toBe("idle");
  });

  it("pota i tombstone più vecchi del TTL", () => {
    const db = openDb(":memory:");
    saveWorldAgents(db, [agent({ id: "a1" }), agent({ id: "a2" })]);
    saveWorldAgents(db, [agent({ id: "a1" })]); // a2 tombstoned adesso
    // prune col TTL standard non tocca un tombstone fresco…
    expect(pruneWorldTombstones(db, TOMBSTONE_TTL_MS)).toBe(0);
    expect(loadWorldAgents(db).some((a) => a.id === "a2")).toBe(true);
    // …ma con TTL 0 (tutto è "vecchio") lo rimuove davvero
    expect(pruneWorldTombstones(db, 0)).toBe(1);
    expect(loadWorldAgents(db).some((a) => a.id === "a2")).toBe(false);
  });

  it("migra il vecchio blob world_snapshot nella tabella per-riga alla riapertura", () => {
    const dir = mkdtempSync(join(tmpdir(), "sams-db-"));
    tmpDirs.push(dir);
    const file = join(dir, "legacy.db");

    // Stato legacy: agenti nel blob, tabella per-riga svuotata (com'era prima dell'opzione 1).
    const first = openDb(file);
    first.prepare(`INSERT INTO world_snapshot (id, agents, version, updated_at) VALUES (1, ?, 3, 111)`).run(
      JSON.stringify([{ id: "old", name: "Old", color: "green", role: "Dev", status: "review", task: "T", progress: 50 }]),
    );
    first.exec(`DELETE FROM world_agents`);
    first.close();

    // Riapertura → migrateWorldAgents semina la tabella dal blob.
    const db = openDb(file);
    const agents = loadWorldAgents(db);
    expect(agents.map((a) => a.id)).toEqual(["old"]);
    expect(agents[0]).toMatchObject({ name: "Old", role: "Dev", status: "review", task: "T", progress: 50 });
    // La versione globale del blob resta come contatore CAS.
    expect(loadWorldSnapshot(db).version).toBe(3);
    db.close();
  });
});

describe("db chat_messages", () => {
  it("returns empty before anything is inserted", () => {
    const db = openDb(":memory:");
    expect(listChatMessages(db)).toEqual([]);
  });

  it("stores and reads back oldest-first", () => {
    const db = openDb(":memory:");
    insertChatMessage(db, { id: "m1", author: "Ada", text: "ciao", ts: 100 });
    insertChatMessage(db, { id: "m2", author: "Bob", text: "ehi", ts: 200 });
    const msgs = listChatMessages(db);
    expect(msgs.map((m) => m.id)).toEqual(["m1", "m2"]);
    expect(msgs[0]).toEqual({ id: "m1", author: "Ada", text: "ciao", ts: 100 });
  });

  it("honors the limit, keeping the newest", () => {
    const db = openDb(":memory:");
    for (let i = 1; i <= 5; i += 1) {
      insertChatMessage(db, { id: `m${i}`, author: "A", text: `t${i}`, ts: i * 10 });
    }
    const last3 = listChatMessages(db, 3);
    expect(last3.map((m) => m.id)).toEqual(["m3", "m4", "m5"]);
  });
});
