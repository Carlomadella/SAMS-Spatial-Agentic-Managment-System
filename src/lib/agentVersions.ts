// Versioni della configurazione degli agenti (idea 6 da Paperclip, scelta A del 25/11/2026).

import { BASE, authHeaders, viewerName } from "./backend";

export interface FieldChange {
  field: string;
  label: string;
  before: string;
  after: string;
}

export interface AgentVersion {
  n: number;
  config: Record<string, string>;
  createdBy: string;
  createdAt: number;
  note: string;
  /** cosa cambia rispetto alla versione precedente */
  changes: FieldChange[];
}

/** Riassunto di una riga: "Modello, Istruzioni" o la nota del ripristino. */
export function versionSummary(v: AgentVersion, isFirst: boolean): string {
  if (v.note) return v.note.charAt(0).toUpperCase() + v.note.slice(1);
  if (isFirst) return "Creato";
  return v.changes.length ? `Cambiati: ${v.changes.map((c) => c.label).join(", ")}` : "Nessun cambiamento";
}

/** Valore leggibile per un campo (i testi lunghi si accorciano, il vuoto si dice). */
export function shortValue(v: string, max = 140): string {
  const t = v.trim();
  if (!t) return "(vuoto)";
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function fetchAgentVersions(agentId: string): Promise<AgentVersion[]> {
  return asJson(await fetch(`${BASE}/api/agents/${encodeURIComponent(agentId)}/versions`, { headers: authHeaders(false) }));
}

/** Il server crea una versione nuova uguale a `n` e la manda a tutte le viste. */
export async function restoreAgentVersion(agentId: string, n: number): Promise<void> {
  await asJson(
    await fetch(`${BASE}/api/agents/${encodeURIComponent(agentId)}/versions/${n}/restore`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ actor: viewerName() }),
    }),
  );
}
