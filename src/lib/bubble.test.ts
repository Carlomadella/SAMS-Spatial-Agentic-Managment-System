import { describe, expect, it } from "vitest";
import { bubbleText } from "./bubble";

describe("bubbleText", () => {
  it("un errore diventa icona + prima frase breve", () => {
    const t = bubbleText("Le quote gratuite di OpenRouter sono finite per oggi. Riprova più tardi o aggiungi una chiave.", "ERROR");
    expect(t.startsWith("⚠ ")).toBe(true);
    expect(t.length).toBeLessThanOrEqual(42);
    expect(t).not.toMatch(/Riprova/);
  });

  it("un errore tecnico non mostra il JSON intero", () => {
    const t = bubbleText('Errore: Gemini 429: [{"error":{"code":429,"message":"You exceeded your current quota"}}]', "ERROR");
    expect(t.length).toBeLessThanOrEqual(42);
    expect(t).not.toMatch(/^⚠ Errore/);
  });

  it("i messaggi normali restano fino a 90 caratteri", () => {
    expect(bubbleText("PR #3 letta")).toBe("PR #3 letta");
    expect(bubbleText("x".repeat(120)).length).toBe(90);
  });
});
