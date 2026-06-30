// Meta-agente: un agente il cui repository target è SAMS stesso. Propone
// migliorie concrete al progetto e apre una PR. La logica qui è pura e
// testabile; il retargeting effettivo del repo avviene lato server (override
// per-task via AsyncLocalStorage in github.ts), pilotato dal campo `repo`
// nell'assegnazione.

/** Il repository di SAMS (owner/repo) — bersaglio fisso dei meta-agenti. */
export const SAMS_REPO = "Carlomadella/SAMS-Spatial-Agentic-Managment-System";

/** Repo da passare all'assegnazione: SAMS se l'agente è meta, altrimenti il
 *  repo globale configurato (undefined = nessun override). */
export function metaRepo(agent: { meta?: boolean }): string | undefined {
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
