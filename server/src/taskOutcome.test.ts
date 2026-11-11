import { describe, expect, it } from "vitest";
import { concludeWithAnswer, taskOutcome } from "./agentTools";

// Collaudo 2026-11-10: un task di sola lettura riuscito (l'agente legge e chiude con `done`)
// finiva "idle": Cronologia "Inattivo", metriche e dashboard pubblica a 0 completati.
describe("taskOutcome", () => {
  it("con file scritti → in revisione, completato", () => {
    expect(taskOutcome({ wroteFiles: true, notionWrote: false, finished: true })).toMatchObject({
      status: "review", level: "SUCCESS", completed: true,
    });
  });

  it("con una scrittura su Notion → in revisione, completato", () => {
    expect(taskOutcome({ wroteFiles: false, notionWrote: true, finished: false })).toMatchObject({
      status: "review", completed: true,
    });
  });

  it("sola lettura chiusa con `done` → completato (done), non inattivo", () => {
    const o = taskOutcome({ wroteFiles: false, notionWrote: false, finished: true });
    expect(o).toMatchObject({ status: "done", level: "SUCCESS", completed: true });
  });

  it("nessuna scrittura e nessun `done` → inattivo con avviso", () => {
    expect(taskOutcome({ wroteFiles: false, notionWrote: false, finished: false })).toMatchObject({
      status: "idle", level: "WARN", completed: false,
    });
  });
});

describe("concludeWithAnswer", () => {
  const ctx = () => ({ doneSummary: "", finished: false });

  it("una risposta finale col testo conclude il task (il caso normale della sola lettura)", () => {
    const c = ctx();
    concludeWithAnswer(c, "Il README descrive…");
    expect(c).toEqual({ doneSummary: "Il README descrive…", finished: true });
  });

  it("una risposta vuota non conta come conclusione", () => {
    const c = ctx();
    concludeWithAnswer(c, "   ");
    expect(c.finished).toBe(false);
    concludeWithAnswer(c, undefined);
    expect(c.finished).toBe(false);
  });
});
