import { describe, expect, it } from "vitest";
import { buildGraph, GRAPH_COLORS } from "./gitGraph";
import type { TaskRecord } from "../types";

function mk(over: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: over.id ?? "t",
    agentId: "agent-blue",
    agentName: "blue-agent",
    color: "blue",
    title: "task",
    branch: "main",
    status: "working",
    progress: 0,
    createdAt: 0,
    ...over,
  };
}

describe("buildGraph — empty / single", () => {
  it("returns an empty graph for no tasks", () => {
    const g = buildGraph([]);
    expect(g.nodes).toEqual([]);
    expect(g.laneCount).toBe(0);
    expect(g.laneRange.size).toBe(0);
    expect(g.laneColors.size).toBe(0);
  });

  it("lays out a single task at lane 0, row 0", () => {
    const g = buildGraph([mk({ id: "a", branch: "feat/x", createdAt: 100 })]);
    expect(g.laneCount).toBe(1);
    expect(g.nodes).toHaveLength(1);
    expect(g.nodes[0]).toMatchObject({ id: "a", lane: 0, row: 0, branch: "feat/x" });
    expect(g.laneRange.get(0)).toEqual([0, 0]);
    expect(g.laneLabels.get(0)).toBe("feat/x");
  });

  it("falls back to 'main' when the branch is empty", () => {
    const g = buildGraph([mk({ id: "a", branch: "", createdAt: 1 })]);
    expect(g.nodes[0].branch).toBe("main");
    expect(g.laneLabels.get(0)).toBe("main");
  });
});

describe("buildGraph — ordering", () => {
  it("displays newest first (row 0 = most recent createdAt)", () => {
    const g = buildGraph([
      mk({ id: "old", branch: "main", createdAt: 100 }),
      mk({ id: "new", branch: "main", createdAt: 300 }),
      mk({ id: "mid", branch: "main", createdAt: 200 }),
    ]);
    expect(g.nodes.map((n) => n.id)).toEqual(["new", "mid", "old"]);
    expect(g.nodes.map((n) => n.row)).toEqual([0, 1, 2]);
  });

  it("is robust to input order (sorts by createdAt internally)", () => {
    const a = buildGraph([
      mk({ id: "1", createdAt: 1 }),
      mk({ id: "2", createdAt: 2 }),
    ]);
    const b = buildGraph([
      mk({ id: "2", createdAt: 2 }),
      mk({ id: "1", createdAt: 1 }),
    ]);
    expect(a.nodes.map((n) => n.id)).toEqual(b.nodes.map((n) => n.id));
  });
});

describe("buildGraph — lane assignment", () => {
  it("keeps commits on the same branch in the same lane", () => {
    const g = buildGraph([
      mk({ id: "a", branch: "feat/x", createdAt: 1 }),
      mk({ id: "b", branch: "feat/x", createdAt: 2 }),
    ]);
    expect(g.laneCount).toBe(1);
    expect(g.nodes.every((n) => n.lane === 0)).toBe(true);
    expect(g.laneRange.get(0)).toEqual([0, 1]);
  });

  it("assigns distinct lanes to distinct branches", () => {
    const g = buildGraph([
      mk({ id: "a", branch: "feat/x", createdAt: 1 }),
      mk({ id: "b", branch: "feat/y", createdAt: 2 }),
    ]);
    expect(g.laneCount).toBe(2);
    const byId = Object.fromEntries(g.nodes.map((n) => [n.id, n.lane]));
    expect(byId.a).not.toBe(byId.b);
  });

  it("assigns lanes in chronological order (oldest branch → lane 0)", () => {
    const g = buildGraph([
      mk({ id: "y1", branch: "feat/y", createdAt: 50 }),  // newer branch, but...
      mk({ id: "x1", branch: "feat/x", createdAt: 10 }),  // ...this branch is older
    ]);
    expect(g.laneLabels.get(0)).toBe("feat/x"); // older branch claims lane 0
    expect(g.laneLabels.get(1)).toBe("feat/y");
  });

  it("computes laneRange across interleaved branches", () => {
    // chronological: x(1) y(2) x(3) → reversed rows: x@0, y@1, x@2
    const g = buildGraph([
      mk({ id: "x1", branch: "feat/x", createdAt: 1 }),
      mk({ id: "y1", branch: "feat/y", createdAt: 2 }),
      mk({ id: "x2", branch: "feat/x", createdAt: 3 }),
    ]);
    expect(g.laneRange.get(0)).toEqual([0, 2]); // feat/x spans rows 0..2
    expect(g.laneRange.get(1)).toEqual([1, 1]); // feat/y only at row 1
  });
});

describe("buildGraph — colors", () => {
  it("colors lanes from the palette and cycles via modulo", () => {
    const tasks = GRAPH_COLORS.map((_, i) =>
      mk({ id: `t${i}`, branch: `b${i}`, createdAt: i }),
    );
    // add one more than the palette length to force a wrap
    tasks.push(mk({ id: "wrap", branch: "wrap", createdAt: 999 }));
    const g = buildGraph(tasks);
    expect(g.laneColors.get(0)).toBe(GRAPH_COLORS[0]);
    expect(g.laneColors.get(GRAPH_COLORS.length)).toBe(GRAPH_COLORS[0]); // wrapped
  });
});

describe("buildGraph — passthrough fields", () => {
  it("carries tokens and url onto the node", () => {
    const g = buildGraph([
      mk({ id: "a", tokens: 1234, url: "https://example.com/pr/1", createdAt: 1 }),
    ]);
    expect(g.nodes[0].tokens).toBe(1234);
    expect(g.nodes[0].url).toBe("https://example.com/pr/1");
  });
});
