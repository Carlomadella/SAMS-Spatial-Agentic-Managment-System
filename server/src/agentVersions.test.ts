import { describe, expect, it } from "vitest";
import { openDb, saveWorldAgents, tombstoneWorldAgent } from "./db";
import { COALESCE_MS, configDiff, configOf, getVersion, listVersions, MAX_VERSIONS, recordConfigVersion } from "./agentVersions";
import type { WorldAgentSnapshot } from "./worldState";

const agent = (over: Partial<WorldAgentSnapshot> = {}): WorldAgentSnapshot => ({
  id: "a",
  name: "Blue",
  color: "blue",
  role: "Tester",
  status: "idle",
  task: null,
  progress: 0,
  model: "m1",
  instructions: "",
  repo: "",
  xp: 0,
  squad: "",
  ...over,
});

describe("versioni — regole", () => {
  it("differenze campo per campo", () => {
    const a = configOf(agent());
    const b = configOf(agent({ model: "m2", instructions: "solo test" }));
    expect(configDiff(a, b).map((c) => c.field)).toEqual(["model", "instructions"]);
    expect(configDiff(a, b)[0]).toMatchObject({ label: "Modello", before: "m1", after: "m2" });
    expect(configDiff(null, a).map((c) => c.field)).toEqual(["name", "color", "role", "model"]);
  });
});

describe("versioni — database", () => {
  it("una versione alla creazione e una a ogni modifica della configurazione", async () => {
    const db = await openDb(":memory:");
    await saveWorldAgents(db, [agent()], { by: "Carlo (owner)" });
    await saveWorldAgents(db, [agent({ status: "working", progress: 40 })], { by: "Carlo (owner)" }); // non è config
    let v = await listVersions(db, "a");
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ n: 1, createdBy: "Carlo (owner)" });
    await saveWorldAgents(db, [agent({ model: "m2" })], { by: "Anna (editor)" });
    v = await listVersions(db, "a");
    expect(v.map((x) => x.n)).toEqual([2, 1]);
    expect(v[0]).toMatchObject({ createdBy: "Anna (editor)", config: expect.objectContaining({ model: "m2" }) });
  });

  it("agente nato prima delle versioni: salva anche com'era prima", async () => {
    const db = await openDb(":memory:");
    await saveWorldAgents(db, [agent()]);
    await db.run(`DELETE FROM agent_versions`);
    await saveWorldAgents(db, [agent({ instructions: "nuove" })], { by: "Carlo (owner)" });
    const v = await listVersions(db, "a");
    expect(v.map((x) => [x.n, x.note, x.config.instructions])).toEqual([
      [2, "", "nuove"],
      [1, "com'era prima", ""],
    ]);
  });

  it("la stessa persona che scrive di fila riempie la stessa versione", async () => {
    const db = await openDb(":memory:");
    const cfg = (instructions: string) => configOf(agent({ instructions }));
    await recordConfigVersion(db, "a", cfg(""), "Carlo", 1000);
    await recordConfigVersion(db, "a", cfg("s"), "Carlo", 2000);
    await recordConfigVersion(db, "a", cfg("so"), "Carlo", 3000);
    await recordConfigVersion(db, "a", cfg("solo"), "Carlo", 4000);
    expect((await listVersions(db, "a")).map((v) => v.config.instructions)).toEqual(["solo", ""]);
    await recordConfigVersion(db, "a", cfg("solo test"), "Anna", 5000); // un'altra persona
    await recordConfigVersion(db, "a", cfg("solo test!"), "Anna", 5000 + COALESCE_MS + 1); // troppo dopo
    expect((await listVersions(db, "a")).map((v) => v.config.instructions)).toEqual(["solo test!", "solo test", "solo", ""]);
  });

  it(`tiene le ultime ${MAX_VERSIONS}`, async () => {
    const db = await openDb(":memory:");
    for (let i = 0; i < MAX_VERSIONS + 5; i++) {
      await recordConfigVersion(db, "a", configOf(agent({ model: `m${i}` })), `p${i}`, i * 10 * COALESCE_MS);
    }
    const v = await listVersions(db, "a");
    expect(v).toHaveLength(MAX_VERSIONS);
    expect(v[0].n).toBe(MAX_VERSIONS + 5);
    expect(await getVersion(db, "a", 5)).toBeNull();
    expect((await getVersion(db, "a", 6))?.config.model).toBe("m5");
  });

  it("il ripristino crea una versione nuova con la nota", async () => {
    const db = await openDb(":memory:");
    await saveWorldAgents(db, [agent()], { by: "Carlo" });
    await saveWorldAgents(db, [agent({ model: "m2" })], { by: "Carlo" });
    const v1 = await getVersion(db, "a", 1);
    await saveWorldAgents(db, [agent({ ...v1!.config })], { by: "Anna", note: "ripristino della versione 1" });
    const v = await listVersions(db, "a");
    expect(v[0]).toMatchObject({ n: 3, createdBy: "Anna", note: "ripristino della versione 1", config: expect.objectContaining({ model: "m1" }) });
    expect(v).toHaveLength(3);
  });

  it("cancellare l'agente cancella anche le sue versioni", async () => {
    const db = await openDb(":memory:");
    await saveWorldAgents(db, [agent(), agent({ id: "b" })], { by: "Carlo" });
    await tombstoneWorldAgent(db, "a");
    expect(await listVersions(db, "a")).toEqual([]);
    expect(await listVersions(db, "b")).toHaveLength(1);
    await saveWorldAgents(db, [agent({ id: "c" })], { by: "Carlo" }); // il push dell'owner toglie anche "b"
    expect(await listVersions(db, "b")).toEqual([]);
  });
});
