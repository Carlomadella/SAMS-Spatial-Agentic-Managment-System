import { describe, expect, it } from "vitest";
import { openDb } from "./db";
import { addComment, createTask, setTaskStatus } from "./tasks";
import { startAttempt } from "./taskRecorder";
import { clearAfter, dependentsOf, enqueueTask, getQueued, handoffContext, listQueue, readiness, removeQueued, waitMessage } from "./taskQueue";

const q = (over: Partial<Parameters<typeof enqueueTask>[1]> = {}) => ({
  agentId: "b",
  agentName: "Tester",
  title: "Scrivi i test",
  branch: "",
  createdBy: "Carlo (owner)",
  payload: { role: "Tester", userId: "u1", repo: null },
  ...over,
});

describe("coda sul server", () => {
  it("prima gli urgenti, poi in ordine d'arrivo; la coda è per agente", async () => {
    const db = await openDb(":memory:");
    await enqueueTask(db, q({ title: "uno" }), 1);
    await enqueueTask(db, q({ title: "due" }), 2);
    await enqueueTask(db, q({ title: "urgente", urgent: true }), 3);
    await enqueueTask(db, q({ agentId: "c", title: "altro agente" }), 4);
    expect((await listQueue(db, "b")).map((t) => t.title)).toEqual(["urgente", "uno", "due"]);
    expect(await listQueue(db)).toHaveLength(4);
    const first = (await listQueue(db, "b"))[0];
    expect(first.payload).toMatchObject({ role: "Tester", userId: "u1" });
  });

  it("si toglie solo se non è ancora partito", async () => {
    const db = await openDb(":memory:");
    const t = await enqueueTask(db, q());
    await startAttempt(db, t.id, "");
    expect(await removeQueued(db, t.id)).toBe(false);
    const u = await enqueueTask(db, q());
    expect(await removeQueued(db, u.id)).toBe(true);
    expect(await getQueued(db, u.id)).toBeNull();
  });

  it("aspetta che finisca: parte solo se il task atteso è finito bene", async () => {
    const db = await openDb(":memory:");
    const dev = await createTask(db, { agentId: "a", agentName: "Dev", title: "Implementa il login", branch: "feat/login", createdBy: "Carlo" });
    const test = await enqueueTask(db, q({ afterTaskId: dev.id }));
    expect((await dependentsOf(db, dev.id)).map((t) => t.id)).toEqual([test.id]);

    let r = await readiness(db, test);
    expect(r).toMatchObject({ ready: false, why: "waiting" });
    expect(waitMessage(r, test)).toMatch(/parte quando finisce il task «Implementa il login»/);

    await startAttempt(db, dev.id, "");
    await setTaskStatus(db, dev.id, "blocked");
    r = await readiness(db, test);
    expect(r).toMatchObject({ ready: false, why: "after-blocked" });
    expect(waitMessage(r, test)).toMatch(/resta in attesa: il task «Implementa il login» è finito bloccato/);

    await setTaskStatus(db, dev.id, "review");
    expect(await readiness(db, test)).toMatchObject({ ready: true });
  });

  it("togliere l'attesa lo fa partire appena l'agente è libero", async () => {
    const db = await openDb(":memory:");
    const t = await enqueueTask(db, q({ afterTaskId: "t-00000000-0000-0000-0000-000000000000" }));
    expect(await readiness(db, t)).toMatchObject({ ready: false, why: "after-missing" });
    await clearAfter(db, t.id);
    expect(await readiness(db, (await getQueued(db, t.id))!)).toMatchObject({ ready: true, after: null });
  });

  it("passa il riassunto del task precedente", async () => {
    const db = await openDb(":memory:");
    const dev = await createTask(db, { agentId: "a", agentName: "Dev", title: "Implementa il login", branch: "feat/login", createdBy: "Carlo" });
    const rec = await startAttempt(db, dev.id, "feat/login");
    rec.wrap(() => {})({ agentId: "a", agentName: "Dev", result: { title: "Implementa il login", summary: "Aggiunto login.ts e la sua rotta" } });
    await rec.flush();
    const ctx = await handoffContext(db, (await getQueued(db, dev.id))!);
    expect(ctx).toContain("parte dopo «Implementa il login» di Dev (branch feat/login)");
    expect(ctx).toContain("Aggiunto login.ts e la sua rotta");
  });

  it("un task partito dalla coda riceve anche i commenti", async () => {
    const db = await openDb(":memory:");
    const t = await enqueueTask(db, q());
    await addComment(db, t.id, "Anna", "usa vitest");
    const rec = await startAttempt(db, t.id, "");
    expect(rec.comments).toContain("Anna: usa vitest");
    expect(await listQueue(db, "b")).toEqual([]);
  });
});
