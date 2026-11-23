import { describe, expect, it } from "vitest";
import { dropFakeSeedXp } from "./fakeSeedXp";

describe("dropFakeSeedXp", () => {
  it("azzera solo i sei agenti di partenza con esattamente il valore inventato", () => {
    const { agents, changed } = dropFakeSeedXp([
      { id: "agent-yellow", xp: 600 },
      { id: "agent-blue", xp: 110 }, // XP veri guadagnati: restano
      { id: "agent-red", xp: 10 },
      { id: "agent-custom", xp: 600 }, // non è un agente di partenza
    ]);
    expect(agents.map((a) => a.xp)).toEqual([0, 110, 0, 600]);
    expect(changed).toBe(2);
  });

  it("niente da cambiare: stessi oggetti, changed 0", () => {
    const input = [{ id: "agent-blue", xp: 0 }, { id: "x" }];
    const { agents, changed } = dropFakeSeedXp(input);
    expect(changed).toBe(0);
    expect(agents[0]).toBe(input[0]);
  });
});
