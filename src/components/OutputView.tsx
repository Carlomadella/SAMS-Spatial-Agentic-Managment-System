import { useEffect, useRef } from "react";
import { useStore } from "../store/useStore";
import { buildOutputLines, type OutputKind } from "../lib/output";

const KIND_CLS: Record<OutputKind, string> = {
  head: "text-mut",
  ok: "text-emerald-300",
  err: "text-rose-300",
  warn: "text-amber-300",
};

/** Build/runtime output console, derived from live workspace state. */
export function OutputView() {
  const events = useStore((s) => s.events);
  const backendOnline = useStore((s) => s.backendOnline);
  const runtimeReady = useStore((s) => s.runtimeReady);
  const agentCount = useStore((s) => s.agents.length);
  const endRef = useRef<HTMLDivElement>(null);

  const lines = buildOutputLines(events, { backendOnline, runtimeReady, agentCount });

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [lines.length]);

  return (
    <div className="h-full overflow-y-auto px-3 py-2 font-mono text-[12px] leading-relaxed">
      {lines.map((l, i) => (
        <div key={i} className={`whitespace-pre-wrap break-words ${KIND_CLS[l.kind]}`}>
          {l.text}
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
