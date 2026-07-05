import { describe, it, expect } from "vitest";
import {
  dailyScheduledMs,
  describeSchedule,
  dueRoutines,
  isDue,
  nextRun,
  sanitizeRoutine,
  type Routine,
} from "./routines";

function routine(over: Partial<Routine> & { id: string }): Routine {
  return {
    name: "Riepilogo",
    title: "Riepiloga le PR aperte",
    branch: "",
    kind: "interval",
    intervalMin: 60,
    atHour: 9,
    atMin: 0,
    enabled: true,
    lastRun: 0,
    ...over,
  };
}

describe("sanitizeRoutine", () => {
  it("richiede nome e titolo", () => {
    expect(sanitizeRoutine(undefined)).toBeNull();
    expect(sanitizeRoutine({ name: "", title: "x" })).toBeNull();
    expect(sanitizeRoutine({ name: "x", title: "  " })).toBeNull();
  });

  it("normalizza e riporta i valori nei limiti", () => {
    const r = sanitizeRoutine({
      name: "  Daily  ",
      title: "  Fai il riepilogo  ",
      kind: "daily",
      intervalMin: 0,
      atHour: 30,
      atMin: -5,
      branch: " main ",
    });
    expect(r).toMatchObject({
      name: "Daily",
      title: "Fai il riepilogo",
      kind: "daily",
      intervalMin: 1,
      atHour: 23,
      atMin: 0,
      branch: "main",
      enabled: true,
    });
  });

  it("un kind sconosciuto diventa interval, enabled default true", () => {
    const r = sanitizeRoutine({ name: "n", title: "t", kind: "weird" as never });
    expect(r?.kind).toBe("interval");
    expect(r?.enabled).toBe(true);
    expect(sanitizeRoutine({ name: "n", title: "t", enabled: false })?.enabled).toBe(false);
  });
});

describe("isDue — interval", () => {
  it("scatta subito se non è mai stata eseguita", () => {
    expect(isDue(routine({ id: "r", lastRun: 0 }), 10_000)).toBe(true);
  });

  it("scatta solo dopo l'intervallo", () => {
    const now = 10_000_000;
    const r = routine({ id: "r", intervalMin: 10, lastRun: now - 9 * 60_000 });
    expect(isDue(r, now)).toBe(false);
    expect(isDue({ ...r, lastRun: now - 10 * 60_000 }, now)).toBe(true);
  });

  it("mai quando disabilitata", () => {
    expect(isDue(routine({ id: "r", enabled: false }), 10_000)).toBe(false);
  });
});

describe("isDue — daily", () => {
  it("scatta una sola volta dopo l'orario del giorno", () => {
    const at9 = dailyScheduledMs(Date.now(), 9, 0);
    const r = routine({ id: "r", kind: "daily", atHour: 9, atMin: 0, lastRun: 0 });
    // un minuto prima delle 9 → non dovuta
    expect(isDue(r, at9 - 60_000)).toBe(false);
    // subito dopo le 9 → dovuta
    expect(isDue(r, at9 + 60_000)).toBe(true);
    // già eseguita dopo le 9 → non più dovuta
    expect(isDue({ ...r, lastRun: at9 + 30_000 }, at9 + 60_000)).toBe(false);
  });
});

describe("nextRun", () => {
  it("interval: ultima esecuzione + intervallo", () => {
    const r = routine({ id: "r", intervalMin: 15, lastRun: 1_000_000 });
    expect(nextRun(r, 1_000_000)).toBe(1_000_000 + 15 * 60_000);
  });

  it("daily: oggi se non ancora passato, domani altrimenti", () => {
    const at9 = dailyScheduledMs(Date.now(), 9, 0);
    const r = routine({ id: "r", kind: "daily", atHour: 9, atMin: 0 });
    expect(nextRun(r, at9 - 60_000)).toBe(at9);
    expect(nextRun(r, at9 + 60_000)).toBe(at9 + 24 * 60 * 60_000);
  });
});

describe("dueRoutines", () => {
  it("ritorna solo le routine dovute", () => {
    const now = 10_000_000;
    const list = [
      routine({ id: "a", lastRun: 0 }),
      routine({ id: "b", enabled: false }),
      routine({ id: "c", intervalMin: 10, lastRun: now }),
    ];
    expect(dueRoutines(list, now).map((r) => r.id)).toEqual(["a"]);
  });
});

describe("describeSchedule", () => {
  it("legge come una frase", () => {
    expect(describeSchedule({ kind: "interval", intervalMin: 60, atHour: 0, atMin: 0 })).toBe("ogni 60 min");
    expect(describeSchedule({ kind: "daily", intervalMin: 60, atHour: 9, atMin: 5 })).toBe(
      "ogni giorno alle 09:05",
    );
  });
});
