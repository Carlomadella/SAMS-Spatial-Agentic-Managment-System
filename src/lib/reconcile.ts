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

import { AGENT_COLORS, type Agent, type AgentColor, type AgentStatus, type Vec2 } from "../types";
import { clampToRoom, SPAWN_POINT } from "../data/world";

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

/**
 * Forma dell'agente nello snapshot autorevole del server. I campi d'identità
 * (`name`/`color`/`role`) sono opzionali: servono per **materializzare** un agente
 * creato in un'altra vista (scheletro condiviso, Roadmap 4 frontiera #1 — opzione A);
 * i chiamanti minimi che riconciliano solo status/task possono ometterli.
 */
export interface RemoteWorldAgent {
  id: string;
  status: string;
  task: string | null;
  progress: number;
  name?: string;
  color?: string;
  role?: string;
  // Config/identità autorevole a bassa frequenza (Roadmap 4, frontiera #1 — opzione B2).
  model?: string;
  instructions?: string;
  repo?: string;
  xp?: number;
  /**
   * Tombstone autorevole (Roadmap 4, frontiera #1 — opzione 1): `true` se l'agente
   * è stato cancellato sul server. Il client rimuove un agente locale **solo** su
   * questo flag esplicito, mai per semplice assenza dallo snapshot — così una
   * creazione concorrente non-ancora-propagata non viene distrutta.
   */
  deleted?: boolean;
}

const VALID_STATUS = new Set<string>(["idle", "working", "review", "blocked", "done", "awaiting_approval"]);

const clampPct = (n: number): number => {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 0;
  return Math.min(100, Math.max(0, v));
};

const asColor = (c: string | undefined): AgentColor =>
  c && (AGENT_COLORS as readonly string[]).includes(c) ? (c as AgentColor) : AGENT_COLORS[0];

/**
 * Colore da adottare per un agente **esistente**: quello remoto se è un colore
 * valido, altrimenti si conserva quello locale. A differenza di `asColor` (che per
 * la materializzazione ricade sul default) qui non si sovrascrive un colore locale
 * valido con un fallback quando il remoto è assente o non valido.
 */
const adoptColor = (remote: string | undefined, local: AgentColor): AgentColor =>
  remote && (AGENT_COLORS as readonly string[]).includes(remote) ? (remote as AgentColor) : local;

/**
 * Posizione deterministica per un agente materializzato dallo scheletro condiviso.
 * Le posizioni **non** viaggiano nello snapshot (opzione A: sono cosmetiche/per-vista):
 * quindi qui le deriviamo dall'id — stabili tra ri-materializzazioni e distinte per
 * agente, così più agenti non si impilano sulla stessa piastrella di spawn. Sparpaglio
 * in un anello attorno allo `SPAWN_POINT`, clampato dentro le mura.
 */
export function scatterPosition(id: string): Vec2 {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) | 0;
  const angle = (Math.abs(h) % 360) * (Math.PI / 180);
  const radius = 1.5 + ((Math.abs(h >> 4) % 30) / 10); // 1.5..4.4
  return clampToRoom([SPAWN_POINT[0] + Math.cos(angle) * radius, SPAWN_POINT[1] + Math.sin(angle) * radius]);
}

/**
 * Costruisce un `Agent` completo da un agente dello scheletro autorevole (create
 * convergence). Adotta l'identità dal server (id/nome/colore/ruolo) e lo stato/task
 * correnti; i campi *ricchi* locali (posizione, energia, umore, xp) partono da default
 * — sono cosmetici e restano per-vista finché non li si renderà autorevoli (opzione B).
 */
export function materializeAgent(r: RemoteWorldAgent): Agent {
  const status: AgentStatus = VALID_STATUS.has(r.status) ? (r.status as AgentStatus) : "idle";
  const progress = clampPct(r.progress);
  return {
    id: r.id,
    name: r.name?.trim() || "Agente",
    color: asColor(r.color),
    model: r.model?.trim() || "Claude Sonnet",
    role: r.role?.trim() || "Generalist",
    instructions: r.instructions ?? "",
    status,
    position: scatterPosition(r.id),
    target: null,
    task: r.task ? { title: r.task, branch: "", progress } : null,
    taskQueue: [],
    energy: 100,
    hunger: 0,
    mood: "happy",
    xp: r.xp && r.xp > 0 ? Math.floor(r.xp) : 0,
    ...(r.repo?.trim() ? { repo: r.repo.trim() } : {}),
  };
}

/**
 * Riconcilia gli agenti locali con lo snapshot autorevole del server.
 *
 * Conservativo e deterministico:
 * - per gli agenti presenti in **entrambi** (per id): adotta `status` (se valido), il
 *   task del server, l'**identità** (nome/colore/ruolo) e la **config a bassa frequenza**
 *   (model/instructions/repo se non vuoti, xp col massimo — opzione B2), così che quei
 *   cambi fatti altrove si propaghino, **preservando i campi ricchi locali** (branch,
 *   plan) quando il titolo del task coincide;
 * - per gli agenti col **tombstone** (`deleted`): li **rimuove** dal locale — è
 *   l'unica cancellazione ammessa, esplicita e mai per semplice assenza (opzione 1);
 * - per gli agenti presenti **solo nel remoto** (senza tombstone): li **crea**
 *   (scheletro condiviso — opzione A), così un agente aggiunto altrove compare qui;
 * - un agente locale **assente** dal remoto resta intatto (potrebbe essere una nostra
 *   creazione non ancora propagata);
 * - ritorna lo **stesso array** se nulla cambia, così non innesca render/push a vuoto.
 */
export function reconcileAgents(local: Agent[], remote: RemoteWorldAgent[]): Agent[] {
  if (remote.length === 0) return local;
  const byId = new Map(remote.map((r) => [r.id, r]));
  const localIds = new Set(local.map((a) => a.id));
  let changed = false;
  const next: Agent[] = [];
  for (const a of local) {
    const r = byId.get(a.id);
    if (r?.deleted) {
      changed = true; // tombstone autorevole → rimuovi
      continue;
    }
    if (!r) {
      next.push(a);
      continue;
    }
    const status: AgentStatus = VALID_STATUS.has(r.status) ? (r.status as AgentStatus) : a.status;
    // Identità dallo scheletro condiviso (opzione A: id/nome/colore/ruolo autorevoli):
    // adotta anche i cambi di nome/colore/ruolo fatti in un'altra vista, non solo su
    // creazione. Se il remoto **omette** un campo (chiamanti minimi che riconciliano
    // solo status/task) si mantiene il valore locale.
    const name = r.name?.trim() || a.name;
    const color = adoptColor(r.color, a.color);
    const role = r.role?.trim() || a.role;
    // Config a bassa frequenza (opzione B2): si adotta solo un valore remoto **non
    // vuoto**, così i dati vuoti della migrazione non azzerano config locale buona.
    // `xp` è monotono → si prende il massimo (non torna mai indietro).
    const model = r.model?.trim() || a.model;
    const instructions = r.instructions?.trim() ? r.instructions : a.instructions;
    const repo = r.repo?.trim() || a.repo;
    const xp = Math.max(a.xp, r.xp ?? 0);
    const progress = clampPct(r.progress);
    let task: Agent["task"];
    if (r.task == null) {
      task = null;
    } else if (a.task && a.task.title === r.task) {
      task = a.task.progress === progress ? a.task : { ...a.task, progress };
    } else {
      task = { title: r.task, branch: a.task?.branch ?? "", progress, ...(a.task?.plan ? { plan: a.task.plan } : {}) };
    }
    if (
      a.status === status && task === a.task && a.name === name && a.color === color && a.role === role &&
      a.model === model && a.instructions === instructions && a.repo === repo && a.xp === xp
    ) {
      next.push(a);
      continue;
    }
    changed = true;
    next.push({ ...a, status, task, name, color, role, model, instructions, repo, xp });
  }
  // Agenti presenti nel remoto ma non in locale (e non tombstoned) → materializzali.
  const created: Agent[] = [];
  for (const r of remote) {
    if (!r.deleted && !localIds.has(r.id)) created.push(materializeAgent(r));
  }
  if (created.length === 0) return changed ? next : local;
  return [...next, ...created];
}
