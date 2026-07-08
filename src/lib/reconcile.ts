// Riconciliazione deterministica client↔server — Roadmap 4, frontiera #1.
//
// Lo stato autorevole vive sul server (`world_snapshot`, versione monotona). Con
// più viste che scrivono, il client deve capire se è **indietro** rispetto alla
// verità del server (qualcun altro ha scritto) e conciliare, invece di sovrascrivere
// alla cieca. Qui vive solo la decisione pura e deterministica; il canale HTTP e
// l'applicazione allo store stanno in `backend.ts`/`App.tsx`.
//
// Il server garantisce la versione con un compare-and-swap (vedi `isFreshWrite` in
// `worldState.ts`): una POST con `baseVersion` obsoleta riceve 409 + lo snapshot
// corrente. Questo modulo decide cosa fare con quelle versioni.

import type { Agent, AgentStatus } from "../types";

export type SyncDirection = "in-sync" | "behind" | "ahead";

/**
 * Confronta la versione base che il client conosce con quella autorevole del server.
 * - `behind`  → il server è avanti: un altro scrittore ha aggiornato; adotta la remota.
 * - `ahead`   → il client ha una base più alta del server (raro: reset del server);
 *               riallinea comunque alla remota per non divergere.
 * - `in-sync` → nulla da fare.
 */
export function compareVersion(localBase: number, remoteVersion: number): SyncDirection {
  if (remoteVersion > localBase) return "behind";
  if (remoteVersion < localBase) return "ahead";
  return "in-sync";
}

/**
 * Prossima `baseVersion` da tenere dopo un esito di push:
 * - 200 → il server ha salvato e restituito la sua nuova versione;
 * - 409 → conflitto, il server ha restituito la versione corrente (più alta).
 * In entrambi i casi ci si allinea alla versione più recente vista, così la POST
 * successiva è CAS-fresca. Mai indietreggiare (monotòna).
 */
export function nextBase(prevBase: number, serverVersion: number): number {
  return Math.max(prevBase, serverVersion);
}

// --- Scrittura autorevole verso lo store (Roadmap 4, frontiera #1) ---------
//
// Finora il 409 riallineava solo la *versione*; lo stato remoto non veniva mai
// adottato dal client. Qui vive l'adozione vera: dato lo snapshot autorevole del
// server (id/status/task/progress per agente), si riconciliano gli agenti locali
// così una vista che perde il CAS — o che si è appena connessa — riflette davvero
// la verità del server, non solo il proprio stato persistito.

/** Forma minima di un agente nello snapshot autorevole del server. */
export interface RemoteWorldAgent {
  id: string;
  status: string;
  task: string | null;
  progress: number;
}

const VALID_STATUS = new Set<string>(["idle", "working", "review", "blocked", "done", "awaiting_approval"]);

const clampPct = (n: number): number => {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 0;
  return Math.min(100, Math.max(0, v));
};

/**
 * Riconcilia gli agenti locali con lo snapshot autorevole del server.
 *
 * Conservativo e deterministico:
 * - tocca solo gli agenti presenti in **entrambi** (per id); non crea né distrugge
 *   agenti da uno snapshot (de-riscato: lo schema completo verrà dopo);
 * - adotta `status` (se valido) e il task del server, **preservando i campi ricchi
 *   locali** (branch, plan) quando il titolo del task coincide;
 * - ritorna lo **stesso array** se nulla cambia, così non innesca render/push a vuoto.
 */
export function reconcileAgents(local: Agent[], remote: RemoteWorldAgent[]): Agent[] {
  if (remote.length === 0) return local;
  const byId = new Map(remote.map((r) => [r.id, r]));
  let changed = false;
  const next = local.map((a) => {
    const r = byId.get(a.id);
    if (!r) return a;
    const status: AgentStatus = VALID_STATUS.has(r.status) ? (r.status as AgentStatus) : a.status;
    const progress = clampPct(r.progress);
    let task: Agent["task"];
    if (r.task == null) {
      task = null;
    } else if (a.task && a.task.title === r.task) {
      task = a.task.progress === progress ? a.task : { ...a.task, progress };
    } else {
      task = { title: r.task, branch: a.task?.branch ?? "", progress, ...(a.task?.plan ? { plan: a.task.plan } : {}) };
    }
    if (a.status === status && task === a.task) return a;
    changed = true;
    return { ...a, status, task };
  });
  return changed ? next : local;
}
