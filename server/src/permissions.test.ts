import { afterEach, describe, expect, it, vi } from "vitest";
import { openDb } from "./db";
import {
  answerPermission,
  askPermission,
  cancelPermission,
  defaultPermissions,
  describeCall,
  filterOffTools,
  groupOfTool,
  loadPermissions,
  noteLiveMode,
  pendingPermission,
  resetLiveModes,
  permissionRows,
  setPermission,
  type PermissionRequest,
} from "./permissions";
import { permissionGate, type ToolContext } from "./agentTools";
import { beginRun, endRun, requestCancel, TaskCancelledError } from "./taskRuns";

const req = (agentId = "a", id = "r1"): PermissionRequest => ({ id, agentId, agentName: "Blue", group: "read", groupLabel: "Leggere", tool: "gh_read_file", detail: "gh_read_file: x.ts", since: 1 });

afterEach(() => {
  cancelPermission("a");
  resetLiveModes();
  vi.useRealTimers();
});

describe("permessi — regole", () => {
  it("default: «Chiedi prima» su tutti i sette gruppi", () => {
    const p = defaultPermissions();
    expect(Object.keys(p)).toHaveLength(7);
    expect(Object.values(p).every((m) => m === "ask")).toBe(true);
  });

  it("ogni strumento esterno ha un gruppo, quelli interni no", () => {
    expect(groupOfTool("gh_read_file")).toBe("read");
    expect(groupOfTool("gh_write_files")).toBe("write");
    expect(groupOfTool("gh_merge_pr")).toBe("pr");
    expect(groupOfTool("gh_trigger_workflow")).toBe("workflow");
    expect(groupOfTool("web_fetch")).toBe("web");
    expect(groupOfTool("notion_write")).toBe("notion");
    expect(groupOfTool("mcp_call")).toBe("mcp");
    for (const t of ["done", "announce_plan", "remember", "recall", "relay_task"]) expect(groupOfTool(t)).toBeNull();
  });

  it("i gruppi spenti spariscono dagli strumenti offerti", () => {
    const specs = [{ name: "gh_read_file" }, { name: "web_fetch" }, { name: "done" }];
    const perms = { ...defaultPermissions(), web: "off" as const };
    expect(filterOffTools(specs, perms).map((s) => s.name)).toEqual(["gh_read_file", "done"]);
    expect(filterOffTools(specs, undefined)).toHaveLength(3);
  });

  it("mostra lo strumento con tutti gli argomenti, accorciati", () => {
    expect(describeCall("gh_read_file", { path: "src/a.ts" })).toBe('gh_read_file {"path":"src/a.ts"}');
    // un campo "innocuo" non può nascondere quello che conta davvero
    expect(describeCall("mcp_call", { title: "leggi il README", server: "s", tool: "delete_all" })).toContain('"tool":"delete_all"');
    const long = describeCall("gh_write_file", { path: "a.ts", content: "x".repeat(5000) });
    expect(long.length).toBeLessThanOrEqual(800);
    expect(long).toContain('"path":"a.ts"');
  });
});

describe("permessi — database", () => {
  it("salva la scelta e chi l'ha fatta; il resto resta al default", async () => {
    const db = await openDb(":memory:");
    await setPermission(db, "a", "read", "allow", "Carlo (owner)", 5);
    await setPermission(db, "a", "web", "off", "Anna (editor)", 6);
    const p = await loadPermissions(db, "a");
    expect(p.read).toBe("allow");
    expect(p.web).toBe("off");
    expect(p.write).toBe("ask");
    const rows = await permissionRows(db, "a");
    expect(rows.find((r) => r.group === "web")).toMatchObject({ mode: "off", updatedBy: "Anna (editor)", updatedAt: 6 });
    await setPermission(db, "a", "web", "allow", "Carlo (owner)", 7);
    expect((await loadPermissions(db, "a")).web).toBe("allow");
  });
});

describe("permessi — richieste in attesa", () => {
  it("la risposta di una persona sblocca l'agente", async () => {
    const p = askPermission(req());
    expect(pendingPermission("a")?.tool).toBe("gh_read_file");
    expect(answerPermission("a", "r1", "once")?.group).toBe("read");
    await expect(p).resolves.toBe("once");
    expect(pendingPermission("a")).toBeNull();
    expect(answerPermission("a", "r1", "once")).toBeNull();
  });

  it("la risposta vale solo per la richiesta vista, non per una arrivata dopo", async () => {
    void askPermission(req("a", "vecchia"));
    const p = askPermission({ ...req("a", "nuova"), group: "pr", tool: "gh_merge_pr" });
    expect(answerPermission("a", "vecchia", "always")).toBeNull();
    expect(pendingPermission("a")?.id).toBe("nuova");
    expect(answerPermission("a", "nuova", "deny")?.tool).toBe("gh_merge_pr");
    await expect(p).resolves.toBe("deny");
  });

  it("senza risposta scade", async () => {
    vi.useFakeTimers();
    const p = askPermission(req(), 1000);
    vi.advanceTimersByTime(1001);
    await expect(p).resolves.toBe("timeout");
  });
});

const ctx = (perms: ToolContext["perms"]): ToolContext & { events: unknown[] } => {
  const events: unknown[] = [];
  return {
    s: {} as ToolContext["s"], agentId: "a", agentName: "Blue", title: "t", branch: "b", requireApproval: false,
    emit: (e) => events.push(e), wroteFiles: false, notionWrote: false, branchReady: false, doneSummary: "",
    finished: false, progress: 0, stagedFiles: [], perms, events,
  };
};

describe("permissionGate", () => {
  it("consentito o senza permessi: si procede", async () => {
    expect(await permissionGate("gh_read_file", {}, ctx({ ...defaultPermissions(), read: "allow" }))).toBeNull();
    expect(await permissionGate("gh_read_file", {}, ctx(undefined))).toBeNull();
    expect(await permissionGate("done", {}, ctx(defaultPermissions()))).toBeNull();
  });

  it("un gruppo spento a task in corso vale subito", async () => {
    noteLiveMode("a", "read", "off");
    expect(await permissionGate("gh_read_file", {}, ctx({ ...defaultPermissions(), read: "allow" }))).toMatch(/spento/);
  });

  it("spento: rifiutato senza chiedere", async () => {
    const r = await permissionGate("web_fetch", { url: "x" }, ctx({ ...defaultPermissions(), web: "off" }));
    expect(r).toMatch(/spento/);
    expect(pendingPermission("a")).toBeNull();
  });

  it("chiedi prima → «Approva sempre» rende il gruppo consentito per il resto del task", async () => {
    const c = ctx(defaultPermissions());
    const p = permissionGate("gh_read_file", { path: "x.ts" }, c);
    await Promise.resolve();
    expect(pendingPermission("a")?.detail).toBe('gh_read_file {"path":"x.ts"}');
    expect(c.events).toContainEqual(expect.objectContaining({ permissionRequest: expect.objectContaining({ group: "read" }) }));
    answerPermission("a", pendingPermission("a")!.id, "always");
    expect(await p).toBeNull();
    expect(c.perms?.read).toBe("allow");
    expect(c.events).toContainEqual(expect.objectContaining({ permissionRequest: null }));
  });

  it("chiedi prima → negato: l'azione non parte", async () => {
    const c = ctx(defaultPermissions());
    const p = permissionGate("gh_merge_pr", { pr_number: 3 }, c);
    await Promise.resolve();
    answerPermission("a", pendingPermission("a")!.id, "deny");
    expect(await p).toMatch(/non concesso/);
    expect(c.perms?.pr).toBe("ask");
  });

  it("task annullato mentre aspetta: il ciclo si ferma", async () => {
    beginRun("a", "t");
    const p = permissionGate("gh_read_file", {}, ctx(defaultPermissions()));
    await Promise.resolve();
    requestCancel("a", "Carlo");
    cancelPermission("a");
    await expect(p).rejects.toBeInstanceOf(TaskCancelledError);
    endRun("a");
  });
});
