import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { useStore } from "../store/useStore";
import { cn } from "../lib/utils";

function firstUrl(s: string): string | null {
  const m = s.match(/https?:\/\/\S+/);
  return m ? m[0] : null;
}

/** Transient notifications for notable outcomes (PRs, Notion writes, errors). */
export function Toaster() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-9 right-4 z-50 flex w-80 flex-col gap-2">
      {toasts.map((t) => {
        const url = firstUrl(t.message);
        const isErr = t.level === "ERROR";
        const Icon = isErr ? AlertCircle : CheckCircle2;
        return (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex animate-fade-in items-start gap-2 rounded-lg border p-3 text-[12.5px] shadow-panel backdrop-blur",
              isErr
                ? "border-rose-500/40 bg-rose-950/80 text-rose-100"
                : "border-emerald-500/40 bg-emerald-950/80 text-emerald-100",
            )}
          >
            <Icon size={16} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1 break-words">
              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-dotted underline-offset-2 hover:opacity-90"
                >
                  {t.message}
                </a>
              ) : (
                t.message
              )}
            </div>
            <button onClick={() => dismiss(t.id)} className="shrink-0 text-white/50 hover:text-white">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
