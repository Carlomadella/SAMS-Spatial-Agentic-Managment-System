import { describe, expect, it } from "vitest";
import { openDb } from "./db";
import {
  addComment,
  commentsPrompt,
  createTask,
  eventFromWire,
  exportTask,
  getTask,
  isTaskId,
  listComments,
  listEvents,
  listTasks,
  MAX_EVENTS_PER_TASK,
  pruneOldTasks,
  TASK_RETENTION_MS,
  takeCommentsForAttempt,
} from "./tasks";
import { startAttempt } from "./taskRecorder";
import { firstUserMessage } from "./agentTools";
import type { WireEvent } from "./types";

const base = { agentId: "a", agentName: "Blue", title: "Sistema il login", branch: "", createdBy: "Carlo (owner)" };

describe("task — regole", () => {
  it("id dei task", async () => {
    const db = await openDb(":memory:");
    const t = await createTask(db, base);
    expect(isTaskId(t.id)).toBe(true);
    expect(isTaskId("x")).toBe(false);
    expect(t).toMatchObject({ status: "queued", attempts: 0, createdBy: "Carlo (owner)" });
  });

  it("dallo stream alla storia: piano, risultato, messaggi; il resto no", () => {
    expect(eventFromWire({ agentId: "a", agentName: "B", plan: ["uno", "due"] })).toMatchObject({ kind: "plan", data: { steps: ["uno", "due"] } });
    expect(eventFromWire({ agentId: "a", agentName: "B", result: { title: "T", summary: "fatto" } })).toMatchObject({ kind: "result" });
    expect(eventFromWire({ agentId: "a", agentName: "B", level: "ERROR", message: "Quota finita", detail: "429", status: "blocked" })).toMatchObject({
      kind: "log",
      level: "ERROR",
      data: { detail: "429", status: "blocked" },
    });
    expect(eventFromWire({ agentId: "a", agentName: "B", activity: "read" })).toBeNull();
    expect(eventFromWire({ agentId: "a", agentName: "B", status: "review" })).toMatchObject({ kind: "status", message: "review" });
  });

  it("primo messaggio con il contesto del server", () => {
    expect(firstUserMessage("T")).toBe("Task: T");
    expect(firstUserMessage("T", "  ")).toBe("Task: T");
    expect(firstUserMessage("T", "Commenti: x")).toBe("Task: T\n\nCommenti: x");
  });
});

describe("task — storia per tentativo", () => {
  it("registra gli eventi in ordine, con l'id del task e lo stato", async () => {
    const db = await openDb(":memory:");
    const t = await createTask(db, base);
    const rec = await startAttempt(db, t.id, "feat/login");
    const sent: WireEvent[] = [];
    const emit = rec.wrap((e) => sent.push(e));
    emit({ agentId: "a", agentName: "Blue", plan: ["leggi", "correggi"] });
    emit({ agentId: "a", agentName: "Blue", level: "INFO", message: "read src/login.ts" });
    emit({ agentId: "a", agentName: "Blue", activity: "write" });
    emit({ agentId: "a", agentName: "Blue", status: "review", level: "SUCCESS", message: "Pronto per la revisione" });
    rec.note("end", "INFO", "Fine del tentativo 1");
    await rec.flush();
    expect(sent.every((e) => e.taskId === t.id)).toBe(true);
    const ev = await listEvents(db, t.id);
    expect(ev.map((e) => e.kind)).toEqual(["attempt", "plan", "log", "log", "end"]);
    expect(ev.every((e) => e.attempt === 1)).toBe(true);
    expect(await getTask(db, t.id)).toMatchObject({ status: "review", attempts: 1, branch: "feat/login" });
  });

  it("i commenti arrivano al tentativo dopo, una volta sola", async () => {
    const db = await openDb(":memory:");
    const t = await createTask(db, base);
    const r1 = await startAttempt(db, t.id, "");
    expect(r1.comments).toBe("");
    await addComment(db, t.id, "Anna (editor)", "Usa la libreria già presente, non aggiungerne");
    const r2 = await startAttempt(db, t.id, "");
    expect(r2.attempt).toBe(2);
    expect(r2.comments).toContain("Anna (editor): Usa la libreria già presente");
    expect((await listComments(db, t.id))[0].deliveredAttempt).toBe(2);
    expect(await takeCommentsForAttempt(db, t.id, 3)).toBe("");
    expect(commentsPrompt([])).toBe("");
  });

  it(`tetto di ${MAX_EVENTS_PER_TASK} eventi per task (gli inizi dei tentativi restano)`, async () => {
    const db = await openDb(":memory:");
    const t = await createTask(db, base);
    const rec = await startAttempt(db, t.id, "");
    const emit = rec.wrap(() => {});
    for (let i = 0; i < MAX_EVENTS_PER_TASK + 100; i++) emit({ agentId: "a", agentName: "Blue", message: `passo ${i}` });
    await rec.flush();
    const ev = await listEvents(db, t.id);
    expect(ev.length).toBeLessThanOrEqual(MAX_EVENTS_PER_TASK + 26);
    expect(ev[0].kind).toBe("attempt");
    expect(ev.at(-1)?.message).toBe(`passo ${MAX_EVENTS_PER_TASK + 99}`);
  });
});

describe("task — 30 giorni, poi si cancella", () => {
  it("pota i task fermi da più di 30 giorni con eventi e commenti", async () => {
    const db = await openDb(":memory:");
    const old = await createTask(db, base, 1000);
    await addComment(db, old.id, "Carlo", "vecchio", 1000);
    const fresh = await createTask(db, base, TASK_RETENTION_MS);
    expect(await pruneOldTasks(db, TASK_RETENTION_MS + 2000)).toBe(1);
    expect(await getTask(db, old.id)).toBeNull();
    expect(await listComments(db, old.id)).toEqual([]);
    expect((await listTasks(db)).map((t) => t.id)).toEqual([fresh.id]);
  });

  it("esportazione con la data di scadenza", async () => {
    const db = await openDb(":memory:");
    const t = await createTask(db, base, 5000);
    const x = await exportTask(db, t.id);
    expect(x?.expiresAt).toBe(5000 + TASK_RETENTION_MS);
    expect(await exportTask(db, "t-00000000-0000-0000-0000-000000000000")).toBeNull();
  });
});
