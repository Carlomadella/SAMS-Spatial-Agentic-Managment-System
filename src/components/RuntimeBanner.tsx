import { AlertTriangle, LogIn, PlugZap, Settings } from "lucide-react";
import { useStore } from "../store/useStore";
import { backendEnabled } from "../lib/backend";
import { Link } from "../site/router";
import { cn } from "../lib/utils";

export type BannerKind = "login" | "start-local" | "reconnecting" | "setup";

/**
 * Quale avviso mostrare. Mancanza di accesso e server spento sono cose diverse, e
 * `npm start` ha senso solo quando SAMS gira sul proprio computer (23/11: su Render,
 * senza accesso, il banner diceva di avviare il runtime mentre il server rispondeva 401).
 */
export function bannerKind(s: { online: boolean; ready: boolean; authRequired: boolean; local: boolean }): BannerKind | null {
  if (s.online) return s.ready ? null : "setup";
  if (s.authRequired) return "login";
  return s.local ? "start-local" : "reconnecting";
}

/** SAMS aperto dal proprio computer (dove `npm start` è il rimedio giusto). */
function isLocalHost(): boolean {
  const h = typeof window === "undefined" ? "" : window.location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
}

const MESSAGES: Record<BannerKind, string> = {
  login: "Il workspace è riservato agli account: accedi per vederlo.",
  "start-local": "Runtime non in esecuzione — avvialo con  npm start  (poi ricarica la pagina).",
  reconnecting: "Il server SAMS non risponde — riprovo a collegarmi da solo.",
  setup: "Quasi pronto: collega le chiavi per far lavorare davvero gli agenti.",
};

/**
 * Thin status/onboarding strip under the title bar. Shown only when the runtime
 * is offline, not yet configured or needs a login — otherwise it disappears.
 */
export function RuntimeBanner() {
  const online = useStore((s) => s.backendOnline);
  const ready = useStore((s) => s.runtimeReady);
  const authRequired = useStore((s) => s.streamAuthRequired);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);

  if (!backendEnabled) return null;
  const kind = bannerKind({ online, ready, authRequired, local: isLocalHost() });
  if (!kind) return null;
  const warning = kind === "start-local" || kind === "reconnecting";

  return (
    <div
      className={cn(
        "flex items-center gap-3 border-b px-4 py-2 text-[12.5px]",
        warning
          ? "border-slate-500/30 bg-slate-500/10 text-slate-200"
          : "border-brand/30 bg-brand/10 text-brand-soft",
      )}
    >
      {warning ? <AlertTriangle size={15} className="shrink-0" /> : <PlugZap size={15} className="shrink-0" />}
      <span className="flex-1">{MESSAGES[kind]}</span>
      {kind === "login" && (
        <Link to="/login" className="btn btn-primary h-7 shrink-0">
          <LogIn size={13} /> Accedi
        </Link>
      )}
      {kind === "setup" && (
        <button onClick={() => setSettingsOpen(true, "motore")} className="btn btn-primary h-7 shrink-0">
          <Settings size={13} /> Apri impostazioni
        </button>
      )}
    </div>
  );
}
