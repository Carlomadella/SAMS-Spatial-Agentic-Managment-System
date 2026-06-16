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
    <div className="h-full overflow-y-auto px-3 py-2 font-mono text-[12px] leading-relaxed">
      {events.length === 0 && <div className="text-mut">No events yet.</div>}
      {events.map((e) => {
        const lvl = LEVEL_META[e.level];
        return (
          <div key={e.id} className="flex gap-2 whitespace-pre-wrap">
            <span className="shrink-0 text-mut">{clock(e.ts)}</span>
            <span className="shrink-0" style={{ color: e.color ? AGENT_HEX[e.color] : "#8a93a6" }}>
              {e.agentName.padEnd(14, " ")}
            </span>
            <span className={`shrink-0 ${lvl.text}`}>[{lvl.label}]</span>
            <span className="text-slate-300">{e.message}</span>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
