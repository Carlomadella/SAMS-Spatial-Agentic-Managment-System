import { describe, expect, it } from "vitest";
import { bubbleText, statusBubble } from "./bubble";

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

// 23/11: gli agenti «parlavano troppo» (un fumetto a ogni passo del lavoro). Ora il
// fumetto si apre solo nei momenti che contano: inizio, attesa approvazione, blocco, fine.
describe("statusBubble", () => {
  it("all'inizio del lavoro mostra il task", () => {
    expect(statusBubble("idle", "working", { task: "Correggi il login" })).toBe("▶ Correggi il login");
  });

  it("in attesa di approvazione lo dice", () => {
    expect(statusBubble("working", "awaiting_approval", {})).toBe("⏸ Aspetto la tua approvazione");
  });

  it("bloccato: icona e motivo breve, se c'è", () => {
    expect(statusBubble("working", "blocked", { error: "Errore: quota finita. Riprova domani." })).toBe("⚠ quota finita");
    expect(statusBubble("working", "blocked", {})).toBe("⚠ Bloccato");
  });

  it("a fine lavoro dice fatto", () => {
    expect(statusBubble("working", "done", {})).toBe("✓ Fatto");
    expect(statusBubble("working", "review", {})).toBe("✓ Fatto");
  });

  it("nessun fumetto se lo stato non cambia o l'agente torna libero", () => {
    expect(statusBubble("working", "working", { task: "x" })).toBeNull();
    expect(statusBubble("done", "idle", {})).toBeNull();
  });
});
