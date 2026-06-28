import type { TaskRecord } from "../types";

// ---------------------------------------------------------------------------
// Pure data model for the Git Graph. Kept out of the React component so the
// lane-assignment algorithm can be unit-tested in isolation.
// ---------------------------------------------------------------------------

export const GRAPH_COLORS = [
  "#3b82f6", "#22c55e", "#f97316", "#a855f7",
  "#ef4444", "#eab308", "#06b6d4", "#ec4899",
];

export interface GNode {
  id: string;
  branch: string;
  title: string;
  agentName: string;
  status: string;
  createdAt: number;
  /** lane (column) index this commit lives in */
  lane: number;
  /** display row: 0 = top = newest */
  row: number;
  tokens?: number;
  url?: string;
}

export interface GraphData {
  nodes: GNode[];
  laneCount: number;
  /** lane → [minRow, maxRow] in display order (minRow = newest = top) */
  laneRange: Map<number, [number, number]>;
  laneColors: Map<number, string>;
  laneLabels: Map<number, string>;
}

/**
 * Turn a flat list of task records into a laid-out branch graph.
 *
 * - Each distinct branch gets a stable lane, assigned in chronological order
 *   (oldest branch → lane 0) so the layout doesn't jump around as tasks arrive.
 * - Commits are displayed newest-first (row 0 = most recent).
 * - `laneRange` captures the first/last row each lane spans so the renderer can
 *   draw a continuous vertical line only where the branch actually exists.
 */
export function buildGraph(tasks: TaskRecord[]): GraphData {
  // Assign lanes in chronological order so branches keep a stable index.
  const chrono = [...tasks].sort((a, b) => a.createdAt - b.createdAt);

  const branchToLane = new Map<string, number>();
  let nextLane = 0;
  for (const t of chrono) {
    const branch = t.branch || "main";
    if (!branchToLane.has(branch)) branchToLane.set(branch, nextLane++);
  }

  // Display order: newest first → row 0 at top.
  const nodes: GNode[] = [...chrono].reverse().map((t, row) => ({
    id: t.id,
    branch: t.branch || "main",
    title: t.title,
    agentName: t.agentName,
    status: t.status,
    createdAt: t.createdAt,
    lane: branchToLane.get(t.branch || "main")!,
    row,
    tokens: t.tokens,
    url: t.url,
  }));

  const laneRange = new Map<number, [number, number]>();
  for (const n of nodes) {
    const r = laneRange.get(n.lane);
    if (!r) laneRange.set(n.lane, [n.row, n.row]);
    else laneRange.set(n.lane, [Math.min(r[0], n.row), Math.max(r[1], n.row)]);
  }

  const laneColors = new Map<number, string>();
  const laneLabels = new Map<number, string>();
  for (const [branch, lane] of branchToLane.entries()) {
    laneColors.set(lane, GRAPH_COLORS[lane % GRAPH_COLORS.length]);
    laneLabels.set(lane, branch);
  }

  return { nodes, laneCount: nextLane, laneRange, laneColors, laneLabels };
}
