import { useEffect, useState } from "react";
import { fetchFile } from "../lib/backend";
import { diffStat, lineDiff, type DiffOp } from "../lib/diff";
import type { PendingFile } from "../types";
import { cn } from "../lib/utils";

const MAX_LINES = 400; // cap rendered diff size

/** One staged file as a real before/after diff against the repo's current content. */
export function StagedFileDiff({ file }: { file: PendingFile }) {
  const [ops, setOps] = useState<DiffOp[] | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchFile(file.path).then(({ content }) => {
      if (alive) setOps(lineDiff(content, file.content));
    });
    return () => {
      alive = false;
    };
  }, [file.path, file.content]);

  const stat = ops ? diffStat(ops) : null;

  return (
    <details className="rounded-md border border-line bg-ink-800">
      <summary className="flex cursor-pointer select-none items-center gap-2 px-2 py-1.5 font-mono text-[11px] text-slate-200 hover:text-white">
        <span className="min-w-0 flex-1 truncate">{file.path}</span>
        {stat && (
          <span className="shrink-0 font-mono text-[10px]">
            <span className="text-emerald-400">+{stat.added}</span>{" "}
            <span className="text-rose-400">−{stat.removed}</span>
          </span>
        )}
      </summary>
      {ops === null ? (
        <div className="px-2 pb-2 pt-1 text-[10px] text-mut">Carico il diff…</div>
      ) : (
        <pre className="max-h-48 overflow-auto px-2 pb-2 pt-1 font-mono text-[10px] leading-relaxed">
          {ops.slice(0, MAX_LINES).map((o, i) => (
            <div
              key={i}
              className={cn(
                o.type === "add" && "bg-emerald-500/10 text-emerald-300",
                o.type === "del" && "bg-rose-500/10 text-rose-300",
                o.type === "ctx" && "text-slate-400",
              )}
            >
              <span className="select-none opacity-60">{o.type === "add" ? "+" : o.type === "del" ? "−" : " "} </span>
              {o.text || " "}
            </div>
          ))}
          {ops.length > MAX_LINES && (
            <div className="text-mut">… {ops.length - MAX_LINES} righe in più</div>
          )}
        </pre>
      )}
    </details>
  );
}
