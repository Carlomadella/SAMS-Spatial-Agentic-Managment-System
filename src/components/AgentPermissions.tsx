import { useEffect, useState } from "react";
import { ShieldQuestion } from "lucide-react";
import { useStore } from "../store/useStore";
import { backendEnabled } from "../lib/backend";
import { canAssign } from "../lib/roleUi";
import { cn } from "../lib/utils";
import {
  answerPermissionRemote,
  changeNote,
  fetchAgentPermissions,
  MODE_LABEL,
  refreshPendingPermissions,
  setPermissionRemote,
  usePermissionRequests,
  type AgentPermissions,
  type PermDecision,
  type PermMode,
} from "../lib/permissions";

const MODES: PermMode[] = ["allow", "ask", "off"];

/** Ritrova le richieste in attesa quando il runtime si collega (montato nella barra in basso). */
export function usePendingPermissionsSync(): void {
  const online = useStore((s) => s.backendOnline);
  useEffect(() => {
    if (backendEnabled && online) void refreshPendingPermissions();
  }, [online]);
}

/** L'agente chiede il permesso: una persona sceglie una volta, sempre o no. */
export function PermissionPrompt({ agentId }: { agentId: string }) {
  const req = usePermissionRequests((s) => s.pending[agentId]);
  const viewerRole = useStore((s) => s.viewerRole);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!req) return null;
  const answer = (d: PermDecision) => {
    setBusy(true);
    setErr("");
    answerPermissionRemote(agentId, req.id, d)
      .catch((e: Error) => setErr(e.message))
      .finally(() => setBusy(false));
  };
  return (
    <div className="mt-3 rounded-lg border border-amber-400/40 bg-amber-400/5 p-2.5" data-testid="permission-prompt">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-200">
        <ShieldQuestion size={13} /> {req.agentName} chiede il permesso: {req.groupLabel}
      </div>
      <p className="mt-1 break-all font-mono text-[11px] text-slate-300">{req.detail}</p>
      {canAssign(viewerRole) ? (
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          <button disabled={busy} onClick={() => answer("once")} className="btn btn-primary text-[11px]">Approva una volta</button>
          <button
            disabled={busy}
            onClick={() => answer("always")}
            className="btn text-[11px]"
            title={`Il gruppo «${req.groupLabel}» diventa Consentito per questo agente`}
          >
            Approva sempre
          </button>
          <button disabled={busy} onClick={() => answer("deny")} className="btn text-[11px]">Nega</button>
        </div>
      ) : (
        <p className="mt-1 text-[11px] text-slate-400">👁 Sola lettura: decide un editor o l'owner.</p>
      )}
      {err && <p className="mt-1 text-[11px] text-rose-400">{err}</p>}
    </div>
  );
}

/** I sette gruppi con le tre posizioni, nella scheda dell'agente. */
export function AgentPermissionsBox({ agentId }: { agentId: string }) {
  const viewerRole = useStore((s) => s.viewerRole);
  const pending = usePermissionRequests((s) => s.pending[agentId]);
  const [data, setData] = useState<AgentPermissions | null>(null);
  const [err, setErr] = useState("");
  // Si rilegge anche quando una richiesta si chiude (un «Approva sempre» cambia un gruppo).
  useEffect(() => {
    let alive = true;
    fetchAgentPermissions(agentId)
      .then((d) => alive && setData(d))
      .catch((e: Error) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, [agentId, pending]);
  if (!data) return err ? <p className="mt-2 text-[11px] text-rose-400">Permessi: {err}</p> : null;

  const change = (group: string, mode: PermMode) => {
    setErr("");
    setData({ ...data, perms: { ...data.perms, [group]: mode } });
    setPermissionRemote(agentId, group, mode)
      .then(() => fetchAgentPermissions(agentId).then(setData))
      .catch((e: Error) => setErr(e.message));
  };
  const editable = canAssign(viewerRole);

  return (
    <details className="mt-2 rounded-lg border border-line bg-ink-850/60" data-testid="agent-permissions">
      <summary className="flex cursor-pointer select-none items-center justify-between px-2.5 py-2 text-[11px] font-medium text-mut hover:text-slate-200">
        <span>Permessi</span>
        <span className="text-[10px] opacity-60">per gruppo di strumenti</span>
      </summary>
      <div className="space-y-1 px-2.5 pb-2.5">
        {data.groups.map((g) => {
          const mode = data.perms[g.id] ?? "ask";
          return (
            <div key={g.id} className="flex items-center justify-between gap-2" title={changeNote(data.changes.find((c) => c.group === g.id))}>
              <span className="min-w-0 truncate text-[11px] text-slate-300">{g.label}</span>
              <div className="flex shrink-0 overflow-hidden rounded-md border border-line">
                {MODES.map((m) => (
                  <button
                    key={m}
                    disabled={!editable}
                    onClick={() => mode !== m && change(g.id, m)}
                    className={cn(
                      "px-1.5 py-0.5 text-[10px]",
                      mode === m
                        ? m === "allow" ? "bg-emerald-500/25 text-emerald-200" : m === "off" ? "bg-rose-500/25 text-rose-200" : "bg-amber-400/20 text-amber-200"
                        : "text-mut hover:text-slate-200",
                    )}
                  >
                    {MODE_LABEL[m]}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        <p className="pt-1 text-[10px] leading-snug text-mut">
          Chiedi prima: l'agente si ferma finché una persona decide. Spento: lo strumento non gli viene nemmeno offerto. Il
          server ricorda chi ha cambiato ogni gruppo (passa il mouse sulla riga).
        </p>
        {err && <p className="text-[11px] text-rose-400">{err}</p>}
      </div>
    </details>
  );
}
