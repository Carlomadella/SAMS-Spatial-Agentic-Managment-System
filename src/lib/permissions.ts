// Permessi per gruppo di strumenti, per agente (idea 2 da Paperclip, scelta B del 25/11/2026).
// Default "Chiedi prima" su tutto; si cambia nella scheda dell'agente o rispondendo
// «Approva sempre» quando arriva una richiesta.

import { create } from "zustand";
import { BASE, authHeaders, viewerName } from "./backend";

export type PermMode = "allow" | "ask" | "off";
export type PermDecision = "once" | "always" | "deny";

export const MODE_LABEL: Record<PermMode, string> = { allow: "Consentito", ask: "Chiedi prima", off: "Spento" };

export interface PermissionRequest {
  agentId: string;
  agentName: string;
  group: string;
  groupLabel: string;
  tool: string;
  detail: string;
  since: number;
}

export interface AgentPermissions {
  groups: Array<{ id: string; label: string }>;
  perms: Record<string, PermMode>;
  changes: Array<{ group: string; mode: PermMode; updatedBy: string; updatedAt: number }>;
  pending: PermissionRequest | null;
}

/** Richieste in attesa, per agente (dallo stream e, a pagina appena aperta, dal server). */
export const usePermissionRequests = create<{ pending: Record<string, PermissionRequest> }>(() => ({ pending: {} }));

/** Aggiorna le richieste da un evento dello stream (campo `permissionRequest`). */
export function notePermissionEvent(e: { agentId?: string; agentName?: string; permissionRequest?: Omit<PermissionRequest, "agentId" | "agentName"> | null }): void {
  if (!e.agentId || e.permissionRequest === undefined) return;
  const id = e.agentId;
  usePermissionRequests.setState((s) => {
    const pending = { ...s.pending };
    if (e.permissionRequest) pending[id] = { agentId: id, agentName: e.agentName ?? id, ...e.permissionRequest };
    else delete pending[id];
    return { pending };
  });
}

/** Chi ha cambiato un gruppo e quando, per il tooltip. */
export function changeNote(c: AgentPermissions["changes"][number] | undefined): string {
  if (!c) return "Mai cambiato: vale il default (Chiedi prima).";
  const when = new Date(c.updatedAt).toLocaleString([], { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return `${MODE_LABEL[c.mode]} — scelto da ${c.updatedBy || "?"} il ${when}`;
}

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function fetchAgentPermissions(agentId: string): Promise<AgentPermissions> {
  return asJson(await fetch(`${BASE}/api/permissions/${encodeURIComponent(agentId)}`, { headers: authHeaders(false) }));
}

export async function refreshPendingPermissions(): Promise<void> {
  try {
    const list = await asJson<PermissionRequest[]>(await fetch(`${BASE}/api/permissions-pending`, { headers: authHeaders(false) }));
    usePermissionRequests.setState({ pending: Object.fromEntries(list.map((r) => [r.agentId, r])) });
  } catch {
    /* runtime vecchio o offline: restano quelle dello stream */
  }
}

export async function setPermissionRemote(agentId: string, group: string, mode: PermMode): Promise<void> {
  await asJson(
    await fetch(`${BASE}/api/permissions/${encodeURIComponent(agentId)}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ group, mode, actor: viewerName() }),
    }),
  );
}

export async function answerPermissionRemote(agentId: string, decision: PermDecision): Promise<void> {
  await asJson(
    await fetch(`${BASE}/api/permissions/${encodeURIComponent(agentId)}/answer`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ decision, actor: viewerName() }),
    }),
  );
  notePermissionEvent({ agentId, permissionRequest: null });
}
