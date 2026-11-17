// Fallback tra provider per le chiamate ai modelli.
//
// Collaudo 2026-11-17: esaurita la quota giornaliera dei modelli :free di OpenRouter
// (429 "free-models-per-day") ogni task falliva. OpenRouter, Gemini, Groq e OpenAI
// espongono la stessa API "chat completions" compatibile OpenAI, quindi la *stessa*
// richiesta (messaggi + tool) può passare al provider successivo senza che l'agente
// perda il filo del suo task.
//
// Regole (skill omniout): si riprova solo 429/5xx/529, timeout ed errori di rete, con
// backoff esponenziale + jitter e rispettando `retry-after`; una quota giornaliera
// esaurita o una chiave rifiutata (401/403) passano subito al provider successivo; un
// 400 è un errore vero e si ferma lì. Nei log: provider e motivo, mai chiavi né prompt.

import type { Settings } from "./config";
import { isRetryableError, openrouterHeaders } from "./openrouter";

export type ProviderId = "openrouter" | "gemini" | "groq" | "openai";
const KNOWN: readonly ProviderId[] = ["openrouter", "gemini", "groq", "openai"];
const DEFAULT_ORDER: ProviderId[] = ["openrouter", "gemini", "groq"];

/** Ordine della catena, da `SAMS_PROVIDER_FALLBACK` (es. "openrouter,gemini,groq"). */
export function fallbackOrder(env: NodeJS.ProcessEnv = process.env): ProviderId[] {
  const raw = env.SAMS_PROVIDER_FALLBACK?.trim();
  if (!raw) return [...DEFAULT_ORDER];
  const out: ProviderId[] = [];
  for (const p of raw.split(",").map((x) => x.trim().toLowerCase())) {
    if ((KNOWN as readonly string[]).includes(p) && !out.includes(p as ProviderId)) out.push(p as ProviderId);
  }
  return out.length > 0 ? out : [...DEFAULT_ORDER];
}

export interface CompatEndpoint {
  id: ProviderId;
  label: string;
  url: string;
  model: string;
  headers: Record<string, string>;
}

const bearer = (key: string) => ({ Authorization: `Bearer ${key}`, "Content-Type": "application/json" });

const SPECS: Record<ProviderId, { label: string; url: string; model: string; key: (s: Settings) => string }> = {
  openrouter: { label: "OpenRouter", url: "https://openrouter.ai/api/v1/chat/completions", model: "", key: (s) => s.openrouterApiKey },
  gemini: {
    label: "Gemini",
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    model: "gemini-2.5-flash",
    key: (s) => s.geminiApiKey,
  },
  groq: { label: "Groq", url: "https://api.groq.com/openai/v1/chat/completions", model: "llama-3.3-70b-versatile", key: (s) => s.groqApiKey },
  openai: { label: "OpenAI", url: "https://api.openai.com/v1/chat/completions", model: "gpt-4o-mini", key: (s) => s.openaiApiKey },
};

/**
 * Endpoint in ordine: prima il provider attivo (col suo modello, anche senza chiave —
 * così l'errore vero arriva da lui), poi gli altri della catena che hanno una chiave.
 */
export function buildEndpoints(s: Settings, primary: ProviderId, primaryModel: string, order: ProviderId[] = fallbackOrder()): CompatEndpoint[] {
  const ids = [primary, ...order.filter((p) => p !== primary)];
  const out: CompatEndpoint[] = [];
  for (const id of ids) {
    const spec = SPECS[id];
    const key = spec.key(s) ?? "";
    if (id !== primary && !key) continue;
    out.push({
      id,
      label: spec.label,
      url: spec.url,
      model: id === primary ? primaryModel : spec.model,
      headers: id === "openrouter" ? openrouterHeaders(key) : bearer(key),
    });
  }
  return out;
}

export type RetryWhy = "network" | "busy" | "timeout";
export type FallbackWhy = "quota" | "auth" | "exhausted";

export interface ChatCompletion {
  choices: Array<{
    message: { content: string | null; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> };
    finish_reason: string;
  }>;
  usage?: { total_tokens?: number };
}

export interface ChatOptions {
  /** Corpo della richiesta senza `model` (lo mette ogni endpoint). */
  body: Record<string, unknown>;
  timeoutMs: number;
  maxRetries: number;
  maxBackoffMs?: number;
  onRetry?: (provider: ProviderId, attempt: number, waitMs: number, why: RetryWhy) => void;
  onFallback?: (from: ProviderId, to: ProviderId, why: FallbackWhy) => void;
  sleep?: (ms: number) => Promise<void>;
}

const DAILY_QUOTA = /per-day|per day|daily|quota/i;

/** Riga di log quando si cambia provider (mai chiavi né prompt). */
export function fallbackMessage(from: string, to: string, why: FallbackWhy): string {
  const cause = why === "quota" ? "quota esaurita" : why === "auth" ? "chiave rifiutata" : "non risponde dopo i tentativi";
  return `${from}: ${cause} → passo a ${to}`;
}

/** Attesa prima del tentativo `attempt` (≥1): retry-after se c'è, altrimenti backoff con jitter. */
function waitFor(attempt: number, retryAfter: string | null, maxBackoffMs: number): number {
  const secs = Number(retryAfter);
  if (retryAfter && Number.isFinite(secs) && secs >= 0) return Math.min(secs * 1000, 60_000);
  const base = Math.min(1000 * 2 ** attempt, maxBackoffMs);
  return Math.round(base / 2 + Math.random() * (base / 2));
}

class ProviderError extends Error {
  constructor(message: string, public readonly move: FallbackWhy | null) {
    super(message);
  }
}

/** Prova gli endpoint in ordine; ritorna la risposta e chi l'ha data. */
export async function chatWithFallback(
  endpoints: CompatEndpoint[],
  opts: ChatOptions,
): Promise<{ data: ChatCompletion; endpoint: CompatEndpoint }> {
  if (endpoints.length === 0) throw new Error("Nessun provider configurato");
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const maxBackoff = opts.maxBackoffMs ?? 30_000;
  let lastErr: Error | null = null;

  for (let i = 0; i < endpoints.length; i++) {
    const ep = endpoints[i]!;
    try {
      return { data: await callWithRetries(ep, opts, sleep, maxBackoff), endpoint: ep };
    } catch (err) {
      if (!(err instanceof ProviderError) || err.move === null) throw err;
      lastErr = err;
      const next = endpoints[i + 1];
      if (next) opts.onFallback?.(ep.id, next.id, err.move);
    }
  }
  throw lastErr ?? new Error("Tutti i provider hanno fallito");
}

async function callWithRetries(
  ep: CompatEndpoint,
  opts: ChatOptions,
  sleep: (ms: number) => Promise<void>,
  maxBackoff: number,
): Promise<ChatCompletion> {
  let retryAfter: string | null = null;
  let why: RetryWhy = "network";
  let last = "";
  for (let attempt = 0; attempt < opts.maxRetries; attempt++) {
    if (attempt > 0) {
      const ms = waitFor(attempt, retryAfter, maxBackoff);
      opts.onRetry?.(ep.id, attempt, ms, why);
      await sleep(ms);
    }
    retryAfter = null;
    let res: Response;
    try {
      res = await fetch(ep.url, {
        method: "POST",
        signal: AbortSignal.timeout(opts.timeoutMs),
        headers: ep.headers,
        body: JSON.stringify({ model: ep.model, ...opts.body }),
      });
    } catch (err) {
      if (!isRetryableError(err)) throw err;
      why = (err as Error).name === "TimeoutError" ? "timeout" : "network";
      last = `${ep.label}: ${(err as Error).message}`;
      continue;
    }
    if (res.ok) return (await res.json()) as ChatCompletion;
    const text = (await res.text().catch(() => "")).slice(0, 200);
    last = `${ep.label} ${res.status}${text ? `: ${text}` : ""}`;
    if (res.status === 429 && DAILY_QUOTA.test(text)) throw new ProviderError(last, "quota");
    if (res.status === 401 || res.status === 403) throw new ProviderError(last, "auth");
    if (res.status === 429 || res.status >= 500) {
      retryAfter = res.headers.get("retry-after");
      why = "busy";
      continue;
    }
    throw new Error(last); // 400 e altri 4xx: errore vero, niente fallback
  }
  throw new ProviderError(last || `${ep.label}: troppi tentativi falliti`, "exhausted");
}
