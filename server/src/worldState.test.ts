import { describe, it, expect } from "vitest";
import {
  emptyWorld,
  isFreshWrite,
  MAX_WORLD_AGENTS,
  sanitizeWorldAgent,
  sanitizeWorldAgents,
  summarizeWorld,
} from "./worldState";

describe("sanitizeWorldAgent", () => {
  it("requires a non-empty id", () => {
    expect(sanitizeWorldAgent(null)).toBeNull();
    expect(sanitizeWorldAgent({ name: "x" })).toBeNull();
    expect(sanitizeWorldAgent({ id: "  " })).toBeNull();
  });

  it("normalizes fields and clamps progress", () => {
    expect(
      sanitizeWorldAgent({ id: "a1", name: "Blue", color: "blue", role: "Dev", status: "working", task: "Fix", progress: 250 }),
    ).toEqual({
      id: "a1", name: "Blue", color: "blue", role: "Dev", status: "working", task: "Fix", progress: 100,
      model: "", instructions: "", repo: "", xp: 0, assignedBy: "",
    });
  });

  it("porta il nome di chi ha assegnato il task (attribuzione multi-utente)", () => {
    const a = sanitizeWorldAgent({ id: "a1", status: "working", task: "Fix", assignedBy: "  Marco  " });
    expect(a).toMatchObject({ assignedBy: "Marco" });
  });

  it("normalizza e ritaglia la config a bassa frequenza (opzione B2)", () => {
    const a = sanitizeWorldAgent({
      id: "a1", status: "idle", model: "GPT-4", instructions: "sii conciso", repo: "acme/app", xp: 7.9,
    });
    expect(a).toMatchObject({ model: "GPT-4", instructions: "sii conciso", repo: "acme/app", xp: 7 });
  });

  it("xp negativo/non valido → 0; campi config non-stringa → ''", () => {
    const a = sanitizeWorldAgent({ id: "a1", status: "idle", model: 42, instructions: null, repo: undefined, xp: -5 });
    expect(a).toMatchObject({ model: "", instructions: "", repo: "", xp: 0 });
  });

  it("falls back to idle for an unknown status and null task", () => {
    const a = sanitizeWorldAgent({ id: "a1", status: "weird", task: null, progress: -5 });
    expect(a).toMatchObject({ status: "idle", task: null, progress: 0 });
  });
});

describe("sanitizeWorldAgents", () => {
  it("drops invalid entries and dedupes by id (last wins)", () => {
    const out = sanitizeWorldAgents([
      { id: "a", name: "first" },
      null,
      { name: "no-id" },
      { id: "a", name: "second" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("second");
  });

  it("caps at MAX_WORLD_AGENTS", () => {
    const many = Array.from({ length: MAX_WORLD_AGENTS + 10 }, (_, i) => ({ id: `a${i}` }));
    expect(sanitizeWorldAgents(many)).toHaveLength(MAX_WORLD_AGENTS);
  });

  it("returns [] for non-arrays", () => {
    expect(sanitizeWorldAgents("nope")).toEqual([]);
    expect(sanitizeWorldAgents(undefined)).toEqual([]);
  });
});

describe("emptyWorld", () => {
  it("is a zeroed snapshot", () => {
    expect(emptyWorld()).toEqual({ agents: [], updatedAt: 0, version: 0 });
  });
});

describe("isFreshWrite (concorrenza ottimistica)", () => {
  it("nessuna baseVersion → sempre fresca (retro-compatibile)", () => {
    expect(isFreshWrite(5)).toBe(true);
    expect(isFreshWrite(5, undefined)).toBe(true);
    expect(isFreshWrite(5, null)).toBe(true);
  });

  it("baseVersion combaciante → fresca", () => {
    expect(isFreshWrite(5, 5)).toBe(true);
    expect(isFreshWrite(0, 0)).toBe(true);
  });

  it("baseVersion divergente → conflitto (non fresca)", () => {
    expect(isFreshWrite(6, 5)).toBe(false); // il server è avanti: qualcuno ha scritto
    expect(isFreshWrite(5, 4)).toBe(false);
    expect(isFreshWrite(5, 7)).toBe(false); // base impossibile → comunque conflitto
  });
});

describe("summarizeWorld", () => {
  it("counts total, working and idle", () => {
    const s = {
      agents: [
        { id: "1", name: "", color: "", role: "", status: "working", task: null, progress: 0 },
        { id: "2", name: "", color: "", role: "", status: "idle", task: null, progress: 0 },
        { id: "3", name: "", color: "", role: "", status: "review", task: null, progress: 0 },
      ],
    };
    expect(summarizeWorld(s)).toEqual({ agents: 3, working: 1, idle: 1 });
  });

  it("esclude i tombstone dal conteggio del roster vivo", () => {
    const s = {
      agents: [
        { id: "1", name: "", color: "", role: "", status: "working", task: null, progress: 0 },
        { id: "2", name: "", color: "", role: "", status: "idle", task: null, progress: 0, deleted: true },
        { id: "3", name: "", color: "", role: "", status: "working", task: null, progress: 0, deleted: true },
      ],
    };
    expect(summarizeWorld(s)).toEqual({ agents: 1, working: 1, idle: 0 });
  });
});
