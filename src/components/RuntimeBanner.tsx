import { AlertTriangle, PlugZap, Settings } from "lucide-react";
import { useStore } from "../store/useStore";
import { backendEnabled } from "../lib/backend";
import { cn } from "../lib/utils";

/**
 * Thin status/onboarding strip under the title bar. Shown only when the runtime
 * is offline or not yet configured — otherwise it disappears.
 */
export function RuntimeBanner() {
  const online = useStore((s) => s.backendOnline);
  const ready = useStore((s) => s.runtimeReady);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);

  if (!backendEnabled || (online && ready)) return null;
  const offline = !online;

  return (
    <div
      className={cn(
        "flex items-center gap-3 border-b px-4 py-2 text-[12.5px]",
        offline
          ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
          : "border-brand/30 bg-brand/10 text-brand-soft",
      )}
    >
      {offline ? <AlertTriangle size={15} className="shrink-0" /> : <PlugZap size={15} className="shrink-0" />}
      <span className="flex-1">
        {offline
          ? "Runtime non in esecuzione — avvialo con  npm start  (poi ricarica la pagina)."
          : "Quasi pronto: collega le chiavi per far lavorare davvero gli agenti."}
      </span>
      {!offline && (
        <button onClick={() => setSettingsOpen(true)} className="btn btn-primary h-7 shrink-0">
          <Settings size={13} /> Apri impostazioni
        </button>
      )}
    </div>
  );
}
