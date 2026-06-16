import { useStore } from "../store/useStore";
import { ROOM, ROOM_DEPTH, ROOM_WIDTH, ZONES } from "../data/world";
import { AGENT_HEX } from "../types";
import { cn } from "../lib/utils";

function toPct(x: number, z: number) {
  return {
    left: `${((x - ROOM.minX) / ROOM_WIDTH) * 100}%`,
    top: `${((z - ROOM.minZ) / ROOM_DEPTH) * 100}%`,
  };
}

export function SystemOverview() {
  const agents = useStore((s) => s.agents);
  const selectedAgentId = useStore((s) => s.selectedAgentId);
  const selectAgent = useStore((s) => s.selectAgent);

  const active = agents.filter((a) => a.status !== "idle").length;

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
    </div>
  );
}
