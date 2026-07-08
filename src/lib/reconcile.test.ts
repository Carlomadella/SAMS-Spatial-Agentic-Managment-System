import { describe, expect, it } from "vitest";
import { compareVersion, nextBase, reconcileAgents, type RemoteWorldAgent } from "./reconcile";
import type { Agent } from "../types";

function mk(id: string, over: Partial<Agent> = {}): Agent {
  return {
    id,
    name: id,
    color: "blue",
    model: "",
    role: "",
    instructions: "",
    status: "idle",
    position: [0, 0],
    target: null,
    task: null,
    taskQueue: [],
    energy: 100,
    hunger: 0,
    mood: "happy",
    xp: 0,
    ...over,
  };
}

describe("compareVersion", () => {
  it("behind quando il server è avanti", () => {
    expect(compareVersion(3, 5)).toBe("behind");
    expect(compareVersion(0, 1)).toBe("behind");
  });
  it("ahead quando il client ha una base più alta", () => {
    expect(compareVersion(5, 3)).toBe("ahead");
  });
  it("in-sync a pari versione", () => {
    expect(compareVersion(4, 4)).toBe("in-sync");
    expect(compareVersion(0, 0)).toBe("in-sync");
  });
});

describe("nextBase", () => {
  it("adotta la versione del server dopo un push andato a buon fine", () => {
    expect(nextBase(4, 5)).toBe(5);
  });
  it("si allinea alla versione remota più alta dopo un conflitto (409)", () => {
    expect(nextBase(4, 7)).toBe(7);
  });
  it("non indietreggia mai (monotòna)", () => {
    expect(nextBase(9, 4)).toBe(9);
    expect(nextBase(5, 5)).toBe(5);
  });
});

describe("reconcileAgents", () => {
  const remote = (over: Partial<RemoteWorldAgent> & { id: string }): RemoteWorldAgent => ({
    status: "idle",
    task: null,
    progress: 0,
    ...over,
  });

  it("ritorna lo stesso array quando lo snapshot remoto è vuoto", () => {
    const local = [mk("a")];
    expect(reconcileAgents(local, [])).toBe(local);
  });

  it("adotta status e task del server su un agente locale idle", () => {
    const local = [mk("a")];
    const next = reconcileAgents(local, [remote({ id: "a", status: "working", task: "Fix CI", progress: 40 })]);
    expect(next).not.toBe(local);
    expect(next[0].status).toBe("working");
    expect(next[0].task).toEqual({ title: "Fix CI", branch: "", progress: 40 });
  });

  it("preserva branch e plan locali quando il titolo del task coincide", () => {
    const local = [mk("a", { status: "working", task: { title: "Fix CI", branch: "ci-fix", progress: 10, plan: ["step"] } })];
    const next = reconcileAgents(local, [remote({ id: "a", status: "working", task: "Fix CI", progress: 55 })]);
    expect(next[0].task).toEqual({ title: "Fix CI", branch: "ci-fix", progress: 55, plan: ["step"] });
  });

  it("azzera il task quando il server dice che l'agente è senza task", () => {
    const local = [mk("a", { status: "working", task: { title: "X", branch: "", progress: 30 } })];
    const next = reconcileAgents(local, [remote({ id: "a", status: "idle", task: null })]);
    expect(next[0].task).toBeNull();
    expect(next[0].status).toBe("idle");
  });

  it("non tocca agenti assenti dallo snapshot, né crea agenti nuovi", () => {
    const local = [mk("a"), mk("b", { status: "working" })];
    const next = reconcileAgents(local, [remote({ id: "a", status: "review", task: "R", progress: 100 }), remote({ id: "z", status: "working" })]);
    expect(next[1]).toBe(local[1]); // b invariato (stesso riferimento)
    expect(next.find((x) => x.id === "z")).toBeUndefined(); // z non creato
    expect(next[0].status).toBe("review");
  });

  it("ignora uno status remoto non valido, mantenendo quello locale", () => {
    const local = [mk("a", { status: "working" })];
    const next = reconcileAgents(local, [remote({ id: "a", status: "bogus", task: null })]);
    expect(next[0].status).toBe("working");
  });

  it("ritorna lo stesso array quando nulla cambia (no-op)", () => {
    const local = [mk("a", { status: "working", task: { title: "T", branch: "", progress: 20 } })];
    const next = reconcileAgents(local, [remote({ id: "a", status: "working", task: "T", progress: 20 })]);
    expect(next).toBe(local);
  });
});
