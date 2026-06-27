import { useEffect, useState } from "react";
import { useStore } from "../store/useStore";
import { ROOM, ROOM_DEPTH, ROOM_WIDTH, ZONES } from "../data/world";
import { AGENT_HEX } from "../types";
import { cn } from "../lib/utils";
import { fetchMetrics, type RuntimeMetrics } from "../lib/backend";

function toPct(x: number, z: number) {
  return {
    left: `${((x - ROOM.minX) / ROOM_WIDTH) * 100}%`,
    top: `${((z - ROOM.minZ) / ROOM_DEPTH) * 100}%`,
  };
}

function fmtUptime(s: number): string {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

export function SystemOverview() {
  const agents = useStore((s) => s.agents);
  const selectedAgentId = useStore((s) => s.selectedAgentId);
  const selectAgent = useStore((s) => s.selectAgent);
  const backendOnline = useStore((s) => s.backendOnline);

  const active = agents.filter((a) => a.status !== "idle").length;

  // Poll runtime metrics while the backend is online (defensive: ignore failures).
  const [metrics, setMetrics] = useState<RuntimeMetrics | null>(null);
  useEffect(() => {
    if (!backendOnline) {
      setMetrics(null);
      return;
    }
    let alive = true;
    const tick = () => void fetchMetrics().then((m) => alive && setMetrics(m));
    tick();
    const id = setInterval(tick, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [backendOnline]);

  return (
    <div className="border-b border-line p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-mut">
          System Overview
        </span>
      </div>

      <div
        className="relative w-full overflow-hidden rounded-lg border border-line bg-gradient-to-br from-ink-850 to-ink-900"
        style={{ aspectRatio: `${ROOM_WIDTH} / ${ROOM_DEPTH}` }}
      >
        {/* zones */}
        {ZONES.map((z) => {
          const p = toPct(z.position[0], z.position[1]);
          return (
            <div
              key={z.id}
              title={z.label}
              className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded border border-slate-500/30 bg-slate-500/10"
              style={p}
            />
          );
        })}

        {/* agents */}
        {agents.map((a) => {
          const [x, z] = a.target ?? a.position;
          const p = toPct(x, z);
          const selected = a.id === selectedAgentId;
          return (
            <button
              key={a.id}
              title={a.name}
              aria-label={`Seleziona ${a.name}`}
              onClick={() => selectAgent(a.id)}
              className={cn(
                "absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 transition-transform hover:scale-125",
                selected ? "ring-white" : "ring-black/30",
              )}
              style={{ ...p, background: AGENT_HEX[a.color] }}
            />
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-mut">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-emerald-400" />
          {active} / {agents.length} Agents Active
        </span>
        <span className="font-mono">100%</span>
      </div>

      {metrics && (
        <div className="mt-1.5 flex items-center justify-between font-mono text-[10px] text-mut">
          <span title="Task completati / avviati">✔ {metrics.tasksCompleted}/{metrics.tasksStarted}</span>
          <span title="Errori" className={cn(metrics.errors > 0 && "text-rose-400")}>⚠ {metrics.errors}</span>
          <span title="Uptime runtime">↑ {fmtUptime(metrics.uptimeSec)}</span>
        </div>
      )}
    </div>
  );
}
