// Snapshot cinematico condiviso (Roadmap 4, opzione B3 — mondo animato condiviso).
//
// Il driver lease (`driver.ts`) elegge UNA vista come simulatore autorevole; questo
// modulo trasporta ciò che quella vista simula — le POSIZIONI live degli agenti e il
// loro waypoint corrente — così le altre viste, invece di simulare per conto proprio,
// seguono e interpolano. Effimero come i cursori: nessuna persistenza, broadcast sul
// canale SSE, staleness lato client. Solo il titolare del lease può spingere (il
// controllo vive in `server.ts`), così non c'è doppia simulazione. Puro e testabile.

export interface WorldSimAgent {
  id: string;
  /** posizione corrente sul pavimento (world units) */
  x: number;
  z: number;
  /** waypoint verso cui l'agente sta camminando, o null se fermo */
  tx: number | null;
  tz: number | null;
}

/** Massimo numero di agenti in uno snapshot cinematico (difesa contro payload gonfiati). */
export const MAX_SIM_AGENTS = 64;

const finite = (v: unknown): number | null => {
  if (v == null) return null; // null/undefined = assente (Number(null) darebbe 0, non lo vogliamo)
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Normalizza un singolo agente cinematico; `null` se manca l'id o la posizione. */
export function sanitizeWorldSimAgent(raw: unknown): WorldSimAgent | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id.slice(0, 64).trim() : "";
  if (!id) return null;
  const x = finite(r.x);
  const z = finite(r.z);
  if (x == null || z == null) return null;
  const tx = finite(r.tx);
  const tz = finite(r.tz);
  // il waypoint conta solo se entrambe le coordinate sono valide (fermo altrimenti)
  const hasTarget = tx != null && tz != null;
  return { id, x, z, tx: hasTarget ? tx : null, tz: hasTarget ? tz : null };
}

/**
 * Normalizza uno snapshot cinematico in arrivo: scarta le voci non valide,
 * deduplica per id (l'ultima vince) e taglia a `MAX_SIM_AGENTS`.
 */
export function sanitizeWorldSim(raw: unknown): WorldSimAgent[] {
  if (!Array.isArray(raw)) return [];
  const byId = new Map<string, WorldSimAgent>();
  for (const item of raw) {
    const a = sanitizeWorldSimAgent(item);
    if (a) byId.set(a.id, a);
  }
  return [...byId.values()].slice(0, MAX_SIM_AGENTS);
}
