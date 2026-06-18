import { useEffect, useRef } from "react";
import { useStore } from "../store/useStore";
import { AGENT_HEX } from "../types";
import { LEVEL_META } from "../lib/meta";
import { clock } from "../lib/utils";

export function EventLog() {
  const events = useStore((s) => s.events);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [events.length]);

  return (
    <div className="h-full overflow-y-auto px-2 py-2 font-mono text-[12px] leading-relaxed">
      {events.length === 0 && <div className="px-1 text-mut">No events yet.</div>}
      {events.map((e) => {
        const lvl = LEVEL_META[e.level];
        return (
          <div
            key={e.id}
            className="flex items-baseline gap-2 whitespace-pre-wrap rounded px-1 py-0.5 transition-colors hover:bg-white/[0.035]"
          >
            <span className="shrink-0 tabular-nums text-mut/80">{clock(e.ts)}</span>
            <span className="shrink-0 font-semibold" style={{ color: e.color ? AGENT_HEX[e.color] : "#8a93a6" }}>
              {e.agentName.padEnd(14, " ")}
            </span>
            <span
              className={`shrink-0 rounded px-1.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${lvl.badge}`}
            >
              {lvl.label}
            </span>
            <span className="text-slate-300">{e.message}</span>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
