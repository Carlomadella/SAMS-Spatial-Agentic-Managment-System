import { describe, expect, it } from "vitest";
import { friendlyError } from "./friendlyError";

describe("friendlyError", () => {
  it("quota giornaliera di OpenRouter → frase in italiano con cosa fare, testo tecnico nei dettagli", () => {
    const raw = 'OpenRouter 429: {"error":{"message":"Rate limit exceeded: free-models-per-day. Add 10 credits"}}';
    const out = friendlyError(raw);
    expect(out.message).toMatch(/quot[ae] gratuit[ae].*finit/i);
    expect(out.message).toMatch(/⚙/);
    expect(out.detail).toBe(raw);
  });

  it("429 di Gemini in JSON grezzo → quota", () => {
    const out = friendlyError('Gemini 429: [{"error":{"code":429,"message":"You exceeded your current quota","status":"RESOURCE_EXHAUSTED"}}]');
    expect(out.message).toMatch(/quot/i);
    expect(out.message).not.toMatch(/\{/);
  });

  it("429 senza parola quota → provider occupato", () => {
    expect(friendlyError("Groq 429: Too Many Requests").message).toMatch(/occupato/i);
  });

  it("chiave rifiutata (401/403 del provider)", () => {
    expect(friendlyError('OpenRouter 401: {"error":{"message":"No auth credentials found"}}').message).toMatch(/chiave/i);
    expect(friendlyError("Gemini 403: API key not valid").message).toMatch(/chiave/i);
  });

  it("provider giù (5xx) e timeout", () => {
    expect(friendlyError("OpenRouter 503: Service Unavailable").message).toMatch(/non risponde|giù/i);
    expect(friendlyError("OpenRouter: nessuna risposta in 180 s").message).toMatch(/non ha risposto|tempo/i);
  });

  it("permessi GitHub", () => {
    const out = friendlyError("GitHub 403: Resource not accessible by integration");
    expect(out.message).toMatch(/GitHub/);
    expect(out.message).toMatch(/permess/i);
  });

  it("errore sconosciuto: resta il testo, accorciato, con Errore davanti", () => {
    const long = "x".repeat(600);
    const out = friendlyError(long);
    expect(out.message.startsWith("Errore: ")).toBe(true);
    expect(out.message.length).toBeLessThanOrEqual(260);
    expect(out.detail).toBe(long);
  });

  it("errore sconosciuto corto: nessun dettaglio doppio", () => {
    const out = friendlyError("file non trovato");
    expect(out.message).toBe("Errore: file non trovato");
    expect(out.detail).toBeUndefined();
  });

  it("i dettagli hanno un tetto", () => {
    const out = friendlyError("OpenRouter 429: quota " + "y".repeat(5000));
    expect(out.detail!.length).toBeLessThanOrEqual(2000);
  });
});
