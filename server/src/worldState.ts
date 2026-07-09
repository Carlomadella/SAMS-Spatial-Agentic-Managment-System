// Stato autorevole del mondo — primo slice de-riscato (Roadmap 4, frontiera #1).
//
// Oggi la verità di agenti/task vive nel browser (Zustand-persist) di un solo
// utente. Il primo passo verso lo stato autorevole sul server è tenerne una
// **copia durevole** lato runtime: il client vi spinge periodicamente uno
// snapshot, il server lo persiste in SQLite e lo serve in lettura (`GET
// /api/world`). Non c'è ancora riconciliazione verso il client — nessun
// big-bang — ma il mondo ora sopravvive al refresh e può essere letto da altre
// viste (dashboard, altre schede). Logica pura e testabile qui; la persistenza
// vive in `db.ts`, gli endpoint in `server.ts`.

export interface WorldAgentSnapshot {
  id: string;
  name: string;
  color: string;
  role: string;
  status: string;
  /** titolo del task corrente, o null se inattivo */
  task: string | null;
  /** 0..100 */
  progress: number;
  // Config/identità autorevole a bassa frequenza (Roadmap 4, frontiera #1 — opzione B2).
  // Cambiano per azione umana, non a ogni frame: viaggiano nello stesso snapshot per-riga.
  // Opzionali per retro-compatibilità con snapshot/tombstone che li omettono.
  /** modello (free-text: "Claude Sonnet", "GPT-4"…) */
  model?: string;
  /** istruzioni permanenti iniettate nel system prompt */
  instructions?: string;
  /** override del repo target (owner/repo); "" = repo globale */
  repo?: string;
  /** punti esperienza cumulativi (monotoni) */
  xp?: number;
  /**
   * Tombstone (Roadmap 4, frontiera #1 — opzione 1): presente e `true` quando
   * l'agente è stato **cancellato** in modo autorevole. Viaggia in lettura
   * (GET/broadcast) così i client rimuovono l'agente in sicurezza — solo su
   * tombstone esplicito, mai per semplice assenza. In scrittura i client non lo
   * inviano: la cancellazione è dedotta server-side dall'assenza in un push CAS-fresco.
   */
  deleted?: boolean;
}

export interface WorldSnapshot {
  agents: WorldAgentSnapshot[];
  /** epoch ms dell'ultimo salvataggio (0 = mai) */
  updatedAt: number;
  /** versione monotona, incrementata dal server a ogni salvataggio */
  version: number;
}

/** Massimo numero di agenti persistiti (difesa contro payload gonfiati). */
export const MAX_WORLD_AGENTS = 64;

const STATUSES = new Set(["idle", "working", "review", "blocked", "done", "awaiting_approval"]);

const clampProgress = (n: unknown): number => {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 0;
  return Math.min(100, Math.max(0, v));
};

const str = (v: unknown, max: number): string => (typeof v === "string" ? v.slice(0, max) : "");

/** Intero non negativo (per xp e simili contatori monotoni); 0 se non valido. */
const nonNegInt = (v: unknown): number => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Normalizza un singolo agente in arrivo; `null` se manca un id valido. */
export function sanitizeWorldAgent(raw: unknown): WorldAgentSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = str(r.id, 64).trim();
  if (!id) return null;
  const status = str(r.status, 20);
  const task = r.task == null ? null : str(r.task, 200);
  return {
    id,
    name: str(r.name, 80),
    color: str(r.color, 20),
    role: str(r.role, 80),
    status: STATUSES.has(status) ? status : "idle",
    task: task || null,
    progress: clampProgress(r.progress),
    model: str(r.model, 60),
    instructions: str(r.instructions, 2000),
    repo: str(r.repo, 120),
    xp: nonNegInt(r.xp),
  };
}

/**
 * Normalizza la lista di agenti di uno snapshot in arrivo: scarta le voci non
 * valide, deduplica per id (l'ultima vince) e taglia a `MAX_WORLD_AGENTS`.
 */
export function sanitizeWorldAgents(raw: unknown): WorldAgentSnapshot[] {
  if (!Array.isArray(raw)) return [];
  const byId = new Map<string, WorldAgentSnapshot>();
  for (const item of raw) {
    const a = sanitizeWorldAgent(item);
    if (a) byId.set(a.id, a);
  }
  return [...byId.values()].slice(0, MAX_WORLD_AGENTS);
}

/** Snapshot vuoto (nessuno stato ancora salvato). */
export function emptyWorld(): WorldSnapshot {
  return { agents: [], updatedAt: 0, version: 0 };
}

/**
 * Concorrenza ottimistica (Roadmap 4, frontiera #1 — canale bidirezionale).
 * Decide se una scrittura in arrivo è "fresca" rispetto alla versione autorevole
 * corrente. Il client dichiara la `baseVersion` che ha visto per ultima:
 * - `baseVersion` assente → nessun controllo (retro-compatibile: last-write-wins).
 * - `baseVersion === current` → fresca, si applica (nessuno ha scritto nel mezzo).
 * - altrimenti → conflitto: un altro scrittore ha già avanzato la versione, il
 *   client deve prima conciliare (adottare la versione remota) e ripresentarsi.
 * Atomico in pratica: il gestore della route legge-controlla-scrive senza `await`
 * in mezzo, quindi due richieste non si interfogliano (SQLite sincrono, single-thread).
 */
export function isFreshWrite(currentVersion: number, baseVersion?: number | null): boolean {
  if (baseVersion == null) return true;
  return baseVersion === currentVersion;
}

/** Riepilogo per log/dashboard: quanti agenti e come sono distribuiti. */
export function summarizeWorld(s: Pick<WorldSnapshot, "agents">): { agents: number; working: number; idle: number } {
  let live = 0;
  let working = 0;
  let idle = 0;
  for (const a of s.agents) {
    if (a.deleted) continue; // i tombstone non contano nel roster vivo
    live += 1;
    if (a.status === "working") working += 1;
    else if (a.status === "idle") idle += 1;
  }
  return { agents: live, working, idle };
}
