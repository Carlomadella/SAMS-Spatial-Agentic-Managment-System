import { describe, expect, it } from "vitest";
import { DEFAULT_LLM_TIMEOUT_MS, llmTimeoutMs, retryMessage } from "./llmTimeout";

// Collaudo 2026-11-17 (simulazione sim-prenota-sale): con un timeout fisso di 60 s il
// modello gratuito non riusciva a generare un documento lungo; ogni tentativo veniva
// interrotto e il log diceva "OpenRouter occupato", che portava fuori strada.
describe("llmTimeoutMs", () => {
  it("di default lascia al modello ben più di 60 s per rispondere", () => {
    expect(llmTimeoutMs({})).toBe(DEFAULT_LLM_TIMEOUT_MS);
    expect(DEFAULT_LLM_TIMEOUT_MS).toBeGreaterThanOrEqual(180_000);
  });

  it("si regola con SAMS_LLM_TIMEOUT_MS", () => {
    expect(llmTimeoutMs({ SAMS_LLM_TIMEOUT_MS: "300000" })).toBe(300_000);
  });

  it("ignora valori non validi o troppo piccoli", () => {
    for (const v of ["", "abc", "-5", "0", "999"]) {
      expect(llmTimeoutMs({ SAMS_LLM_TIMEOUT_MS: v })).toBe(DEFAULT_LLM_TIMEOUT_MS);
    }
  });
});

describe("retryMessage", () => {
  it("un timeout dice che il modello non ha risposto in tempo, non che è occupato", () => {
    const m = retryMessage("OpenRouter", "timeout", 1, 2000, 180_000);
    expect(m).toContain("nessuna risposta in 180 s");
    expect(m).not.toContain("occupato");
  });

  it("429/5xx restano 'occupato'", () => {
    expect(retryMessage("OpenRouter", "busy", 2, 4000, 180_000)).toBe("OpenRouter occupato, riprovo (2) tra 4s…");
  });

  it("un guasto di rete lo dice", () => {
    expect(retryMessage("OpenRouter", "network", 1, 2000, 180_000)).toContain("errore di rete");
  });
});
