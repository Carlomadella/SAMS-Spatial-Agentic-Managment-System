// Comandi nella chat di workspace — umano→agente (Roadmap 4, frontiera #2, nodo
// "d"). Un messaggio di chat che inizia con `/task` è un *intento* di far lavorare
// un agente. Qui c'è solo il parsing puro: la trasformazione in lavoro reale
// avviene SOLO dopo una conferma esplicita nell'interfaccia (una card con un
// bottone), mai in automatico — così la chat resta un canale sicuro.
//
// Grammatica (semplice e non ambigua):
//   /task <titolo>              → nessun agente indicato (lo sceglie chi conferma)
//   /task @<nome> <titolo>      → task indirizzato a un agente per nome
// Il `@` è obbligatorio per targettizzare un agente, così un titolo con spazi o
// due punti non viene mai scambiato per un nome.

export interface TaskCommand {
  /** Nome dell'agente targettizzato (senza @), oppure null se non indicato. */
  agent: string | null;
  /** Titolo del task, ripulito. */
  title: string;
}

const MAX_AGENT = 40;
const MAX_TITLE = 200;

/**
 * Interpreta il testo di un messaggio come comando `/task`. Ritorna `null` se non
 * è un comando task o se il titolo risulta vuoto (un intento senza contenuto non
 * è azionabile).
 */
export function parseTaskCommand(text: unknown): TaskCommand | null {
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  // Deve iniziare con /task come parola intera (poi spazio o fine).
  const m = /^\/task\b(.*)$/is.exec(trimmed);
  if (!m) return null;
  let rest = m[1].trim();
  if (!rest) return null;

  let agent: string | null = null;
  if (rest.startsWith("@")) {
    const sp = rest.search(/\s/);
    if (sp === -1) return null; // solo "@nome" senza titolo: niente da fare
    agent = rest.slice(1, sp).trim().slice(0, MAX_AGENT) || null;
    rest = rest.slice(sp + 1).trim();
  }

  const title = rest.slice(0, MAX_TITLE).trim();
  if (!title) return null;
  return { agent, title };
}

/** Vero se il testo è un comando `/task` azionabile (titolo presente). */
export function isTaskCommand(text: unknown): boolean {
  return parseTaskCommand(text) !== null;
}
