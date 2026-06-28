import { useState } from "react";
import { ExternalLink, GitCommit } from "lucide-react";
import { useStore } from "../store/useStore";
import { type TaskRecord } from "../types";
import { clock, cn } from "../lib/utils";

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const LANE_W = 16;   // px between lane centres
const ROW_H  = 28;   // px per commit row
const DOT_R  = 4;    // commit circle radius
const X0     = 10;   // centre of lane 0

const GRAPH_COLORS = [
  "#3b82f6", "#22c55e", "#f97316", "#a855f7",
  "#ef4444", "#eab308", "#06b6d4", "#ec4899",
];

// ---------------------------------------------------------------------------
// Data model
// ---------------------------------------------------------------------------

interface GNode {
  id: string;
  branch: string;
  title: string;
  agentName: string;
  status: string;
  createdAt: number;
  lane: number;
  row: number; // 0 = top (newest)
  tokens?: number;
  url?: string;
}

interface GraphData {
  nodes: GNode[];
  laneCount: number;
  /** lane → [minRow, maxRow] in display order (minRow = newest = top) */
  laneRange: Map<number, [number, number]>;
  laneColors: Map<number, string>;
  laneLabels: Map<number, string>;
}

function buildGraph(tasks: TaskRecord[]): GraphData {
  // Assign lanes in chronological order so branches keep a stable index
  const chrono = [...tasks].sort((a, b) => a.createdAt - b.createdAt);

  const branchToLane = new Map<string, number>();
  let nextLane = 0;
  for (const t of chrono) {
    const branch = t.branch || "main";
    if (!branchToLane.has(branch)) branchToLane.set(branch, nextLane++);
  }

  // Display order: newest first → row 0 at top
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

// ---------------------------------------------------------------------------
// Per-row SVG  (renders the "lane column" for one commit row)
// ---------------------------------------------------------------------------

function RowSvg({
  row,
  lane,
  laneCount,
  laneRange,
  laneColors,
  status,
}: {
  row: number;
  lane: number;
  laneCount: number;
  laneRange: Map<number, [number, number]>;
  laneColors: Map<number, string>;
  status: string;
}) {
  const svgW = X0 * 2 + Math.max(0, laneCount - 1) * LANE_W;
  const done = status === "done" || status === "review";
  const commitColor = laneColors.get(lane) ?? "#8a93a6";

  const segs: React.ReactNode[] = [];

  for (let l = 0; l < laneCount; l++) {
    const range = laneRange.get(l);
    if (!range) continue;
    const [minRow, maxRow] = range;
    if (row < minRow || row > maxRow) continue;

    const color = laneColors.get(l) ?? "#8a93a6";
    const x = X0 + l * LANE_W;

    // Half-segments at the start/end of a branch so lines don't float
    let y1: number;
    let y2: number;
    if (minRow === maxRow) {
      y1 = ROW_H / 2;
      y2 = ROW_H / 2; // single commit, no line drawn
    } else if (row === minRow) {
      y1 = ROW_H / 2; // starts here → line goes down
      y2 = ROW_H;
    } else if (row === maxRow) {
      y1 = 0;          // ends here → line comes from top
      y2 = ROW_H / 2;
    } else {
      y1 = 0;
      y2 = ROW_H;
    }

    if (y1 !== y2) {
      segs.push(
        <line
          key={l}
          x1={x} y1={y1}
          x2={x} y2={y2}
          stroke={color}
          strokeWidth={1.5}
          opacity={0.4}
        />,
      );
    }
  }

  const dotX = X0 + lane * LANE_W;

  return (
    <svg width={svgW} height={ROW_H} className="shrink-0" style={{ minWidth: svgW }}>
      {segs}
      <circle
        cx={dotX} cy={ROW_H / 2} r={DOT_R}
        fill={done ? commitColor : "#1e2536"}
        stroke={commitColor}
        strokeWidth={1.5}
      />
      {done && (
        <circle cx={dotX} cy={ROW_H / 2} r={1.5} fill="rgba(255,255,255,0.4)" />
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function GitGraph() {
  const tasks = useStore((s) => s.tasks);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
        <GitCommit size={22} className="text-mut/40" />
        <p className="text-[12px] text-mut">Nessun commit nel grafo</p>
        <p className="text-[10px] text-mut/60">
          Assegna task agli agenti per popolare il grafo dei branch
        </p>
      </div>
    );
  }

  const { nodes, laneCount, laneRange, laneColors, laneLabels } = buildGraph(tasks);
  const selected = nodes.find((n) => n.id === selectedId) ?? null;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Branch legend */}
      <div className="flex shrink-0 flex-wrap gap-1 border-b border-line/50 px-2 py-1.5">
        {Array.from(laneLabels.entries()).map(([lane, label]) => {
          const color = laneColors.get(lane) ?? "#8a93a6";
          const short = label.length > 24 ? `…${label.slice(-20)}` : label;
          return (
            <span
              key={lane}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[9px]"
              style={{ color, background: `${color}15`, border: `1px solid ${color}30` }}
            >
              ● {short}
            </span>
          );
        })}
      </div>

      {/* Commit rows */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {nodes.map((n) => {
          const sel = n.id === selectedId;
          const color = laneColors.get(n.lane) ?? "#8a93a6";
          return (
            <button
              key={n.id}
              onClick={() => setSelectedId(sel ? null : n.id)}
              className={cn(
                "flex w-full items-stretch border-b border-line/20 text-left transition-colors",
                sel ? "bg-brand/10" : "hover:bg-ink-700/40",
              )}
            >
              <RowSvg
                row={n.row}
                lane={n.lane}
                laneCount={laneCount}
                laneRange={laneRange}
                laneColors={laneColors}
                status={n.status}
              />

              <div className="flex min-w-0 flex-1 items-center gap-2 py-[3px] pr-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] text-slate-200">{n.title}</p>
                  <p className="truncate text-[10px] text-mut">
                    {n.agentName} · {clock(n.createdAt)}
                  </p>
                </div>
                <span
                  className="shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold"
                  style={{ background: `${color}18`, color }}
                >
                  {n.status}
                </span>
                {n.url && (
                  <a
                    href={n.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0 text-brand-soft hover:text-white"
                    title="Apri PR"
                  >
                    <ExternalLink size={10} />
                  </a>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected commit detail */}
      {selected && (
        <div
          className="shrink-0 border-t border-line bg-ink-850/90 px-3 py-2"
          style={{ borderLeft: `3px solid ${laneColors.get(selected.lane) ?? "#444"}` }}
        >
          <p className="text-[12px] font-semibold text-slate-100">{selected.title}</p>
          <p className="mt-0.5 font-mono text-[10px] text-mut">{selected.branch}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-mut">
            <span>{selected.agentName}</span>
            <span>·</span>
            <span>{clock(selected.createdAt)}</span>
            {selected.tokens && (
              <>
                <span>·</span>
                <span className="font-mono">{selected.tokens} tok</span>
              </>
            )}
            {selected.url && (
              <a
                href={selected.url}
                target="_blank"
                rel="noreferrer"
                className="ml-auto flex items-center gap-1 text-brand-soft hover:underline"
              >
                <ExternalLink size={10} /> Apri PR
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
