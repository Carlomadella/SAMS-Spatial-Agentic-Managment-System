import { describe, it, expect } from "vitest";
import {
  buildWorldDiary,
  classifyEvent,
  diaryPlainText,
  startOfLocalDay,
  tallyLine,
  timeOfDayPhrase,
} from "./worldDiary";
import type { AgentColor, LogEvent } from "../types";

function ev(partial: Partial<LogEvent> & Pick<LogEvent, "level" | "message">): LogEvent {
  return {
    id: "e",
    ts: Date.now(),
    agentId: "a1",
    agentName: "blue-agent",
    color: "blue" as AgentColor,
    ...partial,
  };
}

describe("startOfLocalDay", () => {
  it("azzera ore/minuti/secondi", () => {
    const t = new Date(2026, 5, 30, 15, 42, 10).getTime();
    const d = new Date(startOfLocalDay(t));
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
  });
});

describe("timeOfDayPhrase", () => {
  it("mappa le fasce orarie", () => {
    expect(timeOfDayPhrase(new Date(2026, 0, 1, 9).getTime())).toBe("Stamattina");
    expect(timeOfDayPhrase(new Date(2026, 0, 1, 15).getTime())).toBe("Nel pomeriggio");
    expect(timeOfDayPhrase(new Date(2026, 0, 1, 21).getTime())).toBe("Stasera");
  });
});

describe("classifyEvent", () => {
  it("riconosce PR, completamento, blocco, revisione, errore, pausa", () => {
    expect(classifyEvent({ level: "SUCCESS", message: "PR #12 aperta" })).toBe("pr");
    expect(classifyEvent({ level: "SUCCESS", message: "Task completato: X" })).toBe("completed");
    expect(classifyEvent({ level: "ERROR", message: "Bloccato · richiede attenzione" })).toBe("blocked");
    expect(classifyEvent({ level: "ERROR", message: "Errore generico" })).toBe("error");
    expect(classifyEvent({ level: "WARN", message: "In attesa di revisione" })).toBe("review");
    expect(classifyEvent({ level: "IDLE", message: "Ora inattivo · nessun task" })).toBe("paused");
  });
  it("ignora INFO e WARN generici", () => {
    expect(classifyEvent({ level: "INFO", message: "Task avviato" })).toBeNull();
    expect(classifyEvent({ level: "WARN", message: "qualcosa" })).toBeNull();
  });
});

describe("tallyLine", () => {
  const base = { agentName: "blue", color: "blue" as AgentColor, prs: 0, completed: 0, blocked: 0, reviews: 0, errors: 0, paused: 0 };

  it("unisce più azioni con virgole ed 'e'", () => {
    expect(tallyLine({ ...base, prs: 2, completed: 1 })).toBe("blue ha aperto 2 PR e ha completato 1 task.");
  });
  it("frase di sola pausa quando non c'è altro", () => {
    expect(tallyLine({ ...base, paused: 3 })).toBe("blue è andato in pausa.");
  });
  it("null quando non è successo nulla di saliente", () => {
    expect(tallyLine(base)).toBeNull();
  });
  it("plurale del blocco", () => {
    expect(tallyLine({ ...base, blocked: 2 })).toBe("blue si è bloccato 2 volte.");
    expect(tallyLine({ ...base, blocked: 1 })).toBe("blue si è bloccato una volta.");
  });
});

describe("buildWorldDiary", () => {
  const now = new Date(2026, 5, 30, 18, 0).getTime();
  const at = (h: number, m = 0) => new Date(2026, 5, 30, h, m).getTime();

  it("giornata tranquilla quando non c'è nulla", () => {
    const d = buildWorldDiary([], now);
    expect(d.quiet).toBe(true);
    expect(d.lines).toEqual([]);
  });

  it("aggrega per agente e produce headline + prefisso orario", () => {
    const events: LogEvent[] = [
      ev({ ts: at(9), agentName: "blue", message: "PR #1 aperta", level: "SUCCESS" }),
      ev({ ts: at(10), agentName: "blue", message: "PR #2 aperta", level: "SUCCESS" }),
      ev({ ts: at(11), agentName: "purple", message: "Ora inattivo · nessun task", level: "IDLE", color: "purple" }),
    ];
    const d = buildWorldDiary(events, now);
    expect(d.quiet).toBe(false);
    expect(d.headline).toContain("2 PR");
    // prima riga con prefisso orario minuscolizzato
    expect(d.lines[0]).toMatch(/^Stamattina blue ha aperto 2 PR\.$/);
    expect(d.lines).toContain("purple è andato in pausa.");
  });

  it("esclude gli eventi di altri giorni", () => {
    const yesterday = ev({ ts: at(9) - 24 * 3600 * 1000, message: "PR vecchia", level: "SUCCESS" });
    const d = buildWorldDiary([yesterday], now);
    expect(d.quiet).toBe(true);
  });

  it("diaryPlainText concatena le righe", () => {
    const events = [ev({ ts: at(9), agentName: "blue", message: "Task completato: X", level: "SUCCESS" })];
    const d = buildWorldDiary(events, now);
    expect(diaryPlainText(d)).toContain("blue ha completato 1 task.");
  });
});
