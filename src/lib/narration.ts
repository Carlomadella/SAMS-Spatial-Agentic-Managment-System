import type { LogLevel } from "../types";

// Narrazione vocale (TTS): legge ad alta voce gli eventi *significativi* del
// workspace via Web Speech API. Il core (`narrationLine`) è puro e testabile —
// decide cosa vale la pena pronunciare e in che forma; il `narrator` è un
// singleton sottile che parla solo se abilitato (spento di default, come l'audio).

export interface NarratableEvent {
  level: LogLevel;
  agentName: string;
  message: string;
}

/** Prefissi di messaggi a basso valore (rumore di tool / ragionamento / chiacchiere). */
const NOISE_PREFIXES = ["💭", "💬", "read ", "ls ", "staged ", "write ", "Branch ", "Piano:"];

/** Ripulisce un messaggio per la sintesi vocale: via URL, emoji, path tecnici,
 *  poi normalizza gli spazi e tronca. */
export function stripForSpeech(message: string): string {
  return message
    .replace(/https?:\/\/\S+/g, "") // via gli URL (illeggibili a voce)
    .replace(/`[^`]*`/g, "") // via gli inline-code
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "") // via le emoji
    .replace(/#(\d+)/g, "numero $1") // "#128" → "numero 128"
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160)
    .trim();
}

/**
 * Trasforma un evento in una frase da pronunciare, oppure `null` se l'evento
 * non merita narrazione (rumore di basso livello, ragionamento, chiacchiere).
 */
export function narrationLine(e: NarratableEvent): string | null {
  const msg = e.message.trim();
  const name = e.agentName?.trim() || "Un agente";

  if (e.level === "IDLE") return null;
  if (NOISE_PREFIXES.some((p) => msg.startsWith(p))) return null;

  if (e.level === "SUCCESS") {
    if (/\bPR\b|pull request/i.test(msg)) return `${name} ha aperto una pull request.`;
    return `${name}: ${stripForSpeech(msg)}.`;
  }
  if (e.level === "ERROR") {
    return `${name} ha riscontrato un errore.`;
  }
  if (e.level === "WARN") {
    if (/approv|revisione/i.test(msg)) return `${name} è in attesa di revisione.`;
    if (/bloccat/i.test(msg)) return `${name} è bloccato.`;
    return null; // altri WARN: troppo rumorosi da pronunciare
  }
  // INFO e tutto il resto: silenzio (l'event log resta la fonte completa).
  return null;
}

// ---------------------------------------------------------------------------
// Narrator singleton (Web Speech API). Nessun accesso al DOM al load del modulo.
// ---------------------------------------------------------------------------

let enabled = false;

function synth(): SpeechSynthesis | null {
  return typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
}

export const narrator = {
  isEnabled: () => enabled,
  setEnabled(v: boolean) {
    enabled = v;
    if (!v) synth()?.cancel();
  },
  /** Pronuncia una frase, se la narrazione è attiva e supportata dal browser. */
  speak(text: string) {
    if (!enabled || !text) return;
    const s = synth();
    if (!s) return;
    // Evita accumuli: se c'è già una coda lunga, ripuliscila prima di parlare.
    if (s.speaking || s.pending) s.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "it-IT";
    u.rate = 1.05;
    u.pitch = 1;
    s.speak(u);
  },
  cancel() {
    synth()?.cancel();
  },
};
