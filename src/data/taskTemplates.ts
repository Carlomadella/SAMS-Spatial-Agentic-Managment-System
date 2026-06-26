// ---------------------------------------------------------------------------
// Ready-made instruction templates so you can command an agent in one click.
// `title` is the natural-language instruction (with {placeholders} to fill in);
// `branch` is a suggested git branch (empty = Notion/content task, no code push).
// ---------------------------------------------------------------------------

export interface TaskTemplate {
  id: string;
  category: string;
  /** short label shown in the picker */
  label: string;
  /** the instruction handed to the agent; {tokens} are meant to be edited */
  title: string;
  /** suggested branch; omit for Notion / content-only tasks */
  branch?: string;
}

export const TASK_TEMPLATES: TaskTemplate[] = [
  // --- Notion ---
  {
    id: "notion-guide",
    category: "Notion",
    label: "Guida completa",
    title: 'Scrivi una guida completa e ben strutturata su {argomento} nella pagina Notion "{pagina}"',
  },
  {
    id: "notion-exercises",
    category: "Notion",
    label: "5 esercizi + soluzioni",
    title: 'Aggiungi 5 esercizi con soluzioni commentate su {argomento} alla pagina Notion "{pagina}"',
  },
  {
    id: "notion-cheatsheet",
    category: "Notion",
    label: "Cheatsheet",
    title: 'Crea un cheatsheet sintetico su {argomento} nella pagina Notion "{pagina}"',
  },

  // --- Codice ---
  {
    id: "code-feature",
    category: "Codice",
    label: "Implementa feature",
    title: "Implementa {funzionalità}, con codice pulito e commenti dove serve, e apri una pull request",
    branch: "feature/nuova-feature",
  },
  {
    id: "code-tests",
    category: "Codice",
    label: "Aggiungi test",
    title: "Aggiungi test per {modulo}, coprendo i casi principali e gli edge case",
    branch: "test/nuovi-test",
  },
  {
    id: "code-refactor",
    category: "Codice",
    label: "Refactor",
    title: "Rifattorizza {file} migliorando leggibilità e struttura senza cambiarne il comportamento",
    branch: "refactor/pulizia",
  },

  // --- Documentazione ---
  {
    id: "docs-readme",
    category: "Documentazione",
    label: "Aggiorna README",
    title: "Aggiorna il README con sezioni Installazione, Uso ed Esempi chiari",
    branch: "docs/readme",
  },
  {
    id: "docs-file",
    category: "Documentazione",
    label: "Documenta un file",
    title: "Documenta il file {path} con commenti chiari e una breve guida d'uso",
    branch: "docs/commenti",
  },

  // --- Contenuti ---
  {
    id: "content-lesson",
    category: "Contenuti",
    label: "Lezione completa",
    title: 'Crea una lezione introduttiva su {argomento} (teoria, esempi e un quiz finale) nella pagina Notion "{pagina}"',
  },
  {
    id: "content-glossary",
    category: "Contenuti",
    label: "Glossario",
    title: 'Crea un glossario dei termini chiave di {argomento} nella pagina Notion "{pagina}"',
  },

  // --- Manutenzione ---
  {
    id: "fix-bug",
    category: "Manutenzione",
    label: "Correggi un bug",
    title: "Trova e correggi il bug: {descrizione del problema}",
    branch: "fix/bugfix",
  },
  {
    id: "chore-deps",
    category: "Manutenzione",
    label: "Controlla dipendenze",
    title: "Controlla le dipendenze del progetto e proponi aggiornamenti sicuri",
    branch: "chore/dipendenze",
  },
];

/** Categories in display order (derived from the templates above). */
export const TASK_CATEGORIES: string[] = TASK_TEMPLATES.reduce<string[]>((acc, t) => {
  if (!acc.includes(t.category)) acc.push(t.category);
  return acc;
}, []);
