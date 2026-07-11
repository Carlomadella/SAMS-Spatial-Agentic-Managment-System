import { describe, expect, it } from "vitest";
import { SIM_TTL, iAmSimulator, ingestSim, pruneSim, separationPush, type SimAgent } from "./worldsim";

const mk = (ts: number): SimAgent => ({ x: 0, z: 0, tx: null, tz: null, ts });

describe("pruneSim", () => {
  it("tiene gli stati freschi e scarta gli scaduti", () => {
    const now = 10_000;
    const sim = { a: mk(now - 1000), b: mk(now - (SIM_TTL + 500)) };
    expect(Object.keys(pruneSim(sim, now))).toEqual(["a"]);
  });

  it("ritorna lo stesso riferimento quando nulla è scaduto", () => {
    const now = 10_000;
    const sim = { a: mk(now - 100) };
    expect(pruneSim(sim, now)).toBe(sim);
  });

  it("gestisce la mappa vuota", () => {
    const sim: Record<string, SimAgent> = {};
    expect(pruneSim(sim, 1)).toBe(sim);
  });
});

describe("ingestSim", () => {
  it("costruisce la mappa timbrando il tempo di ricezione", () => {
    const out = ingestSim([{ id: "a", x: 1, z: 2, tx: 3, tz: 4 }], 500);
    expect(out).toEqual({ a: { x: 1, z: 2, tx: 3, tz: 4, ts: 500 } });
  });

  it("sostituisce (non fonde) e scarta le voci senza id", () => {
    const out = ingestSim(
      [
        { id: "a", x: 1, z: 1, tx: null, tz: null },
        { id: "", x: 9, z: 9, tx: null, tz: null },
      ],
      0,
    );
    expect(Object.keys(out)).toEqual(["a"]);
  });

  it("porta i bisogni (energy/hunger) quando spinti dal driver", () => {
    const out = ingestSim([{ id: "a", x: 0, z: 0, tx: null, tz: null, energy: 42, hunger: 88 }], 0);
    expect(out.a.energy).toBe(42);
    expect(out.a.hunger).toBe(88);
  });

  it("lascia i bisogni undefined se il driver non li spinge", () => {
    const out = ingestSim([{ id: "a", x: 0, z: 0, tx: null, tz: null }], 0);
    expect(out.a.energy).toBeUndefined();
    expect(out.a.hunger).toBeUndefined();
  });
});

describe("separationPush", () => {
  const others = (arr: [string, [number, number]][]) => arr;

  it("è [0,0] se nessun altro è entro minSep", () => {
    expect(separationPush([0, 0], others([["b", [5, 0]]]), "a", 1.6)).toEqual([0, 0]);
  });

  it("spinge lontano da un vicino troppo stretto", () => {
    const [px, pz] = separationPush([0, 0], others([["b", [1, 0]]]), "a", 1.6);
    expect(px).toBeLessThan(0); // b è a +x → spinge verso -x
    expect(pz).toBe(0);
  });

  it("esclude se stesso", () => {
    expect(separationPush([0, 0], others([["a", [0.1, 0]]]), "a", 1.6)).toEqual([0, 0]);
  });

  it("più vicino = spinta più forte", () => {
    const near = separationPush([0, 0], others([["b", [0.4, 0]]]), "a", 1.6)[0];
    const far = separationPush([0, 0], others([["b", [1.2, 0]]]), "a", 1.6)[0];
    expect(Math.abs(near)).toBeGreaterThan(Math.abs(far));
  });

  it("somma le spinte di più vicini", () => {
    const [px, pz] = separationPush([0, 0], others([["b", [1, 0]], ["c", [0, 1]]]), "a", 1.6);
    expect(px).toBeLessThan(0);
    expect(pz).toBeLessThan(0);
  });
});

describe("iAmSimulator", () => {
  it("è vero se nessuno guida (default: simuliamo)", () => {
    expect(iAmSimulator(null, "me")).toBe(true);
  });

  it("è vero se guido io", () => {
    expect(iAmSimulator({ holderId: "me" }, "me")).toBe(true);
  });

  it("è falso se guida un'altra vista (sono follower)", () => {
    expect(iAmSimulator({ holderId: "other" }, "me")).toBe(false);
  });
});
