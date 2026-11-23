import { describe, expect, it } from "vitest";
import { knownPlacements, labLamp, pendingCount, ROOM_SIGNS, VALID_MOVABLE_IDS, LAB_RESULT_MS } from "./roomSigns";
import { SEED_AGENTS } from "../data/seed";
import type { Agent, AgentStatus } from "../types";

// Stanze iconiche (23/11): dati puri dietro cartelli e oggetti simbolo.
const T = 1_000_000;

describe("labLamp — la lampada del Laboratorio", () => {
  it("spenta se nessuno lavora e non c'è un esito", () => {
    expect(labLamp(false, null, T)).toBe("off");
  });

  it("ambra mentre qualcuno lavora", () => {
    expect(labLamp(true, null, T)).toBe("amber");
  });

  it("verde o rossa per un minuto dopo un esito, anche senza nessuno al lavoro", () => {
    expect(LAB_RESULT_MS).toBe(60_000);
    expect(labLamp(false, { result: "success", at: T - 10_000 }, T)).toBe("green");
    expect(labLamp(true, { result: "failure", at: T - 10_000 }, T)).toBe("red");
  });

  it("dopo un minuto l'esito non conta più", () => {
    expect(labLamp(false, { result: "success", at: T - 70_000 }, T)).toBe("off");
    expect(labLamp(true, { result: "failure", at: T - 70_000 }, T)).toBe("amber");
  });
});

describe("pendingCount — lo schermo del Reparto revisioni", () => {
  const ag = (status: AgentStatus): Agent => ({ ...SEED_AGENTS[0], status });
  it("conta solo chi aspetta una conferma", () => {
    expect(pendingCount([ag("awaiting_approval"), ag("working"), ag("awaiting_approval"), ag("blocked")])).toBe(2);
    expect(pendingCount([])).toBe(0);
  });
});

describe("ROOM_SIGNS", () => {
  it("un cartello per ognuna delle sei stanze", () => {
    expect(Object.keys(ROOM_SIGNS).sort()).toEqual(["biblioteca", "camera", "laboratorio", "officina", "revisioni", "salotto"]);
    expect(ROOM_SIGNS.revisioni.label).toBe("Reparto revisioni");
  });
});

describe("knownPlacements — mobili che non ci sono più", () => {
  it("ignora le posizioni salvate di mobili scomparsi", () => {
    const saved = { "kitchen-island": { dx: 1, dz: 0 }, bookshelf: { dx: 0, dz: 2 }, "camera-bed-0": { dx: 0.5, dz: 0 } };
    expect(VALID_MOVABLE_IDS.has("camera-bed-0")).toBe(true);
    expect(knownPlacements(saved)).toEqual({ "camera-bed-0": { dx: 0.5, dz: 0 } });
  });
});
