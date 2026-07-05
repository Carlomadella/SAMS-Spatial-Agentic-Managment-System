// Meta-agente: un agente il cui repository target è SAMS stesso. Propone
// migliorie concrete al progetto e apre una PR. La logica qui è pura e
// testabile; il retargeting effettivo del repo avviene lato server (override
// per-task via AsyncLocalStorage in github.ts), pilotato dal campo `repo`
// nell'assegnazione.

/** Il repository di SAMS (owner/repo) — bersaglio fisso dei meta-agenti. */
export const SAMS_REPO = "Carlomadella/SAMS-Spatial-Agentic-Managment-System";

/** Forma `owner/repo` accettata come override del repository. */
const REPO_RE = /^[\w.-]+\/[\w.-]+$/;

/** true se la stringa è un `owner/repo` valido. */
export function isValidRepo(s: string | null | undefined): boolean {
  return typeof s === "string" && REPO_RE.test(s.trim());
}

/**
 * Repo da passare all'assegnazione (override `repo` in AssignBody):
 *  1) l'override esplicito per-agente `agent.repo`, se è un `owner/repo` valido;
 *  2) altrimenti SAMS se l'agente è meta;
 *  3) altrimenti nessun override (undefined ⇒ il runtime usa il repo globale).
 */
export function metaRepo(agent: { meta?: boolean; repo?: string }): string | undefined {
  const explicit = agent.repo?.trim();
  if (explicit && REPO_RE.test(explicit)) return explicit;
  return agent.meta ? SAMS_REPO : undefined;
}

export interface MetaIdea {
  id: string;
  /** Etichetta breve mostrata nel selettore. */
  label: string;
  /** Descrizione del task assegnato all'agente. */
  brief: string;
}

/** Spunti concreti di auto-miglioramento di SAMS. Piccoli, testabili, a basso rischio. */
export const META_IDEAS: MetaIdea[] = [
  {
    id: "test-coverage",
    label: "Più test su un modulo puro",
    brief:
      "Scegli un modulo puro poco coperto in src/lib o server/src, aggiungi test mirati ai casi limite (input vuoti, valori estremi) senza cambiare il comportamento, poi apri una PR.",
  },
  {
    id: "a11y",
    label: "Migliora l'accessibilità di un pannello",
    brief:
      "Individua un controllo solo-icona o un elemento interattivo senza nome accessibile nell'interfaccia, aggiungi aria-label/ruoli appropriati e verifica che i test esistenti restino verdi, poi apri una PR.",
  },
  {
    id: "docs",
    label: "Documenta una parte non ovvia",
    brief:
      "Trova una funzione o un modulo con logica non banale e commenti scarsi, aggiungi una breve spiegazione del 'perché' (non del 'cosa') in stile col resto del codice, poi apri una PR.",
  },
  {
    id: "roadmap",
    label: "Proponi una miglioria dalla roadmap",
    brief:
      "Leggi ROADMAP2.md, scegli un item ancora aperto (💡) di basso effort, implementane una fetta minima e testabile con i relativi test, poi apri una PR.",
  },
  {
    id: "refactor",
    label: "Semplifica una duplicazione",
    brief:
      "Cerca logica duplicata fra due file, estraila in una funzione pura condivisa con test, aggiorna i chiamanti senza cambiarne il comportamento, poi apri una PR.",
  },
];

/** Slug di branch leggibile a partire da un testo libero. */
export function slugifyBranch(text: string): string {
  const slug = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)
    .replace(/-+$/g, "");
  return slug || "miglioria";
}

/** Costruisce titolo + branch per un task meta a partire da uno spunto. */
export function buildMetaTask(idea: MetaIdea): { title: string; branch: string } {
  return {
    title: `[SAMS] ${idea.brief}`,
    branch: `sams/meta-${slugifyBranch(idea.id)}`,
  };
}

// --- Meta-agente proattivo ---------------------------------------------------
// Un meta-agente idle propone da solo una miglioria a SAMS (opt-in), invece di
// aspettare un comando. La logica di "quando" e "quale" è pura e testabile; il
// bridge lato App esegue l'assegnazione vera.

/** Intervallo minimo (ms) fra due proposte autonome dello stesso meta-agente. */
export const META_PROPOSAL_COOLDOWN_MS = 90_000;

/** Forma minima di un agente per decidere se può ricevere una proposta. */
export interface MetaCandidate {
  meta?: boolean;
  status: string;
  task: unknown | null;
  taskQueue?: unknown[];
}

/**
 * Vero se un meta-agente è libero (idle, senza task né coda) e il cooldown dalla
 * sua ultima proposta è scaduto — quindi può proporre una miglioria adesso.
 */
export function shouldProposeMeta(agent: MetaCandidate, lastProposedAt: number | undefined, now: number): boolean {
  if (!agent.meta) return false;
  if (agent.status !== "idle") return false;
  if (agent.task) return false;
  if ((agent.taskQueue?.length ?? 0) > 0) return false;
  if (lastProposedAt != null && now - lastProposedAt < META_PROPOSAL_COOLDOWN_MS) return false;
  return true;
}

/** Sceglie uno spunto meta in rotazione deterministica (`seed` cresce a ogni uso). */
export function pickMetaIdea(ideas: MetaIdea[], seed: number): MetaIdea {
  const n = ideas.length;
  return ideas[((seed % n) + n) % n];
}
