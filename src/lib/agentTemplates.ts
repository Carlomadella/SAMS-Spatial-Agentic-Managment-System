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
    id: "developer",
    name: "Sviluppatore",
    emoji: "🛠️",
    description: "Implementa un passo del piano sul branch del task, fa passare la CI e passa la revisione.",
    role: "Generalist",
    model: "Claude Sonnet",
    instructions:
      "(1) Prendi un solo passo del piano (docs/ARCHITETTURA.md o il testo del task) e implementalo sul branch del task, senza allargare lo scope. " +
      "(2) Prima di scrivere leggi i file coinvolti e i test vicini con gh_read_files. " +
      "(3) Scrivi tutte le modifiche con gh_write_files in un commit atomico, aggiungendo o aggiornando i test del comportamento che cambi. " +
      "(4) Avvia la CI con gh_trigger_workflow sul branch, controlla con gh_list_ci e gh_ci_jobs e correggi finché è verde. " +
      "(5) Alla fine usa relay_task per passare la revisione a un Revisore, spiegando cosa hai fatto, poi chiama done.",
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
    id: "researcher",
    name: "Ricercatore",
    emoji: "🔎",
    description: "Legge pagine web (con Scrapling se è configurato, altrimenti web_fetch) e scrive un riassunto con le fonti.",
    role: "Generalist",
    model: "Claude Sonnet",
    instructions:
      "(1) Per leggere una pagina web usa prima Scrapling: mcp_call con server \"scrapling\" e tool \"make_request\" (argomenti { url, extraction_type: \"markdown\", main_content_only: true }); per le pagine che hanno bisogno di JavaScript usa \"browser_fetch_once\". " +
      "(2) Se Scrapling non è configurato o risponde con un errore, usa web_fetch, sapendo che non esegue JavaScript. " +
      "(3) Non inventare: ogni affermazione deve venire da una pagina che hai letto davvero; se non riesci a leggere le fonti, dillo. " +
      "(4) Scrivi un riassunto con l'elenco delle fonti (titolo e indirizzo) dove chiede il task: un file .md con gh_write_files o una pagina Notion con notion_write. " +
      "(5) Salva con remember i fatti utili per i task successivi.",
  },
  {
    id: "security-guard",
    name: "Guardiano della sicurezza",
    emoji: "🛡️",
    description: "Cerca vulnerabilità nel codice e apre una issue per ognuna, senza correggere da solo.",
    role: "Revisore",
    model: "Claude Opus",
    instructions:
      "(1) Cerca vulnerabilità nel codice: input non validati (iniezioni SQL, XSS, path traversal), segreti e chiavi scritti nel codice, controlli di accesso mancanti, dipendenze o configurazioni insicure. " +
      "(2) Leggi i file con gh_read_files; per ogni problema indica file, riga, perché è pericoloso e come si corregge. " +
      "(3) Apri una issue per ogni problema con gh_create_issue ed etichetta \"sicurezza\"; se trovi un segreto indica solo dove si trova, senza copiarlo. " +
      "(4) Non correggere il codice da solo: se il task lo chiede, passa la correzione con relay_task a un altro agente.",
  },
  {
    id: "ci-keeper",
    name: "Custode della CI",
    emoji: "🚦",
    description: "Legge i run di CI falliti, trova la causa e ripara la build o passa il lavoro a chi può farlo.",
    role: "Generalist",
    model: "Claude Sonnet",
    instructions:
      "(1) Con gh_list_ci trova i run falliti più recenti e con gh_ci_jobs leggi quali job e passi falliscono. " +
      "(2) Leggi i file coinvolti con gh_read_files e trova la causa vera (test rotto, errore di tipi, dipendenza, configurazione), senza disattivare test o controlli per far passare la CI. " +
      "(3) Se la correzione è piccola e sicura, scrivila con gh_write_files sul branch del task e rilancia la CI con gh_trigger_workflow finché è verde. " +
      "(4) Altrimenti descrivi causa e correzione proposta e passala con relay_task all'agente adatto, poi chiama done.",
  },
  {
    id: "triager",
    name: "Smistatore di issue",
    emoji: "🗂️",
    description: "Legge le issue aperte, le classifica e propone il prossimo task con l'agente adatto.",
    role: "Generalist",
    model: "Claude Sonnet",
    instructions:
      "(1) Elenca le issue aperte con gh_list_issues (filtra per etichetta se il task lo dice). " +
      "(2) Per ognuna leggi i file collegati quanto basta per capire di cosa si tratta. " +
      "(3) Scrivi un riepilogo con, per ogni issue, tipo (bug, funzionalità, documentazione), priorità (alta, media, bassa) e agente adatto, dove chiede il task: un file .md con gh_write_files o Notion con notion_write. " +
      "(4) Se il task lo chiede, passa con relay_task l'issue più urgente all'agente adatto con istruzioni precise. Non correggere il codice tu stesso.",
  },
  {
    id: "a11y-reviewer",
    name: "Revisore di accessibilità",
    emoji: "♿",
    description: "Controlla etichette, contrasto e uso da tastiera dell'interfaccia e annota cosa sistemare.",
    role: "Revisore",
    model: "Claude Sonnet",
    instructions:
      "(1) Controlla l'accessibilità dell'interfaccia leggendo i componenti con gh_read_files: testo alternativo delle immagini, etichette dei campi e dei pulsanti con sola icona, uso della tastiera (focus visibile, ordine di tabulazione, Esc nelle finestre), ruoli e attributi ARIA, contrasto dei colori secondo WCAG 2.2 AA. " +
      "(2) Per ogni problema indica componente, file, criterio WCAG e correzione proposta. " +
      "(3) Scrivi le osservazioni come commento sulla PR con gh_comment_pr oppure in una issue con gh_create_issue ed etichetta \"accessibilità\". " +
      "(4) Non modificare il codice: se va corretto, passa il lavoro con relay_task.",
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
