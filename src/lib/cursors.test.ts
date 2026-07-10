import { describe, expect, it } from "vitest";
import { CURSOR_TTL, cursorColor, cursorOpacity, pruneCursors, type LiveCursor } from "./cursors";

const mk = (id: string, ts: number): LiveCursor => ({ id, name: id, x: 0, z: 0, ts });

describe("pruneCursors", () => {
  it("keeps fresh cursors and drops stale ones", () => {
    const now = 10_000;
    const cursors = { a: mk("a", now - 1000), b: mk("b", now - (CURSOR_TTL + 500)) };
    const out = pruneCursors(cursors, now);
    expect(Object.keys(out)).toEqual(["a"]);
  });

  it("returns the same reference when nothing is stale", () => {
    const now = 10_000;
    const cursors = { a: mk("a", now - 100) };
    expect(pruneCursors(cursors, now)).toBe(cursors);
  });

  it("handles an empty map", () => {
    const cursors: Record<string, LiveCursor> = {};
    expect(pruneCursors(cursors, 1)).toBe(cursors);
  });
});

describe("cursorOpacity", () => {
  it("is full while fresh and zero past the ttl", () => {
    expect(cursorOpacity(0)).toBe(1);
    expect(cursorOpacity(CURSOR_TTL * 0.4)).toBe(1);
    expect(cursorOpacity(CURSOR_TTL)).toBe(0);
    expect(cursorOpacity(CURSOR_TTL + 1000)).toBe(0);
  });

  it("eases down through the fade window", () => {
    const mid = cursorOpacity(CURSOR_TTL * 0.75);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });
});

describe("cursorColor", () => {
  it("is deterministic per id", () => {
    expect(cursorColor("abc")).toBe(cursorColor("abc"));
  });

  it("differs for different ids", () => {
    expect(cursorColor("marco")).not.toBe(cursorColor("giulia"));
  });
});
