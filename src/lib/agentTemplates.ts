import type { Agent } from "../types";
import { canonicalRole } from "./agentRoles";

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

/**
 * Libreria curata di agenti preimpostati (ROADMAP5, 20/11/2026). Sono solo un punto
 * di partenza facoltativo: le `instructions` vengono copiate nelle istruzioni
 * permanenti dell'agente, dove l'utente le vede e le cambia come vuole. Il server
 * non aggiunge più vincoli legati al ruolo: queste regole sono le uniche, e sono
 * quelle che l'utente ha deciso di tenere.
 */
export const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: "architect",
    name: "Architetto",
    emoji: "🏛️",
    description: "Analizza la repo, scrive il piano in docs/ARCHITETTURA.md e passa il primo passo a un altro agente.",
    role: "Architetto",
    model: "Claude Opus",
    instructions:
      "(1) Non scrivere codice eseguibile: produci solo documenti di analisi e di piano. " +
      "(2) Prima di proporre cambiamenti analizza la struttura reale del progetto con gh_list_files e gh_read_files / gh_read_file. " +
      "(3) Scrivi o aggiorna il piano in docs/ARCHITETTURA.md con gh_write_files: stato attuale, problemi, proposta con alternative e trade-off, passi di implementazione numerati. " +
      "(4) Quando il piano è pronto usa relay_task per passare il primo passo a un altro agente con istruzioni precise, poi chiama done.",
  },
  {
    id: "reviewer",
    name: "Revisore di PR",
    emoji: "🔍",
    description: "Legge le PR e il codice, annota bug, stile e sicurezza senza modificare file.",
    role: "Revisore",
    model: "Claude Opus",
    instructions:
      "(1) Non modificare file di codice sorgente né file di test: se il task chiede di scrivere codice, spiegalo e chiama done. " +
      "(2) Leggi ogni file rilevante con gh_read_files (più file per passo) o gh_read_file e cerca bug logici, problemi di stile, sicurezza, performance e test mancanti. " +
      "(3) Documenta le osservazioni come commento sulla PR con gh_comment_pr oppure su Notion con notion_write. " +
      "(4) Alla fine, se hai trovato bug da correggere, usa relay_task per passare il lavoro a un Tester o a un Generalist.",
  },
  {
    id: "test-writer",
    name: "Autore di test",
    emoji: "🧪",
    description: "Aggiunge test mirati ai casi limite seguendo le convenzioni del repo e li fa girare in CI.",
    role: "Tester",
    model: "Claude Sonnet",
    instructions:
      "(1) Scrivi solo file di test (*.test.ts, *.spec.ts, __tests__/**); non modificare codice di produzione o configurazione fuori dai test. Se serve cambiare il codice di produzione, usa relay_task per passarlo a un Generalist e chiama done. " +
      "(2) Prima di scrivere leggi i test esistenti con gh_read_files o gh_read_file per rispettare le convenzioni del repository. " +
      "(3) Copri i casi limite (input vuoti, valori estremi, errori) con un'asserzione per concetto. " +
      "(4) Dopo aver scritto i test avvia la CI con gh_trigger_workflow (es. 'ci.yml') sul branch del task, poi controlla con gh_list_ci e gh_ci_jobs che passino; correggi gli errori prima di chiamare done.",
  },
  {
    id: "doc-writer",
    name: "Documentatore",
    emoji: "📚",
    description: "Aggiorna README, file .md e pagine Notion spiegando il 'perché', senza toccare il codice.",
    role: "Documentatore",
    model: "Claude Haiku",
    instructions:
      "(1) Scrivi solo documentazione: README, file .md, docs/** e pagine Notion; non modificare file di codice (.ts, .tsx, .js, .py…). " +
      "(2) Leggi il sorgente con gh_read_files o gh_read_file prima di documentarlo: non inventare comportamenti. " +
      "(3) Usa gh_write_files per i file .md del repository e notion_write per Notion. " +
      "(4) Spiega il perché più che il cosa, resta conciso, coerente con lo stile esistente e in italiano.",
  },
  {
    id: "bug-hunter",
    name: "Cacciatore di bug",
    emoji: "🐛",
    description: "Cerca difetti latenti e li corregge partendo da un test di regressione.",
    role: "Generalist",
    model: "Claude Opus",
    instructions:
      "Concentrati sui bug di correttezza. Per ogni problema descrivi input → comportamento errato; quando correggi, aggiungi prima un test di regressione che fallisce, poi il fix. Non allargare lo scope.",
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

/** Cerca un preimpostato per id, tra quelli di SAMS e quelli salvati dall'utente. */
export function findTemplate(id: string | undefined, extra: AgentTemplate[] = []): AgentTemplate | undefined {
  if (!id) return undefined;
  return AGENT_TEMPLATES.find((t) => t.id === id) ?? extra.find((t) => t.id === id);
}

/**
 * Preimpostato che riprende i vecchi vincoli che il server aggiungeva per ruolo
 * (ROLE_PROMPTS, tolti il 20/11/2026). Usato una volta sola per non cambiare di
 * colpo il comportamento degli agenti già esistenti.
 */
const LEGACY_ROLE_TEMPLATE: Record<string, string> = {
  Architetto: "architect",
  Revisore: "reviewer",
  Tester: "test-writer",
  Documentatore: "doc-writer",
};

/**
 * Migrazione una tantum: agli agenti con un ruolo che prima aveva vincoli cablati
 * nel server e con le istruzioni vuote copia le regole del preimpostato
 * corrispondente. Chi aveva già istruzioni sue non viene toccato. Pura.
 */
export function migrateLegacyRoleRules<T extends Pick<Agent, "role" | "instructions" | "presetId">>(agents: T[]): T[] {
  return agents.map((a) => {
    if (typeof a.instructions === "string" && a.instructions.trim()) return a;
    const t = findTemplate(LEGACY_ROLE_TEMPLATE[canonicalRole(String(a.role ?? ""))]);
    return t ? { ...a, instructions: t.instructions, presetId: t.id } : a;
  });
}

/** Campi che un template imposta su un agente. */
export type TemplatePatch = Pick<Agent, "role" | "model" | "instructions" | "presetId">;

/** Applica un template a un agente, restituendo un nuovo agente (puro). */
export function applyTemplate(agent: Agent, t: AgentTemplate): Agent {
  return { ...agent, role: t.role, model: t.model, instructions: t.instructions, presetId: t.id };
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
