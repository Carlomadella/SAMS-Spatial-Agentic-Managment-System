import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { config as loadEnv } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  consumeInvite,
  consumeToken,
  countOwners,
  countUsers,
  createAuthSession,
  createInvite,
  createToken,
  createUser,
  deleteGithubLink,
  getGithubLink,
  getMemory,
  getSessionUser,
  getToken,
  getUserByEmail,
  insertChatMessage,
  insertRoutine,
  insertTask,
  listChatMessages,
  loadSettingRows,
  listMemory,
  listPendingInvites,
  listRoutines,
  loadWorldAgents,
  loadWorldSnapshot,
  markRoutineRun,
  migrate,
  pruneAuthSessions,
  pruneWorldTombstones,
  recentTasks,
  saveGithubLink,
  saveSettingRows,
  setGithubRepo,
  saveWorldAgents,
  setMemory,
  setUserRole,
  taskStats,
} from "./db";
import { MAX_CHAT_MESSAGES } from "./chat";
import { openMysql, openSqlite, type SqlDriver } from "./sql";
import type { User } from "./auth";
import type { WorldAgentSnapshot } from "./worldState";

/**
 * Lo stesso contratto contro **ogni** backend: SQLite sempre, MySQL quando c'è
 * `SAMS_TEST_DB_URL` (es. `mysql://root:pw@localhost:3306/sams_test`). Qui stanno i punti
 * dove i due dialetti divergono davvero: upsert, ordine d'inserimento, potatura della
 * chat, la colonna `key`, collation, conteggi delle righe toccate.
 *
 * Il database MySQL di test viene **svuotato** (DROP delle tabelle) prima di ogni test:
 * per sicurezza il suo nome deve contenere "test".
 */
const TABLES = [
  "task_log", "agent_memory", "routines", "world_snapshot", "world_agents", "chat_messages",
  "users", "auth_sessions", "password_resets", "email_verifications", "invites", "settings", "github_links",
];

// L'URL di test può stare in server/.env (così la password non finisce sulla riga di comando).
loadEnv({ path: join(dirname(fileURLToPath(import.meta.url)), "..", ".env"), quiet: true });
const mysqlUrl = (process.env.SAMS_TEST_DB_URL ?? "").trim();
if (mysqlUrl && !/test/i.test(new URL(mysqlUrl).pathname)) {
  throw new Error("SAMS_TEST_DB_URL deve puntare a un database il cui nome contiene 'test' (viene svuotato)");
}

interface Backend {
  name: string;
  open: () => Promise<SqlDriver>;
}
const backends: Backend[] = [{ name: "sqlite", open: async () => migrate(openSqlite(":memory:")) }];
let shared: SqlDriver | null = null;
if (mysqlUrl) {
  backends.push({
    name: "mysql",
    open: async () => {
      shared ??= await openMysql({ url: mysqlUrl });
      for (const t of TABLES) await shared.exec(`DROP TABLE IF EXISTS ${t}`);
      return migrate(shared);
    },
  });
}
afterAll(async () => {
  await shared?.close();
});

const user = (over: Partial<User> = {}): User => ({
  id: "u1",
  email: "a@x.co",
  name: "A",
  passHash: "s:h",
  role: "owner",
  createdAt: 1,
  emailVerified: true,
  ...over,
});

const agent = (over: Partial<WorldAgentSnapshot> = {}): WorldAgentSnapshot => ({
  id: "a1",
  name: "Ada",
  color: "red",
  role: "Dev",
  status: "idle",
  task: null,
  progress: 0,
  model: "",
  instructions: "",
  repo: "",
  xp: 0,
  assignedBy: "",
  ...over,
});

describe.each(backends)("contratto del DB — $name", ({ open }) => {
  let db: SqlDriver;
  beforeEach(async () => {
    db = await open();
  });

  it("utenti: UNIQUE sull'email, ruoli, conteggi", async () => {
    await createUser(db, user());
    await expect(createUser(db, user({ id: "u2" }))).rejects.toThrow();
    await createUser(db, user({ id: "u2", email: "b@x.co", role: "viewer", createdAt: 2 }));
    expect(await countUsers(db)).toBe(2);
    expect(await countOwners(db)).toBe(1);
    // UPDATE che non cambia nulla conta comunque la riga trovata (come SQLite).
    expect(await setUserRole(db, "b@x.co", "viewer")).toBe(true);
    expect(await setUserRole(db, "nessuno@x.co", "editor")).toBe(false);
    expect((await getUserByEmail(db, "a@x.co"))?.emailVerified).toBe(true);
  });

  it("confronti sensibili a maiuscole (collation binaria)", async () => {
    await createUser(db, user());
    expect(await getUserByEmail(db, "A@X.CO")).toBeNull();
  });

  it("sessioni: join utente, scadenza e potatura", async () => {
    await createUser(db, user());
    await createAuthSession(db, "tok-ok", "u1", Date.now() + 60_000);
    await createAuthSession(db, "tok-old", "u1", Date.now() - 1);
    expect((await getSessionUser(db, "tok-ok"))?.email).toBe("a@x.co");
    expect(await getSessionUser(db, "tok-old")).toBeNull();
    expect(await pruneAuthSessions(db)).toBe(1);
  });

  it("token monouso: si spende una volta sola", async () => {
    await createToken(db, "password_resets", { tokenHash: "h", userId: "u1", createdAt: 1, expiresAt: 9e12, usedAt: null });
    expect(await consumeToken(db, "password_resets", "h")).toBe(true);
    expect(await consumeToken(db, "password_resets", "h")).toBe(false);
    expect((await getToken(db, "password_resets", "h"))?.usedAt).not.toBeNull();
  });

  it("inviti: elenco dei pendenti e consumo", async () => {
    const now = Date.now();
    await createInvite(db, { id: "i1", tokenHash: "ih", email: "c@x.co", role: "editor", invitedBy: "A", createdAt: now, expiresAt: now + 60_000, usedAt: null });
    expect((await listPendingInvites(db)).map((i) => i.id)).toEqual(["i1"]);
    expect(await consumeInvite(db, "ih")).toBe(true);
    expect(await listPendingInvites(db)).toEqual([]);
  });

  it("memoria agente: upsert sulla chiave `key` (parola riservata in MySQL)", async () => {
    await setMemory(db, "ag", "stack", "node");
    await setMemory(db, "ag", "stack", "node+mysql");
    expect(await getMemory(db, "ag", "stack")).toBe("node+mysql");
    expect((await listMemory(db, "ag")).map((m) => [m.key, m.value])).toEqual([["stack", "node+mysql"]]);
  });

  it("chat: tiene solo gli ultimi MAX_CHAT_MESSAGES, in ordine", async () => {
    for (let i = 0; i < MAX_CHAT_MESSAGES + 5; i++) {
      await insertChatMessage(db, { id: `m${String(i).padStart(4, "0")}`, author: "A", text: `t${i}`, ts: 1000 + i });
    }
    const msgs = await listChatMessages(db);
    expect(msgs).toHaveLength(MAX_CHAT_MESSAGES);
    expect(msgs[0].text).toBe("t5");
    expect(msgs.at(-1)!.text).toBe(`t${MAX_CHAT_MESSAGES + 4}`);
  });

  it("chat: a parità di ts decide l'id", async () => {
    for (let i = 0; i < MAX_CHAT_MESSAGES + 2; i++) {
      await insertChatMessage(db, { id: `m${String(i).padStart(4, "0")}`, author: "A", text: `t${i}`, ts: 5 });
    }
    const msgs = await listChatMessages(db);
    expect(msgs).toHaveLength(MAX_CHAT_MESSAGES);
    expect(msgs[0].id).toBe("m0002");
  });

  it("mondo: ordine d'inserimento stabile, rev, tombstone, versione", async () => {
    let r = await saveWorldAgents(db, [agent({ id: "zz" }), agent({ id: "aa" })]);
    expect(r.changed).toBe(true);
    expect(r.version).toBe(1);
    // Un update non sposta l'agente in coda (né su SQLite né su MySQL).
    r = await saveWorldAgents(db, [agent({ id: "zz", progress: 50 }), agent({ id: "aa" })]);
    expect(r.agents.map((a) => a.id)).toEqual(["zz", "aa"]);
    expect(r.version).toBe(2);
    // No-op: niente bump.
    r = await saveWorldAgents(db, [agent({ id: "zz", progress: 50 }), agent({ id: "aa" })]);
    expect(r.changed).toBe(false);
    expect(r.version).toBe(2);
    // Assenza → tombstone; ricomparsa → resurrezione.
    r = await saveWorldAgents(db, [agent({ id: "aa" })]);
    expect(r.agents.find((a) => a.id === "zz")?.deleted).toBe(true);
    r = await saveWorldAgents(db, [agent({ id: "aa" }), agent({ id: "zz", instructions: "x".repeat(2000) })]);
    expect(r.agents.find((a) => a.id === "zz")?.deleted).toBeUndefined();
    expect((await loadWorldSnapshot(db)).version).toBe(4);
    expect(await pruneWorldTombstones(db, 0, Date.now() + 1000)).toBe(0);
    expect((await loadWorldAgents(db)).map((a) => a.id)).toEqual(["zz", "aa"]);
  });

  it("routine e log dei task", async () => {
    await insertRoutine(db, "r1", { name: "n", title: "t", branch: "", kind: "daily", intervalMin: 60, atHour: 9, atMin: 0, enabled: true });
    await markRoutineRun(db, "r1", 123);
    expect((await listRoutines(db))[0]).toMatchObject({ id: "r1", kind: "daily", enabled: true, lastRun: 123 });

    await insertTask(db, { agentId: "a", agentName: "A", title: "x", branch: "b", status: "review", tokens: 10, ts: 1 });
    await insertTask(db, { agentId: "a", agentName: "A", title: "y", branch: "b", status: "error", tokens: 5, ts: 2 });
    expect(await taskStats(db)).toEqual({ total: 2, completed: 1, tokens: 15 });
    expect((await recentTasks(db, 1)).map((t) => t.title)).toEqual(["y"]);
  });

  it("impostazioni: upsert, rimozione e valori lunghi", async () => {
    expect(await loadSettingRows(db)).toEqual({});
    await saveSettingRows(db, { model: '"a"', openPRs: "true" });
    await saveSettingRows(db, { model: '"b"', githubRepo: JSON.stringify("x/" + "y".repeat(500)) }, ["openPRs"]);
    const rows = await loadSettingRows(db);
    expect(rows.model).toBe('"b"');
    expect(rows.openPRs).toBeUndefined();
    expect(JSON.parse(rows.githubRepo)).toHaveLength(502);
  });

  it("github_links: collega, sceglie la repo, ricollega e scollega", async () => {
    await saveGithubLink(db, "u1", "mario", "v1:" + "x".repeat(300), 1);
    expect(await setGithubRepo(db, "u1", "mario/app", "dev", 2)).toBe(true);
    await saveGithubLink(db, "u1", "MARIO", "v1:nuovo", 3);
    expect(await getGithubLink(db, "u1")).toEqual({
      userId: "u1", login: "MARIO", tokenEnc: "v1:nuovo", repo: "mario/app", baseBranch: "dev", updatedAt: 3,
    });
    await saveGithubLink(db, "u1", "luigi", "v1:altro", 4);
    expect(await getGithubLink(db, "u1")).toMatchObject({ login: "luigi", repo: "", baseBranch: "" });
    expect(await setGithubRepo(db, "nessuno", "a/b", "main")).toBe(false);
    await deleteGithubLink(db, "u1");
    expect(await getGithubLink(db, "u1")).toBeNull();
  });

  it("migrare due volte è innocuo", async () => {
    await createUser(db, user());
    await migrate(db);
    expect(await countUsers(db)).toBe(1);
  });

  // TiDB assegna gli AUTO_INCREMENT a blocchi per nodo: senza AUTO_ID_CACHE=1 `seq`
  // non segue l'ordine d'inserimento quando le scritture passano da nodi diversi.
  it("TiDB: world_agents.seq crescente su tutti i nodi (AUTO_ID_CACHE=1)", async () => {
    if (db.dialect !== "mysql") return;
    const v = await db.get<{ v: string }>(`SELECT VERSION() AS v`);
    if (!/tidb/i.test(v?.v ?? "")) return;
    const row = await db.get<Record<string, string>>(`SHOW CREATE TABLE world_agents`);
    expect(row?.["Create Table"]).toMatch(/AUTO_ID_CACHE=1\b/);
  });
});
