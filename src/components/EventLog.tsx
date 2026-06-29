import { useEffect, useRef } from "react";
import { Download } from "lucide-react";
import { useStore } from "../store/useStore";
import { AGENT_HEX } from "../types";
import { LEVEL_META } from "../lib/meta";
import { clock } from "../lib/utils";

function exportCsv(events: ReturnType<typeof useStore.getState>["events"]) {
  const header = "data,agente,livello,messaggio";
  const rows = events.map((e) => [
    new Date(e.ts).toISOString(),
    `"${e.agentName.replace(/"/g, '""')}"`,
    e.level,
    `"${e.message.replace(/"/g, '""')}"`,
  ].join(","));
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sams-events-${new Date().toISOString().slice(0, 16).replace("T", "_")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function EventLog() {
  const events = useStore((s) => s.events);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [events.length]);

  return (
    <div className="flex h-full flex-col">
    {events.length > 0 && (
      <div className="flex shrink-0 justify-end border-b border-line/30 px-2 py-1">
        <button
          onClick={() => exportCsv(events)}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-mut hover:bg-ink-700 hover:text-slate-300"
          title="Esporta log come CSV"
        >
          <Download size={10} /> CSV
        </button>
      </div>
    )}
    <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2 font-mono text-[12px] leading-relaxed">
      {events.length === 0 && <div className="px-1 text-mut">Nessun evento ancora.</div>}
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
    </div>
  );
}
