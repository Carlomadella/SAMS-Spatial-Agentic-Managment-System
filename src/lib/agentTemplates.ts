import type { Agent } from "../types";

// Marketplace di "template agente": configurazioni pronte (ruolo + modello +
// istruzioni) applicabili a un agente con un click, e condivisibili come JSON.
// Logica pura e testabile; la UI vive nell'AgentInspector.

export interface AgentTemplate {
  id: string;
  /** Nome mostrato nel selettore. */
  name: string;
  emoji: string;
  /** Breve descrizione di cosa fa l'agente con questo template. */
  description: string;
  /** Uno dei ruoli noti (vedi AGENT_ROLES nell'inspector). */
  role: string;
  /** Etichetta del modello (es. "Claude Opus"). */
  model: string;
  /** Istruzioni permanenti iniettate nel system prompt. */
  instructions: string;
}

/** Libreria curata di template di partenza. */
export const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: "bug-hunter",
    name: "Cacciatore di bug",
    emoji: "🐛",
    description: "Cerca difetti latenti e li documenta o corregge con un test di regressione.",
    role: "Generalist",
    model: "Claude Opus",
    instructions:
      "Concentrati sui bug di correttezza. Per ogni problema descrivi input → comportamento errato; quando correggi, aggiungi prima un test di regressione che fallisce, poi il fix. Non allargare lo scope.",
  },
  {
    id: "test-writer",
    name: "Autore di test",
    emoji: "🧪",
    description: "Aggiunge test mirati ai casi limite seguendo le convenzioni del repo.",
    role: "Tester",
    model: "Claude Sonnet",
    instructions:
      "Scrivi solo file di test (*.test.ts / *.spec.ts). Copri i casi limite (input vuoti, valori estremi, errori) con un'asserzione per concetto. Non modificare il codice di produzione.",
  },
  {
    id: "doc-writer",
    name: "Documentatore",
    emoji: "📚",
    description: "Migliora README, commenti e pagine Notion spiegando il 'perché'.",
    role: "Documentatore",
    model: "Claude Haiku",
    instructions:
      "Aggiorna solo documentazione (.md) e Notion. Spiega il 'perché' più che il 'cosa', resta conciso e coerente con lo stile esistente. Non toccare il codice.",
  },
  {
    id: "reviewer",
    name: "Revisore di PR",
    emoji: "🔍",
    description: "Legge le PR aperte e annota bug, stile e sicurezza senza modificare codice.",
    role: "Revisore",
    model: "Claude Opus",
    instructions:
      "Leggi le PR aperte, analizza i file modificati e documenta le osservazioni (bug, stile, sicurezza, performance). Non modificare file di codice: solo lettura e commento.",
  },
  {
    id: "architect",
    name: "Architetto",
    emoji: "🏛️",
    description: "Analizza la struttura e produce documenti di piano, niente implementazione.",
    role: "Architetto",
    model: "Claude Opus",
    instructions:
      "Analizza la struttura del progetto e produci design-doc chiari (obiettivi, alternative, trade-off, passi). Niente implementazione: solo documenti di piano in Markdown.",
  },
  {
    id: "refactorer",
    name: "Rifattorizzatore",
    emoji: "♻️",
    description: "Riduce duplicazione e complessità senza cambiare il comportamento.",
    role: "Generalist",
    model: "Claude Sonnet",
    instructions:
      "Semplifica: estrai funzioni pure condivise, rimuovi duplicazione, riduci la complessità. Non cambiare il comportamento osservabile; assicurati che i test esistenti restino verdi.",
  },
];

/** Campi che un template imposta su un agente. */
export type TemplatePatch = Pick<Agent, "role" | "model" | "instructions">;

/** Applica un template a un agente, restituendo un nuovo agente (puro). */
export function applyTemplate(agent: Agent, t: AgentTemplate): Agent {
  return { ...agent, role: t.role, model: t.model, instructions: t.instructions };
}

/** Serializza un template come JSON condivisibile (campi stabili, ordinati). */
export function serializeTemplate(t: AgentTemplate): string {
  return JSON.stringify(
    { id: t.id, name: t.name, emoji: t.emoji, description: t.description, role: t.role, model: t.model, instructions: t.instructions },
    null,
    2,
  );
}

/** Costruisce un template a partire dalla configurazione corrente di un agente. */
export function templateFromAgent(agent: Agent, name: string): AgentTemplate {
  const trimmed = name.trim();
  return {
    id: `custom-${Date.now().toString(36)}`,
    name: trimmed || "Template senza nome",
    emoji: "⭐",
    description: "Template personalizzato esportato da un agente.",
    role: agent.role,
    model: agent.model,
    instructions: agent.instructions,
  };
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

/**
 * Valida e normalizza un template ricevuto come JSON (import condivisibile).
 * Restituisce `null` se il payload non è un template valido.
 */
export function parseTemplate(json: string): AgentTemplate | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  // role, model, instructions sono i campi che contano davvero per l'applicazione.
  if (!isNonEmptyString(o.role) || !isNonEmptyString(o.model) || typeof o.instructions !== "string") return null;
  return {
    id: isNonEmptyString(o.id) ? o.id : `imported-${Date.now().toString(36)}`,
    name: isNonEmptyString(o.name) ? o.name : "Template importato",
    emoji: isNonEmptyString(o.emoji) ? o.emoji : "📥",
    description: isNonEmptyString(o.description) ? o.description : "",
    role: o.role,
    model: o.model,
    instructions: o.instructions,
  };
}
