import { describe, it, expect } from "vitest";
import {
  emptyWorld,
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
    ).toEqual({ id: "a1", name: "Blue", color: "blue", role: "Dev", status: "working", task: "Fix", progress: 100 });
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
});
