import { describe, expect, it } from "vitest";
import { StreamTickets } from "./streamTickets";

describe("StreamTickets — biglietti monouso per lo stream eventi (D4-C)", () => {
  it("un biglietto emesso vale una volta sola", () => {
    const t = new StreamTickets();
    const ticket = t.issue();
    expect(ticket).toMatch(/^[0-9a-f]{64}$/);
    expect(t.consume(ticket)).toBe(true);
    expect(t.consume(ticket)).toBe(false);
  });

  it("biglietti vuoti, sconosciuti o non stringa non valgono", () => {
    const t = new StreamTickets();
    t.issue();
    expect(t.consume("")).toBe(false);
    expect(t.consume("inventato")).toBe(false);
    expect(t.consume(undefined)).toBe(false);
    expect(t.consume(["a"])).toBe(false);
  });

  it("scade dopo la durata prevista", () => {
    let now = 1_000;
    const t = new StreamTickets(30_000, () => now);
    const a = t.issue();
    const b = t.issue();
    now += 29_999;
    expect(t.consume(a)).toBe(true);
    now += 1;
    expect(t.consume(b)).toBe(false);
  });

  it("ogni biglietto è diverso", () => {
    const t = new StreamTickets();
    const seen = new Set(Array.from({ length: 50 }, () => t.issue()));
    expect(seen.size).toBe(50);
  });

  it("non cresce senza limite: oltre il massimo cadono i più vecchi", () => {
    const t = new StreamTickets(30_000, Date.now, 3);
    const first = t.issue();
    t.issue();
    t.issue();
    const fourth = t.issue();
    expect(t.size).toBe(3);
    expect(t.consume(first)).toBe(false);
    expect(t.consume(fourth)).toBe(true);
  });

  it("i biglietti scaduti vengono ripuliti all'emissione", () => {
    let now = 0;
    const t = new StreamTickets(1_000, () => now);
    t.issue();
    t.issue();
    now = 5_000;
    t.issue();
    expect(t.size).toBe(1);
  });
});
