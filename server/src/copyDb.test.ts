import { describe, expect, it } from "vitest";
import { copyDatabase } from "./copyDb";
import {
  countUsers,
  createUser,
  getMemory,
  insertChatMessage,
  listChatMessages,
  loadWorldAgents,
  loadWorldSnapshot,
  openDb,
  saveWorldAgents,
  setMemory,
} from "./db";
import type { WorldAgentSnapshot } from "./worldState";

const agent = (id: string): WorldAgentSnapshot => ({
  id, name: id, color: "", role: "", status: "idle", task: null, progress: 0,
  model: "", instructions: "", repo: "", xp: 0, assignedBy: "",
});

describe("copyDatabase", () => {
  it("copia tutte le tabelle preservando l'ordine del roster e la versione del mondo", async () => {
    const src = await openDb(":memory:");
    await createUser(src, { id: "u1", email: "a@x.co", name: "A", passHash: "s:h", role: "owner", createdAt: 1, emailVerified: true });
    await setMemory(src, "ag", "k", "v");
    await insertChatMessage(src, { id: "m1", author: "A", text: "ciao", ts: 1 });
    await saveWorldAgents(src, [agent("zz"), agent("aa")]);
    await saveWorldAgents(src, [agent("zz"), agent("aa"), agent("mm")]);

    const dst = await openDb(":memory:");
    const counts = await copyDatabase(src, dst);

    expect(counts).toMatchObject({ users: 1, agent_memory: 1, chat_messages: 1, world_agents: 3, world_snapshot: 1 });
    expect(await countUsers(dst)).toBe(1);
    expect(await getMemory(dst, "ag", "k")).toBe("v");
    expect((await listChatMessages(dst)).map((m) => m.text)).toEqual(["ciao"]);
    expect((await loadWorldAgents(dst)).map((a) => a.id)).toEqual(["zz", "aa", "mm"]);
    expect((await loadWorldSnapshot(dst)).version).toBe(2);
  });

  it("rifiuta una destinazione che contiene già dati, senza toccarla", async () => {
    const src = await openDb(":memory:");
    await createUser(src, { id: "u1", email: "a@x.co", name: "A", passHash: "s:h", role: "owner", createdAt: 1, emailVerified: true });
    const dst = await openDb(":memory:");
    await createUser(dst, { id: "u9", email: "z@x.co", name: "Z", passHash: "s:h", role: "owner", createdAt: 1, emailVerified: true });
    await expect(copyDatabase(src, dst)).rejects.toThrow(/non è vuota.*users/);
    expect(await countUsers(dst)).toBe(1);
  });
});
