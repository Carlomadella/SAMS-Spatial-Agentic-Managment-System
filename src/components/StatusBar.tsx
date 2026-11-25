import { Check, CircleAlert, Eye, GitBranch, Radio, Send, ShieldQuestion, Users, Zap } from "lucide-react";
import { useStore } from "../store/useStore";
import { backendEnabled, getViewerId } from "../lib/backend";
import { isShared, observerBadge, presenceTooltip } from "../lib/presence";
import { roleMeta } from "../lib/roleUi";
import { Link } from "../site/router";
import { effectiveBranch } from "../lib/environments";
import { engineLabel } from "../lib/engine";
import { usePermissionRequests } from "../lib/permissions";
import { usePendingPermissionsSync } from "./AgentPermissions";
import { usageBadge, useUsage } from "../lib/usage";
import { useUsagePolling } from "./AgentUsage";

function fmtTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
}

export function StatusBar() {
  const environment = useStore((s) => s.environment);
  const agents = useStore((s) => s.agents);
  const backendOnline = useStore((s) => s.backendOnline);
  const streamAuthRequired = useStore((s) => s.streamAuthRequired);
  const observers = useStore((s) => s.observers);
  const people = useStore((s) => s.people);
  const worldDriver = useStore((s) => s.worldDriver);
  const viewerRole = useStore((s) => s.viewerRole);
  const roleEnforced = useStore((s) => s.roleEnforced);
  const tokensUsed = useStore((s) => s.tokensUsed);
  const runtimeBranch = useStore((s) => s.runtimeBranch);
  const envBranches = useStore((s) => s.envBranches);
  // Il branch da cui partono i task nell'ambiente scelto (quello dell'ambiente, o il base).
  const { branch, dedicated } = effectiveBranch(environment, envBranches, runtimeBranch);
  const engine = useStore((s) => s.engine);
  const blocked = useStore((s) => s.agents.filter((a) => a.status === "blocked").length);
  const permRequests = Object.values(usePermissionRequests((s) => s.pending));
  const selectAgent = useStore((s) => s.selectAgent);
  usePendingPermissionsSync();
  const usage = useUsage((s) => s.usage);
  useUsagePolling();

  const runtime = !backendEnabled
    ? "Runtime: sandbox"
    : backendOnline
      ? "Runtime: attivo"
      : "Runtime: offline";

  return (
    // Una riga sola anche su un telefono (collaudo 10/11: a 390 px andava su due righe e usciva
    // dallo schermo): sotto `sm` restano branch, presenze, ruolo, runtime e connessione.
    <footer className="flex h-6 shrink-0 items-center justify-between gap-3 overflow-hidden whitespace-nowrap bg-gradient-to-r from-brand to-[#7a0710] px-3 text-[11px] font-medium text-white/90 shadow-[0_-1px_3px_rgba(0,0,0,0.25)]">
      <div className="flex items-center gap-3">
        {/* Collaudo 20/11: qui c'erano valori fissi ("main", errori 0, UTF-8/LF/YAML) che non
            dicevano niente di vero. Ora solo dati reali, e niente se il dato non c'è. */}
        {branch && (
          <span
            className="flex items-center gap-1"
            title={dedicated ? `Branch dell'ambiente ${environment}: i task partono da qui` : "Branch base del repo su cui lavorano gli agenti"}
          >
            <GitBranch size={12} /> {branch}
          </span>
        )}
        <span className="hidden capitalize opacity-90 sm:inline">{environment}</span>
        <span className="hidden items-center gap-1 sm:flex" title="Agenti bloccati">
          <CircleAlert size={12} /> {blocked}
        </span>
      </div>
      <div className="flex min-w-0 items-center gap-3">
        {tokensUsed > 0 && (
          <span className="hidden items-center gap-1 sm:flex" title="Token usati dagli agenti in questa sessione">
            <Zap size={12} /> {fmtTokens(tokensUsed)} tok
          </span>
        )}
        <span className="hidden items-center gap-1 sm:flex">
          <Users size={12} /> {agents.length} agenti
        </span>
        {backendEnabled && backendOnline && (
          <span
            className={`flex items-center gap-1 ${isShared(observers) ? "text-emerald-200" : ""}`}
            title={presenceTooltip(people, observers)}
          >
            <Eye size={12} /> {observerBadge(observers)}
          </span>
        )}
        {backendEnabled && backendOnline && isShared(observers) && worldDriver && (
          <span
            className="hidden items-center gap-1 sm:flex"
            title="Vista che simula il mondo condiviso (driver autorevole)"
          >
            🕹️ {worldDriver.holderId === getViewerId() ? "guidi tu" : `guida ${worldDriver.name}`}
          </span>
        )}
        {backendEnabled && backendOnline && engine && (() => {
          const e = engineLabel(engine);
          return (
            <span
              className={`flex items-center gap-1 ${e.tone === "bad" ? "text-rose-200" : e.tone === "warn" ? "text-amber-200" : ""}`}
              title={e.title}
              data-testid="engine-status"
            >
              {e.tone === "ok" ? null : <CircleAlert size={12} />}
              <span className={e.tone === "ok" ? "hidden sm:inline" : ""}>{e.text}</span>
            </span>
          );
        })()}
        {permRequests.length > 0 && (
          <button
            onClick={() => selectAgent(permRequests[0].agentId)}
            className="flex items-center gap-1 text-amber-200 hover:text-white"
            title={permRequests.map((r) => `${r.agentName}: ${r.groupLabel}`).join("\n")}
            data-testid="permission-badge"
          >
            <ShieldQuestion size={12} /> {permRequests.length === 1 ? "1 permesso" : `${permRequests.length} permessi`}
          </button>
        )}
        {backendEnabled && backendOnline && usage && (() => {
          const u = usageBadge(usage);
          return (
            <span
              className={`hidden items-center gap-1 sm:flex ${u.tone === "bad" ? "text-rose-200" : u.tone === "warn" ? "text-amber-200" : ""}`}
              title={u.title}
              data-testid="usage-badge"
            >
              <Send size={12} /> {u.text}
            </span>
          );
        })()}
        {roleEnforced && (
          <span className="flex items-center gap-1" title={roleMeta(viewerRole).title}>
            <span>{roleMeta(viewerRole).icon}</span> {roleMeta(viewerRole).label}
          </span>
        )}
        <span
          className="flex items-center gap-1"
          title={backendEnabled ? "Runtime agenti gestiti" : "Imposta VITE_SAMS_BACKEND_URL per attivare"}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              !backendEnabled ? "bg-white/60" : backendOnline ? "bg-emerald-300 animate-pulse-soft" : "bg-rose-300"
            }`}
          />
          <Radio size={12} className="hidden sm:block" /> <span className="sr-only sm:not-sr-only">{runtime}</span>
        </span>
        {/* Prima era scritto fisso "Connesso": restava anche con lo stream morto. */}
        <span
          className="flex items-center gap-1"
          title={
            backendOnline
              ? "Aggiornamenti in tempo reale attivi"
              : streamAuthRequired
                ? "Il workspace è riservato agli account: accedi per vederlo"
                : "Stream eventi interrotto — riconnessione in corso"
          }
        >
          {backendOnline ? <Check size={12} /> : <CircleAlert size={12} />}
          {backendOnline ? "SAMS: Connesso" : streamAuthRequired ? "SAMS: Accesso richiesto" : "SAMS: Riconnessione…"}
        </span>
        {!backendOnline && streamAuthRequired && (
          <Link to="/login" className="underline underline-offset-2 hover:text-white">
            Accedi
          </Link>
        )}
      </div>
    </footer>
  );
}
