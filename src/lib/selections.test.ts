import { describe, expect, it } from "vitest";
import { SELECTION_TTL, pruneSelections, selectorsOf, type RemoteSelection } from "./selections";

const mk = (id: string, agentId: string | null, ts: number): RemoteSelection => ({ id, name: id, agentId, ts });

describe("pruneSelections", () => {
  it("keeps fresh selections and drops stale ones", () => {
    const now = 10_000;
    const sels = { a: mk("a", "ag1", now - 1000), b: mk("b", "ag2", now - (SELECTION_TTL + 500)) };
    expect(Object.keys(pruneSelections(sels, now))).toEqual(["a"]);
  });

  it("returns the same reference when nothing is stale", () => {
    const now = 10_000;
    const sels = { a: mk("a", "ag1", now - 100) };
    expect(pruneSelections(sels, now)).toBe(sels);
  });
});

describe("selectorsOf", () => {
  const now = 1000;
  const sels = {
    me: mk("me", "ag1", now),
    anna: mk("anna", "ag1", now),
    luca: mk("luca", "ag2", now),
    idle: mk("idle", null, now),
  };

  it("returns other views that selected the agent, excluding self", () => {
    const out = selectorsOf(sels, "ag1", "me");
    expect(out.map((s) => s.id)).toEqual(["anna"]);
  });

  it("is empty when no one else selected the agent", () => {
    expect(selectorsOf(sels, "ag2", "luca")).toEqual([]);
    expect(selectorsOf(sels, "ag9", "me")).toEqual([]);
  });

  it("ignores views with no selection (null)", () => {
    expect(selectorsOf(sels, "ag1", "me").some((s) => s.agentId === null)).toBe(false);
  });
});
