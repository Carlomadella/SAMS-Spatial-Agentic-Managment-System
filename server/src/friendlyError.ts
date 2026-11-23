// Errori dei task leggibili (collaudo 21/11, punto 2A).
//
// Finita la quota gratuita, l'utente vedeva «Errore: Gemini 429: [{"error": …» nel toast,
// nel Log eventi e in un fumetto enorme nella scena. Qui i casi comuni diventano una frase
// in italiano con cosa fare; il testo tecnico resta in `detail`, che la UI mostra in un
// «Dettagli» richiudibile. Gli errori non riconosciuti restano tecnici, ma accorciati.

export interface FriendlyError {
  /** frase da mostrare ovunque (toast, Log eventi, Output, scena) */
  message: string;
  /** testo tecnico originale, se diverso dal messaggio (al massimo DETAIL_LIMIT caratteri) */
  detail?: string;
}

const DETAIL_LIMIT = 2000;
const UNKNOWN_LIMIT = 240;

const PROVIDER = /^(OpenRouter|Gemini|Groq|OpenAI|Claude|Anthropic)\b/i;
const QUOTA = /per-day|per day|daily|quota|RESOURCE_EXHAUSTED|credits/i;

function providerName(raw: string): string {
  const m = raw.match(PROVIDER);
  if (!m) return "Il modello";
  const p = m[1].toLowerCase();
  return p === "openrouter" ? "OpenRouter" : p === "openai" ? "OpenAI" : p === "anthropic" || p === "claude" ? "Claude" : p[0].toUpperCase() + p.slice(1);
}

function statusOf(raw: string): number | null {
  const m = raw.match(/^\s*(?:OpenRouter|Gemini|Groq|OpenAI|Claude|Anthropic|GitHub)\s*:?\s*(\d{3})\b/i);
  return m ? Number(m[1]) : null;
}

export function friendlyError(raw: string): FriendlyError {
  const text = raw.trim();
  const detail = text.length > DETAIL_LIMIT ? `${text.slice(0, DETAIL_LIMIT - 1)}…` : text;
  const status = statusOf(text);
  const known = (message: string): FriendlyError => ({ message, detail });

  if (/^GitHub\b/i.test(text)) {
    if (status === 401) return known("GitHub ha rifiutato l'accesso: il collegamento a GitHub è scaduto o revocato. Ricollega GitHub dal Profilo.");
    if (status === 403 || /not accessible|permission/i.test(text))
      return known("GitHub non dà il permesso per questa azione: il token collegato non ha i permessi necessari su questa repo.");
    if (status === 404) return known("GitHub non trova la repo, il branch o il file richiesto, oppure il token non può vederli.");
  }

  if (PROVIDER.test(text) || /nessuna risposta in \d+ s/i.test(text)) {
    const who = providerName(text);
    if (/nessuna risposta in \d+ s|timeout|timed out/i.test(text))
      return known(`${who} non ha risposto in tempo, anche dopo i tentativi. Riprova tra poco; se succede spesso, scegli un modello più veloce in ⚙ Motore AI.`);
    if (status === 429 && QUOTA.test(text))
      return known(`Le quote gratuite di ${who} sono finite per oggi. Riprova più tardi o aggiungi una chiave di riserva (Gemini, Groq) in ⚙ Motore AI.`);
    if (status === 429) return known(`${who} è occupato e ha rifiutato la richiesta anche dopo i tentativi. Riprova tra qualche minuto.`);
    if (status === 401 || status === 403) return known(`${who} ha rifiutato la chiave: controlla la chiave in ⚙ Motore AI.`);
    if (status !== null && status >= 500) return known(`${who} non risponde (errore del servizio). Riprova più tardi.`);
  }

  if (text.length <= UNKNOWN_LIMIT) return { message: `Errore: ${text}` };
  return { message: `Errore: ${text.slice(0, UNKNOWN_LIMIT - 9)}…`, detail };
}
