import { useState } from "react";
import { ExternalLink, GitCommit } from "lucide-react";
import { useStore } from "../store/useStore";
import { buildGraph } from "../lib/gitGraph";
import { STATUS_META } from "../lib/meta";
import type { AgentStatus } from "../types";
import { clock, cn } from "../lib/utils";

const statusLabel = (s: string) => STATUS_META[s as AgentStatus]?.label ?? s;

// ---------------------------------------------------------------------------
// Layout constants (rendering-only — the lane algorithm lives in lib/gitGraph.ts)
// ---------------------------------------------------------------------------

const LANE_W = 16;   // px between lane centres
const ROW_H  = 28;   // px per commit row
const DOT_R  = 4;    // commit circle radius
const X0     = 10;   // centre of lane 0

// Theme-aware fallbacks: reference the shared CSS tokens (index.css) instead of
// hard-coded hex, so the graph adapts to light/dark like the rest of the chrome.
const MUTED     = "rgb(var(--c-mut))";      // lane color when the agent color is unknown
const DOT_EMPTY = "rgb(var(--c-ink-700))";  // fill of a not-yet-done commit dot
const LINE_SOFT = "rgb(var(--c-line))";     // neutral border fallback

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
  const commitColor = laneColors.get(lane) ?? MUTED;

  const segs: React.ReactNode[] = [];

  for (let l = 0; l < laneCount; l++) {
    const range = laneRange.get(l);
    if (!range) continue;
    const [minRow, maxRow] = range;
    if (row < minRow || row > maxRow) continue;

    const color = laneColors.get(l) ?? MUTED;
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
        fill={done ? commitColor : DOT_EMPTY}
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
          const color = laneColors.get(lane) ?? MUTED;
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
          const color = laneColors.get(n.lane) ?? MUTED;
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
                  {statusLabel(n.status)}
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
          style={{ borderLeft: `3px solid ${laneColors.get(selected.lane) ?? LINE_SOFT}` }}
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
