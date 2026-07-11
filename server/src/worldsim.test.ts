import { describe, expect, it } from "vitest";
import { MAX_SIM_AGENTS, sanitizeWorldSim, sanitizeWorldSimAgent } from "./worldsim";

describe("sanitizeWorldSimAgent", () => {
  it("normalizza un agente valido con posizione e waypoint", () => {
    expect(sanitizeWorldSimAgent({ id: "a", x: 1.5, z: -2, tx: 3, tz: 4 })).toEqual({
      id: "a",
      x: 1.5,
      z: -2,
      tx: 3,
      tz: 4,
    });
  });

  it("azzera il target se una sola coordinata è valida (fermo)", () => {
    expect(sanitizeWorldSimAgent({ id: "a", x: 0, z: 0, tx: 3, tz: null })).toEqual({
      id: "a",
      x: 0,
      z: 0,
      tx: null,
      tz: null,
    });
  });

  it("rifiuta id mancante o posizione non finita", () => {
    expect(sanitizeWorldSimAgent({ x: 1, z: 2 })).toBeNull();
    expect(sanitizeWorldSimAgent({ id: "a", x: "nope", z: 2 })).toBeNull();
    expect(sanitizeWorldSimAgent({ id: "a", x: 1, z: Infinity })).toBeNull();
    expect(sanitizeWorldSimAgent(null)).toBeNull();
  });

  it("taglia gli id troppo lunghi e fa trim", () => {
    const a = sanitizeWorldSimAgent({ id: "  x  ", x: 0, z: 0 });
    expect(a?.id).toBe("x");
    expect(a?.tx).toBeNull();
  });

  it("include i bisogni (energy/hunger) clampati a 0–100 quando presenti", () => {
    const a = sanitizeWorldSimAgent({ id: "a", x: 0, z: 0, energy: 150, hunger: -5 });
    expect(a?.energy).toBe(100);
    expect(a?.hunger).toBe(0);
  });

  it("omette i bisogni se assenti o non finiti (retro-compat)", () => {
    const a = sanitizeWorldSimAgent({ id: "a", x: 0, z: 0 });
    expect(a).not.toHaveProperty("energy");
    expect(a).not.toHaveProperty("hunger");
    const b = sanitizeWorldSimAgent({ id: "b", x: 0, z: 0, energy: "nope", hunger: Infinity });
    expect(b).not.toHaveProperty("energy");
    expect(b).not.toHaveProperty("hunger");
  });
});

describe("sanitizeWorldSim", () => {
  it("scarta le voci non valide e deduplica per id (l'ultima vince)", () => {
    const out = sanitizeWorldSim([
      { id: "a", x: 1, z: 1 },
      { id: "a", x: 2, z: 2 },
      { nope: true },
    ]);
    expect(out).toEqual([{ id: "a", x: 2, z: 2, tx: null, tz: null }]);
  });

  it("ritorna [] su input non-array", () => {
    expect(sanitizeWorldSim(null)).toEqual([]);
    expect(sanitizeWorldSim({})).toEqual([]);
  });

  it("taglia a MAX_SIM_AGENTS", () => {
    const many = Array.from({ length: MAX_SIM_AGENTS + 10 }, (_, i) => ({ id: `a${i}`, x: 0, z: 0 }));
    expect(sanitizeWorldSim(many)).toHaveLength(MAX_SIM_AGENTS);
  });
});
