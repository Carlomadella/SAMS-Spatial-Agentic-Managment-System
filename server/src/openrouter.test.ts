import { afterEach, describe, expect, it, vi } from "vitest";
import { isRetryableError, openrouterChat, openrouterHeaders, openrouterModel } from "./openrouter";

describe("openrouterModel", () => {
  it("falls back to a default :free model when the stored model is not an OpenRouter id", () => {
    // The default env model (e.g. a Gemini id, no "/") must not leak through.
    const m = openrouterModel();
    expect(m).toContain("/");
    expect(m).toMatch(/:free$/);
  });

  it("returns a non-empty string", () => {
    expect(openrouterModel().length).toBeGreaterThan(0);
  });
});

describe("openrouterHeaders", () => {
  it("are accepted by fetch: every value is a valid ByteString (no em dash, no accents)", () => {
    // Il bug del 2026-11-10: `X-Title` conteneva "—" e fetch rifiutava la richiesta
    // prima di spedirla (TypeError: Cannot convert argument to a ByteString).
    // `new Headers` applica la stessa validazione di fetch.
    const h = openrouterHeaders("sk-or-test");
    expect(() => new Headers(h)).not.toThrow();
    for (const v of Object.values(h)) expect(v).toMatch(/^[\x20-\x7e]*$/);
  });

  it("carries the key and the app attribution", () => {
    const h = new Headers(openrouterHeaders("sk-or-test"));
    expect(h.get("authorization")).toBe("Bearer sk-or-test");
    expect(h.get("content-type")).toBe("application/json");
    expect(h.get("x-title")).toContain("SAMS");
    expect(h.get("http-referer")).toMatch(/^https:\/\//);
  });
});

// Collaudo 2026-11-10: qualunque eccezione (anche un 400 o un errore di programmazione) veniva
// ritentata 4 volte con "OpenRouter occupato", ~30 s persi prima dell'errore vero.
describe("isRetryableError", () => {
  it("ritenta errori di rete e timeout", () => {
    expect(isRetryableError(new TypeError("fetch failed"))).toBe(true);
    expect(isRetryableError(Object.assign(new Error("t"), { name: "TimeoutError" }))).toBe(true);
    expect(isRetryableError(Object.assign(new Error("a"), { name: "AbortError" }))).toBe(true);
    expect(isRetryableError(Object.assign(new Error("x"), { cause: { code: "ECONNRESET" } }))).toBe(true);
  });

  it("non ritenta errori HTTP definitivi né errori di programmazione", () => {
    expect(isRetryableError(new Error("OpenRouter 400: bad request"))).toBe(false);
    expect(isRetryableError(new SyntaxError("Unexpected token < in JSON"))).toBe(false);
    expect(isRetryableError(new TypeError("Cannot read properties of undefined (reading 'message')"))).toBe(false);
    expect(isRetryableError("stringa")).toBe(false);
  });
});

describe("openrouterChat — retry solo sui guasti transitori", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("un 400 esce subito con l'errore vero, senza riprovare", async () => {
    const f = vi.fn(async () => new Response("modello inesistente", { status: 400 }));
    vi.stubGlobal("fetch", f);
    const onRetry = vi.fn();
    await expect(openrouterChat([], [], "sys", onRetry)).rejects.toThrow("OpenRouter 400: modello inesistente");
    expect(f).toHaveBeenCalledOnce();
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("una risposta illeggibile esce subito, senza riprovare", async () => {
    const f = vi.fn(async () => new Response("<html>", { status: 200 }));
    vi.stubGlobal("fetch", f);
    await expect(openrouterChat([], [], "sys")).rejects.toThrow();
    expect(f).toHaveBeenCalledOnce();
  });

  it("un errore di rete viene ritentato e poi riesce", async () => {
    vi.useFakeTimers();
    const ok = { choices: [{ message: { content: "ciao" }, finish_reason: "stop" }], usage: { total_tokens: 3 } };
    const f = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(ok), { status: 200 }));
    vi.stubGlobal("fetch", f);
    const onRetry = vi.fn();
    const p = openrouterChat([], [], "sys", onRetry);
    await vi.runAllTimersAsync();
    await expect(p).resolves.toMatchObject({ text: "ciao", tokens: 3 });
    expect(f).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });
});
