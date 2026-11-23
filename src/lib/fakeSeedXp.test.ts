import { describe, expect, it } from "vitest";
import { dropFakeSeedXp } from "./fakeSeedXp";
import { useStore } from "../store/useStore";

describe("dropFakeSeedXp (browser)", () => {
  it("azzera solo i valori inventati degli agenti di partenza", () => {
    const { agents } = dropFakeSeedXp([{ id: "agent-purple", xp: 320 }, { id: "agent-purple-2", xp: 320 }]);
    expect(agents.map((a) => a.xp)).toEqual([0, 320]);
  });

  // Senza la migrazione la pagina riscriverebbe sul server gli XP finti di localStorage.
  it("la migrazione v3 dello store li toglie dallo stato salvato", () => {
    const opts = useStore.persist.getOptions();
    expect(opts.version).toBe(3);
    const migrated = opts.migrate!({ agents: [{ id: "agent-yellow", xp: 600, role: "", instructions: "x" }] }, 2) as { agents: Array<{ xp: number }> };
    expect(migrated.agents[0].xp).toBe(0);
  });
});
