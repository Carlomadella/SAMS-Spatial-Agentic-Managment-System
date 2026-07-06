// Chat di workspace — "mondo condiviso" (Roadmap 4, frontiera #2).
//
// Un canale umano-umano (e umano→agente, in futuro) accanto alla scena, separato
// dall'event log del runtime. I messaggi vivono sul server (SQLite) e si
// rimbalzano via SSE a tutte le viste connesse, così più persone che guardano lo
// stesso ufficio possono parlarsi live. Logica pura e testabile qui; la
// persistenza vive in `db.ts`, gli endpoint in `server.ts`.

export interface ChatMessage {
  id: string;
  author: string;
  text: string;
  /** epoch ms */
  ts: number;
}

/** Massimo numero di messaggi serviti/tenuti in vista (difesa + UI snella). */
export const MAX_CHAT_MESSAGES = 200;
const MAX_AUTHOR = 40;
const MAX_TEXT = 500;
const DEFAULT_AUTHOR = "Ospite";

const str = (v: unknown, max: number): string => (typeof v === "string" ? v.slice(0, max) : "");

/**
 * Normalizza un messaggio in arrivo dal client: autore ripulito (con fallback a
 * "Ospite") e testo con trim + clamp. Ritorna `null` se il testo è vuoto — un
 * messaggio senza contenuto non si salva.
 */
export function sanitizeChatInput(raw: unknown): { author: string; text: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const text = str(r.text, MAX_TEXT).trim();
  if (!text) return null;
  const author = str(r.author, MAX_AUTHOR).trim() || DEFAULT_AUTHOR;
  return { author, text };
}
