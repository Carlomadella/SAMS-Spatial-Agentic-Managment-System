import { useEffect, useMemo, useRef } from "react";
import { MessageSquare } from "lucide-react";
import { useStore } from "../store/useStore";
import { AGENT_HEX, type AgentColor } from "../types";
import { LEVEL_META } from "../lib/meta";
import { clock } from "../lib/utils";

/**
 * Per-agent conversation thread: the selected agent's own events/responses,
 * pulled out of the shared event log so they're easy to read and don't get
 * lost among every other agent's messages. Newest at the bottom, auto-scrolled.
 */
export function AgentThread({ agentId, color }: { agentId: string; color: AgentColor }) {
  const events = useStore((s) => s.events);
  const mine = useMemo(() => events.filter((e) => e.agentId === agentId), [events, agentId]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [mine.length]);

  return (
    <details open className="mt-2 rounded-lg border border-line bg-ink-850/60">
      <summary className="flex cursor-pointer select-none items-center justify-between px-2.5 py-2 text-[11px] font-medium text-mut hover:text-slate-200">
        <span className="flex items-center gap-1.5">
          <MessageSquare size={12} /> Risposte{mine.length ? ` (${mine.length})` : ""}
        </span>
        <span className="text-[10px] opacity-60">cronologia dell&apos;agente</span>
      </summary>
      <div className="max-h-64 overflow-y-auto px-2.5 pb-2.5">
        {mine.length === 0 ? (
          <p className="px-1 py-2 text-[11px] text-mut">
            Nessuna risposta ancora. Assegna un task per iniziare.
          </p>
        ) : (
          <div className="space-y-1.5">
            {mine.map((e) => {
              const lvl = LEVEL_META[e.level];
              return (
                <div key={e.id} className="rounded-lg border border-line bg-ink-800 px-2 py-1.5">
                  <div className="mb-0.5 flex items-center gap-1.5">
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: color ? AGENT_HEX[color] : "#8a93a6" }}
                    />
                    <span className={`rounded px-1 text-[9px] font-semibold uppercase tracking-wide ring-1 ring-inset ${lvl.badge}`}>
                      {lvl.label}
                    </span>
                    <span className="ml-auto shrink-0 tabular-nums text-[9px] text-mut/80">{clock(e.ts)}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-slate-200">{e.message}</p>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
        )}
      </div>
    </details>
  );
}
