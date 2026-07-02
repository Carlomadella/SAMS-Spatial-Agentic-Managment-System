import type { AgentColor, LogEvent } from "../types";

// Diario del mondo — trasforma il flusso di eventi in un breve racconto della
// giornata: "Stamattina blue ha aperto 2 PR, purple è andato in pausa…". Tutto
// il core è puro e testabile (nessun accesso al DOM); l'eventuale lettura vocale
// riusa il `narrator` di narration.ts lato UI.

/** Conteggi per-agente delle azioni salienti di una giornata. */
export interface DiaryAgentTally {
  agentName: string;
  color: AgentColor | null;
  /** PR / pull request aperte */
  prs: number;
  /** task portati a termine */
  completed: number;
  /** volte finito in stato bloccato */
  blocked: number;
  /** consegne in revisione */
  reviews: number;
  /** errori riscontrati */
  errors: number;
  /** transizioni a inattivo ("in pausa") */
  paused: number;
}

export interface WorldDiary {
  /** Giorno di riferimento (epoch ms a mezzanotte locale). */
  dayStart: number;
  /** Titolo di sintesi, es. "Giornata tranquilla" o "3 PR, 2 task completati". */
  headline: string;
  /** Frasi narrative, una per agente attivo. */
  lines: string[];
  /** true quando non è successo nulla di raccontabile. */
  quiet: boolean;
}

/** Mezzanotte locale del giorno che contiene `ts`. */
export function startOfLocalDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Fascia oraria in italiano ("Stamattina" / "Nel pomeriggio" / "Stasera"). */
export function timeOfDayPhrase(ts: number): string {
  const h = new Date(ts).getHours();
  if (h < 12) return "Stamattina";
  if (h < 18) return "Nel pomeriggio";
  return "Stasera";
}

/** Classifica un singolo evento in una delle categorie salienti (o null). */
export type DiaryCategory = "pr" | "completed" | "blocked" | "review" | "error" | "paused";

export function classifyEvent(e: Pick<LogEvent, "level" | "message">): DiaryCategory | null {
  const msg = e.message;
  if (e.level === "SUCCESS") {
    if (/\bPR\b|pull request/i.test(msg)) return "pr";
    if (/completat/i.test(msg)) return "completed";
    return "completed"; // altri successi contano comunque come lavoro concluso
  }
  if (e.level === "ERROR") {
    if (/bloccat/i.test(msg)) return "blocked";
    return "error";
  }
  if (e.level === "WARN") {
    if (/bloccat/i.test(msg)) return "blocked";
    if (/revisione|approv/i.test(msg)) return "review";
    return null;
  }
  if (e.level === "IDLE") {
    if (/inattiv|pausa/i.test(msg)) return "paused";
    return null;
  }
  return null; // INFO e ragionamento: fuori dal diario
}

function emptyTally(agentName: string, color: AgentColor | null): DiaryAgentTally {
  return { agentName, color, prs: 0, completed: 0, blocked: 0, reviews: 0, errors: 0, paused: 0 };
}

/** Pluralizzazione italiana minima: `plural(2, "PR")` → "2 PR". */
function count(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/** Aggrega gli eventi di un agente in una frase, o null se nulla di saliente. */
export function tallyLine(t: DiaryAgentTally): string | null {
  const parts: string[] = [];
  if (t.prs > 0) parts.push(`ha aperto ${count(t.prs, "PR", "PR")}`);
  if (t.completed > 0) parts.push(`ha completato ${count(t.completed, "task", "task")}`);
  if (t.reviews > 0) parts.push(`ha mandato in revisione ${count(t.reviews, "consegna", "consegne")}`);
  if (t.blocked > 0) parts.push(`si è bloccato ${t.blocked === 1 ? "una volta" : `${t.blocked} volte`}`);
  if (t.errors > 0) parts.push(`ha incontrato ${count(t.errors, "errore", "errori")}`);
  if (parts.length === 0) {
    if (t.paused > 0) return `${t.agentName} è andato in pausa.`;
    return null;
  }
  // unisce con virgole ed "e" prima dell'ultima parte
  const joined =
    parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}`;
  return `${t.agentName} ${joined}.`;
}

/**
 * Costruisce il diario del giorno che contiene `now` a partire dagli eventi.
 * Considera solo gli eventi nella stessa giornata locale.
 */
export function buildWorldDiary(events: LogEvent[], now: number = Date.now()): WorldDiary {
  const dayStart = startOfLocalDay(now);
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;

  const tallies = new Map<string, DiaryAgentTally>();
  let firstTs = now;
  let totalPrs = 0;
  let totalCompleted = 0;
  let totalBlocked = 0;

  for (const e of events) {
    if (e.ts < dayStart || e.ts >= dayEnd) continue;
    const cat = classifyEvent(e);
    if (!cat) continue;
    const key = e.agentName || "Un agente";
    const t = tallies.get(key) ?? emptyTally(key, e.color);
    if (cat === "pr") { t.prs += 1; totalPrs += 1; }
    else if (cat === "completed") { t.completed += 1; totalCompleted += 1; }
    else if (cat === "blocked") { t.blocked += 1; totalBlocked += 1; }
    else if (cat === "review") t.reviews += 1;
    else if (cat === "error") t.errors += 1;
    else if (cat === "paused") t.paused += 1;
    tallies.set(key, t);
    if (e.ts < firstTs) firstTs = e.ts;
  }

  const lines: string[] = [];
  for (const t of tallies.values()) {
    const line = tallyLine(t);
    if (line) lines.push(line);
  }

  if (lines.length === 0) {
    return { dayStart, headline: "Giornata tranquilla — ancora niente da raccontare.", lines: [], quiet: true };
  }

  // titolo di sintesi + prefisso fascia oraria sulla prima riga
  const summ: string[] = [];
  if (totalPrs > 0) summ.push(count(totalPrs, "PR", "PR"));
  if (totalCompleted > 0) summ.push(`${count(totalCompleted, "task", "task")} completat${totalCompleted === 1 ? "o" : "i"}`);
  if (totalBlocked > 0) summ.push(`${count(totalBlocked, "blocco", "blocchi")}`);
  const headline = summ.length > 0 ? summ.join(" · ") : "Un po' di movimento nell'ufficio";
  lines[0] = `${timeOfDayPhrase(firstTs)} ${lines[0].charAt(0).toLowerCase()}${lines[0].slice(1)}`;

  return { dayStart, headline, lines, quiet: false };
}

/** Testo lineare del diario per la lettura vocale (TTS). */
export function diaryPlainText(d: WorldDiary): string {
  if (d.quiet) return "Giornata tranquilla, ancora niente da raccontare.";
  return d.lines.join(" ");
}
