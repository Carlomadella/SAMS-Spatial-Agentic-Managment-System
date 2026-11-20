import { afterEach, describe, expect, it } from "vitest";
import { useStore } from "./useStore";
import { house } from "../data/world";
import { SEED_AGENTS } from "../data/seed";
import type { Agent } from "../types";

const many = (n: number): Agent[] =>
  Array.from({ length: n }, (_, i) => ({ ...SEED_AGENTS[i % SEED_AGENTS.length], id: `a${i}`, name: `A${i}` }));

describe("la casa segue il numero di agenti", () => {
  afterEach(() => useStore.setState({ agents: SEED_AGENTS }));

  it("7 agenti → un'ala; 5 la tengono; 4 la tolgono", () => {
    useStore.setState({ agents: many(7) });
    expect(useStore.getState().houseWings).toBe(1);
    expect(house().wings).toHaveLength(1);
    useStore.setState({ agents: many(5) });
    expect(useStore.getState().houseWings).toBe(1);
    useStore.setState({ agents: many(4) });
    expect(useStore.getState().houseWings).toBe(0);
    expect(house().bounds.maxX).toBe(13);
  });

  it("13 agenti → due ali, ognuno col suo letto", () => {
    useStore.setState({ agents: many(13) });
    expect(useStore.getState().houseWings).toBe(2);
    expect(house().beds.length).toBeGreaterThanOrEqual(13);
  });
});
