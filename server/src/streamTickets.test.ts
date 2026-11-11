import { describe, expect, it } from "vitest";
import { StreamTickets } from "./streamTickets";

describe("StreamTickets — biglietti monouso per lo stream eventi (D4-C)", () => {
  it("un biglietto emesso vale una volta sola e restituisce la credenziale che l'ha chiesto", () => {
    const t = new StreamTickets();
    const ticket = t.issue("sessione-A");
    expect(ticket).toMatch(/^[0-9a-f]{64}$/);
    expect(t.consume(ticket)).toBe("sessione-A");
    expect(t.consume(ticket)).toBeNull();
  });

  it("anche la credenziale vuota (dev aperto) si distingue da un biglietto non valido", () => {
    const t = new StreamTickets();
    const ticket = t.issue("");
    expect(t.consume(ticket)).toBe("");
  });

  it("biglietti vuoti, sconosciuti o non stringa non valgono", () => {
    const t = new StreamTickets();
    t.issue("x");
    expect(t.consume("")).toBeNull();
    expect(t.consume("inventato")).toBeNull();
    expect(t.consume(undefined)).toBeNull();
    expect(t.consume(["a"])).toBeNull();
  });

  it("scade dopo la durata prevista", () => {
    let now = 1_000;
    const t = new StreamTickets({ ttlMs: 30_000, now: () => now });
    const a = t.issue("x");
    const b = t.issue("x");
    now += 29_999;
    expect(t.consume(a)).toBe("x");
    now += 1;
    expect(t.consume(b)).toBeNull();
  });

  it("ogni biglietto è diverso", () => {
    const t = new StreamTickets();
    const seen = new Set(Array.from({ length: 50 }, () => t.issue("x")));
    expect(seen.size).toBe(50);
  });

  it("oltre il tetto per credenziale cadono i biglietti più vecchi di quella credenziale, non degli altri", () => {
    const t = new StreamTickets({ perCredential: 2 });
    const altrui = t.issue("B");
    const a1 = t.issue("A");
    t.issue("A");
    t.issue("A");
    expect(t.consume(a1)).toBeNull();
    expect(t.consume(altrui)).toBe("B");
  });

  it("a registro pieno rifiuta il nuovo biglietto invece di scartare quelli altrui", () => {
    const t = new StreamTickets({ max: 2 });
    const a = t.issue("A");
    const b = t.issue("B");
    expect(t.issue("C")).toBeNull();
    expect(t.consume(a)).toBe("A");
    expect(t.consume(b)).toBe("B");
  });

  it("i biglietti scaduti vengono ripuliti all'emissione", () => {
    let now = 0;
    const t = new StreamTickets({ ttlMs: 1_000, now: () => now, max: 2 });
    t.issue("A");
    t.issue("B");
    now = 5_000;
    expect(t.issue("C")).not.toBeNull();
    expect(t.size).toBe(1);
  });
});

// Ultrareview 2026-11-11: il tetto era per token di sessione. Un viewer con centinaia di
// login (una sessione per login) riempiva il tetto globale e lasciava tutti senza stream.
describe("StreamTickets — tetto per account e per IP", () => {
  it("tante sessioni dello stesso account contano insieme: cadono i suoi più vecchi", () => {
    const t = new StreamTickets({ perCredential: 3, max: 100 });
    const altrui = t.issue("sess-B", { user: "user-B", ip: "2.2.2.2" });
    const primi = Array.from({ length: 3 }, (_, i) => t.issue(`sess-A${i}`, { user: "user-A", ip: `1.1.1.${i}` }));
    for (let i = 3; i < 50; i++) t.issue(`sess-A${i}`, { user: "user-A", ip: `1.1.1.${i}` });
    expect(t.size).toBe(4); // 3 di A + 1 di B
    for (const p of primi) expect(t.consume(p)).toBeNull();
    expect(t.consume(altrui)).toBe("sess-B");
  });

  it("tanti account dallo stesso IP non saturano il registro", () => {
    const t = new StreamTickets({ perCredential: 10, perIp: 5, max: 20 });
    const altrui = t.issue("sess-B", { user: "user-B", ip: "2.2.2.2" });
    for (let i = 0; i < 200; i++) t.issue(`sess-${i}`, { user: `user-${i}`, ip: "6.6.6.6" });
    expect(t.size).toBe(6);
    expect(t.issue("sess-C", { user: "user-C", ip: "3.3.3.3" })).not.toBeNull();
    expect(t.consume(altrui)).toBe("sess-B");
  });

  it("senza account (token statico) il gruppo è la credenziale stessa", () => {
    const t = new StreamTickets({ perCredential: 2 });
    const s1 = t.issue("static-tok", { ip: "1.1.1.1" });
    t.issue("static-tok", { ip: "1.1.1.2" });
    t.issue("static-tok", { ip: "1.1.1.3" });
    expect(t.consume(s1)).toBeNull();
  });
});
