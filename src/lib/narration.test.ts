import { describe, it, expect } from "vitest";
import { narrationLine, stripForSpeech } from "./narration";

describe("stripForSpeech", () => {
  it("rimuove URL, inline-code ed emoji", () => {
    expect(stripForSpeech("✅ fatto `src/x.ts` vedi https://a.b/c qui")).toBe("fatto  vedi  qui".replace(/\s+/g, " ").trim());
  });
  it("converte #N in 'numero N'", () => {
    expect(stripForSpeech("PR #128 aperta")).toBe("PR numero 128 aperta");
  });
  it("tronca a 160 caratteri", () => {
    expect(stripForSpeech("x".repeat(300)).length).toBeLessThanOrEqual(160);
  });
});

describe("narrationLine", () => {
  const ev = (level: "INFO" | "SUCCESS" | "WARN" | "ERROR" | "IDLE", message: string, agentName = "blue-agent") =>
    ({ level, message, agentName });

  it("annuncia il completamento su SUCCESS", () => {
    expect(narrationLine(ev("SUCCESS", "Lavoro completato"))).toBe("blue-agent: Lavoro completato.");
  });

  it("riconosce l'apertura di una PR", () => {
    expect(narrationLine(ev("SUCCESS", "PR #12: https://github.com/x/y/pull/12"))).toBe(
      "blue-agent ha aperto una pull request.",
    );
  });

  it("annuncia errore e revisione e blocco", () => {
    expect(narrationLine(ev("ERROR", "Errore: boom"))).toBe("blue-agent ha riscontrato un errore.");
    expect(narrationLine(ev("WARN", "2 file pronti — approva o rifiuta nel pannello"))).toBe(
      "blue-agent è in attesa di revisione.",
    );
    expect(narrationLine(ev("WARN", "Task bloccato dall'utente"))).toBe("blue-agent è bloccato.");
  });

  it("tace su rumore di basso livello, ragionamento e chiacchiere", () => {
    expect(narrationLine(ev("INFO", "read src/app.ts"))).toBeNull();
    expect(narrationLine(ev("INFO", "💭 sto leggendo il file…"))).toBeNull();
    expect(narrationLine(ev("INFO", "💬 blue → green: ciao"))).toBeNull();
    expect(narrationLine(ev("IDLE", "Nessun task attivo"))).toBeNull();
    expect(narrationLine(ev("INFO", "Task avviato"))).toBeNull();
    expect(narrationLine(ev("WARN", "qualcosa di generico"))).toBeNull();
  });

  it("ripiega su un nome di default se l'agente è vuoto", () => {
    expect(narrationLine({ level: "ERROR", message: "x", agentName: "" })).toBe("Un agente ha riscontrato un errore.");
  });
});
