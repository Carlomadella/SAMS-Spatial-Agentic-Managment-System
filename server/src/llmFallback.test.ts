import { afterEach, describe, expect, it, vi } from "vitest";
import { buildEndpoints, chatWithFallback, fallbackMessage, fallbackOrder, type CompatEndpoint } from "./llmFallback";
import type { Settings } from "./config";

// Collaudo 2026-11-17 (simulazione sim-prenota-sale): esaurita la quota giornaliera dei
// modelli :free di OpenRouter (429), ogni task falliva. Se c'è un altro provider con la
// chiave, la stessa richiesta deve passare a quello e l'agente continuare il suo lavoro.

afterEach(() => vi.unstubAllGlobals());

const ep = (id: CompatEndpoint["id"]): CompatEndpoint => ({
  id,
  label: id,
  url: `https://${id}.test/v1/chat/completions`,
  model: `${id}-model`,
  headers: { Authorization: "Bearer x", "Content-Type": "application/json" },
});

const ok = (text: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content: text }, finish_reason: "stop" }], usage: { total_tokens: 5 } }), {
    status: 200,
  });
const status = (code: number, body = "", headers: Record<string, string> = {}) => new Response(body, { status: code, headers });

/** fetch finto che risponde in base al dominio del provider, in ordine. */
function routeFetch(routes: Record<string, Array<() => Response | Promise<Response>>>) {
  const calls: string[] = [];
  const f = vi.fn(async (url: string) => {
    const id = new URL(url).hostname.split(".")[0]!;
    calls.push(id);
    const next = routes[id]?.shift();
    if (!next) throw new Error(`nessuna risposta prevista per ${id}`);
    return next();
  });
  vi.stubGlobal("fetch", f);
  return calls;
}

const run = (endpoints: CompatEndpoint[], extra: Partial<Parameters<typeof chatWithFallback>[1]> = {}) =>
  chatWithFallback(endpoints, { body: { messages: [] }, timeoutMs: 1000, maxRetries: 3, sleep: async () => {}, ...extra });

describe("fallbackMessage", () => {
  it("dice da dove a dove e perché, senza dettagli sensibili", () => {
    expect(fallbackMessage("OpenRouter", "Gemini", "quota")).toBe("OpenRouter: quota esaurita → passo a Gemini");
    expect(fallbackMessage("Gemini", "Groq", "auth")).toContain("chiave rifiutata");
  });
});

describe("fallbackOrder", () => {
  it("di default: openrouter, gemini, groq", () => {
    expect(fallbackOrder({})).toEqual(["openrouter", "gemini", "groq"]);
  });

  it("si configura con SAMS_PROVIDER_FALLBACK, ignorando nomi sconosciuti e doppioni", () => {
    expect(fallbackOrder({ SAMS_PROVIDER_FALLBACK: " groq, pippo,openrouter,groq " })).toEqual(["groq", "openrouter"]);
  });
});

describe("buildEndpoints", () => {
  const s = { openrouterApiKey: "or", geminiApiKey: "", groqApiKey: "gq", openaiApiKey: "" } as Settings;

  it("mette per primo il provider attivo e salta quelli senza chiave", () => {
    const eps = buildEndpoints(s, "openrouter", "vendor/m:free", ["groq", "gemini", "openrouter"]);
    expect(eps.map((e) => e.id)).toEqual(["openrouter", "groq"]);
    expect(eps[0]!.model).toBe("vendor/m:free");
  });

  it("il provider attivo resta anche senza chiave (l'errore vero arriva da lui)", () => {
    const eps = buildEndpoints({ ...s, openrouterApiKey: "" } as Settings, "openrouter", "vendor/m:free", ["openrouter"]);
    expect(eps.map((e) => e.id)).toEqual(["openrouter"]);
  });
});

describe("chatWithFallback", () => {
  it("quota giornaliera esaurita: niente riprove inutili, passa subito al provider successivo", async () => {
    const calls = routeFetch({
      openrouter: [() => status(429, '{"error":{"message":"Rate limit exceeded: free-models-per-day"}}')],
      gemini: [() => ok("da gemini")],
    });
    const onFallback = vi.fn();
    const res = await run([ep("openrouter"), ep("gemini")], { onFallback });
    expect(res.endpoint.id).toBe("gemini");
    expect(res.data.choices[0]!.message.content).toBe("da gemini");
    expect(calls).toEqual(["openrouter", "gemini"]);
    expect(onFallback).toHaveBeenCalledWith("openrouter", "gemini", "quota");
  });

  it("5xx: riprova sullo stesso provider, poi passa al successivo", async () => {
    const calls = routeFetch({
      openrouter: [() => status(503), () => status(502), () => status(500)],
      groq: [() => ok("da groq")],
    });
    const onRetry = vi.fn();
    const res = await run([ep("openrouter"), ep("groq")], { onRetry });
    expect(res.endpoint.id).toBe("groq");
    expect(calls).toEqual(["openrouter", "openrouter", "openrouter", "groq"]);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it("rispetta l'header retry-after", async () => {
    routeFetch({ openrouter: [() => status(429, "", { "retry-after": "3" }), () => ok("ok")] });
    const onRetry = vi.fn();
    await run([ep("openrouter")], { onRetry });
    expect(onRetry).toHaveBeenCalledWith("openrouter", 1, 3000, "busy");
  });

  it("timeout e rete giù si riprovano", async () => {
    routeFetch({
      openrouter: [
        () => Promise.reject(Object.assign(new Error("aborted"), { name: "TimeoutError" })),
        () => Promise.reject(new TypeError("fetch failed")),
        () => ok("ok"),
      ],
    });
    const onRetry = vi.fn();
    const res = await run([ep("openrouter")], { onRetry });
    expect(res.endpoint.id).toBe("openrouter");
    expect(onRetry.mock.calls.map((c) => c[3])).toEqual(["timeout", "network"]);
  });

  it("un 400 è un errore vero: niente riprove e niente fallback", async () => {
    const calls = routeFetch({ openrouter: [() => status(400, "bad request")], gemini: [() => ok("no")] });
    await expect(run([ep("openrouter"), ep("gemini")])).rejects.toThrow("openrouter 400: bad request");
    expect(calls).toEqual(["openrouter"]);
  });

  it("chiave rifiutata (401/403): passa al provider successivo senza riprovare", async () => {
    const calls = routeFetch({ gemini: [() => status(401, "invalid key")], groq: [() => ok("ok")] });
    const onFallback = vi.fn();
    const res = await run([ep("gemini"), ep("groq")], { onFallback });
    expect(res.endpoint.id).toBe("groq");
    expect(calls).toEqual(["gemini", "groq"]);
    expect(onFallback).toHaveBeenCalledWith("gemini", "groq", "auth");
  });

  it("se tutti falliscono, l'errore finale è quello dell'ultimo provider", async () => {
    routeFetch({ openrouter: [() => status(429, "free-models-per-day")], groq: [() => status(503), () => status(503), () => status(503)] });
    await expect(run([ep("openrouter"), ep("groq")])).rejects.toThrow(/groq 503/);
  });
});
