// Budget e richieste per agente (idea 1 da Paperclip, scelta A + C del 25/11/2026).
// Il runtime conta le chiamate ai modelli; qui si leggono i numeri e si decidono gli avvisi.

import { create } from "zustand";
import { BASE, authHeaders, viewerName } from "./backend";

export interface AgentUsage {
  requests: number;
  tokens: number;
  /** richieste medie per task negli ultimi 7 giorni (0 = ancora nessun task finito) */
  avgPerTask: number;
  /** tetto giornaliero dell'agente (0 = nessun tetto) */
  cap: number;
}

export interface UsageSnapshot {
  day: string;
  /** provider scelto in ⚙ */
  provider: string;
  /** tetto giornaliero ricavato dal provider (null = sconosciuto) */
  cap: number | null;
  /** richieste di oggi sul provider scelto, tutti gli agenti */
  used: number;
  byProvider: Record<string, number>;
  agents: Record<string, AgentUsage>;
}

/** Percentuale del tetto dell'agente oltre la quale si avvisa (come Paperclip). */
export const AGENT_CAP_WARN = 0.8;

export type CapState = "none" | "ok" | "near" | "reached";

export function capState(used: number, cap: number): CapState {
  if (!(cap > 0)) return "none";
  if (used >= cap) return "reached";
  if (used >= cap * AGENT_CAP_WARN) return "near";
  return "ok";
}

/**
 * Avviso prima di assegnare un task (si può assegnare lo stesso): la quota del provider
 * rimasta è meno di quanto quell'agente usa di solito per un task.
 */
export function quotaWarning(u: UsageSnapshot | null, agentId: string): string | null {
  if (!u || u.cap == null) return null;
  const left = Math.max(0, u.cap - u.used);
  const avg = u.agents[agentId]?.avgPerTask ?? 0;
  if (left === 0) return `Quota di oggi finita (${u.used}/${u.cap} richieste): il task probabilmente si fermerà.`;
  if (avg > 0 && left < avg) return `Probabilmente non basta: restano ${left} richieste, di solito questo agente ne usa ${avg} per un task.`;
  return null;
}

/** Avviso sul tetto dell'agente (null se lontano o assente). */
export function agentCapWarning(a: AgentUsage | undefined): string | null {
  if (!a) return null;
  const st = capState(a.requests, a.cap);
  if (st === "reached") return `Tetto di oggi raggiunto (${a.requests}/${a.cap}): l'agente non parte finché non lo alzi.`;
  if (st === "near") return `Vicino al tetto di oggi: ${a.requests}/${a.cap} richieste.`;
  return null;
}

/** Testo breve per la barra in basso. */
export function usageBadge(u: UsageSnapshot): { text: string; tone: "ok" | "warn" | "bad"; title: string } {
  const title = `Richieste ai modelli di oggi (${u.provider}), tutti gli agenti. Il conteggio si azzera a mezzanotte UTC.`;
  if (u.cap == null) return { text: `${u.used} rich.`, tone: "ok", title };
  const st = capState(u.used, u.cap);
  return {
    text: `${u.used}/${u.cap} rich.`,
    tone: st === "reached" ? "bad" : st === "near" ? "warn" : "ok",
    title: `${title} Tetto del provider: ${u.cap}.`,
  };
}

// --- stato condiviso e chiamate ---------------------------------------------------

export const useUsage = create<{ usage: UsageSnapshot | null }>(() => ({ usage: null }));

export async function refreshUsage(): Promise<UsageSnapshot | null> {
  try {
    const res = await fetch(`${BASE}/api/usage`, { headers: authHeaders(false) });
    if (!res.ok) return null;
    const usage = (await res.json()) as UsageSnapshot;
    useUsage.setState({ usage });
    return usage;
  } catch {
    return null;
  }
}

/** Tetto dell'agente (0 = nessuno); il server ricorda chi l'ha cambiato. */
export async function setAgentCapRemote(agentId: string, cap: number): Promise<void> {
  const res = await fetch(`${BASE}/api/usage/cap/${encodeURIComponent(agentId)}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ cap, actor: viewerName() }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  await refreshUsage();
}
