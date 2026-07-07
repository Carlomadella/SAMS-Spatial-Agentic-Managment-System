import { describe, it, expect } from "vitest";
import { coffeeBreak, officeClockChime } from "./interactions";
import type { Agent } from "../types";

// Un agente minimo: solo i campi che le interazioni leggono contano.
const agent = (id: string, hunger: number): Agent =>
  ({ id, name: id, hunger } as unknown as Agent);

describe("coffeeBreak", () => {
  it("nutre solo gli agenti con un po' di fame", () => {
    const r = coffeeBreak([agent("a", 40), agent("b", 0), agent("c", 10)]);
    expect(r.fedIds).toEqual(["a", "c"]);
    expect(r.amount).toBe(25);
    expect(r.message).toContain("2 agenti ricaricati");
  });

  it("usa il singolare con un solo agente affamato", () => {
    const r = coffeeBreak([agent("a", 5), agent("b", 0)]);
    expect(r.fedIds).toEqual(["a"]);
    expect(r.message).toContain("1 agente ricaricato");
  });

  it("nessuno affamato → messaggio 'tutti sazi', nessun id", () => {
    const r = coffeeBreak([agent("a", 0), agent("b", 0)]);
    expect(r.fedIds).toEqual([]);
    expect(r.message).toContain("già sazi");
  });

  it("rispetta l'amount passato", () => {
    expect(coffeeBreak([agent("a", 50)], 40).amount).toBe(40);
  });
});

describe("officeClockChime", () => {
  const at = (h: number, m = 0) => new Date(2026, 0, 1, h, m, 0);

  it("formatta ora zero-padded e fase corretta", () => {
    expect(officeClockChime(at(9, 5))).toContain("09:05");
    expect(officeClockChime(at(9, 5))).toContain("mattina");
    expect(officeClockChime(at(3))).toContain("notte fonda");
    expect(officeClockChime(at(15))).toContain("pomeriggio");
    expect(officeClockChime(at(21))).toContain("sera");
  });

  it("copre i confini delle fasi", () => {
    expect(officeClockChime(at(6))).toContain("mattina");
    expect(officeClockChime(at(12))).toContain("pomeriggio");
    expect(officeClockChime(at(18))).toContain("sera");
    expect(officeClockChime(at(5, 59))).toContain("notte");
  });
});
