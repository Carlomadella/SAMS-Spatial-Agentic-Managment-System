import { describe, expect, it } from "vitest";
import { compareVersion, nextBase, reconcileAgents, scatterPosition, type RemoteWorldAgent } from "./reconcile";
import { ROOM } from "../data/world";
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

  it("preserva un agente locale assente dallo snapshot (non lo rimuove ancora)", () => {
    const local = [mk("a"), mk("b", { status: "working" })];
    // il remoto non nomina "b": non deve essere rimosso (delete rimandato al versioning per-agente)
    const next = reconcileAgents(local, [remote({ id: "a", status: "review", task: "R", progress: 100 })]);
    expect(next[1]).toBe(local[1]); // b invariato (stesso riferimento)
    expect(next[0].status).toBe("review");
  });

  it("crea un agente presente solo nel remoto (scheletro condiviso), adottandone l'identità", () => {
    const local = [mk("a")];
    const next = reconcileAgents(local, [
      remote({ id: "a", status: "working" }),
      remote({ id: "z", status: "working", task: "Deploy", progress: 30, name: "Nova", color: "orange", role: "Ops" }),
    ]);
    const z = next.find((x) => x.id === "z");
    expect(z).toBeDefined();
    expect(z).toMatchObject({ id: "z", name: "Nova", color: "orange", role: "Ops", status: "working" });
    expect(z!.task).toEqual({ title: "Deploy", branch: "", progress: 30 });
    expect(next).toHaveLength(2);
  });

  it("materializza con default sicuri quando mancano identità/colore non validi", () => {
    const next = reconcileAgents([], [remote({ id: "z", status: "bogus", task: null, color: "not-a-color" })]);
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ id: "z", name: "Agente", role: "Generalist", status: "idle", color: "blue" });
    expect(next[0].task).toBeNull();
  });

  it("crea gli agenti remoti anche partendo da uno store locale vuoto", () => {
    const next = reconcileAgents([], [remote({ id: "a", name: "A" }), remote({ id: "b", name: "B" })]);
    expect(next.map((x) => x.id)).toEqual(["a", "b"]);
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

  it("gli agenti materializzati non si impilano sulla stessa posizione", () => {
    const next = reconcileAgents([], [remote({ id: "alpha" }), remote({ id: "beta" }), remote({ id: "gamma" })]);
    const keys = next.map((a) => `${a.position[0].toFixed(2)},${a.position[1].toFixed(2)}`);
    expect(new Set(keys).size).toBe(3); // tre posizioni distinte
  });
});

describe("scatterPosition", () => {
  it("è deterministica per lo stesso id", () => {
    expect(scatterPosition("nova")).toEqual(scatterPosition("nova"));
  });

  it("resta dentro le mura della stanza", () => {
    for (const id of ["a", "nova", "zzz-9", "una-stringa-lunga", "42"]) {
      const [x, z] = scatterPosition(id);
      expect(x).toBeGreaterThanOrEqual(ROOM.minX);
      expect(x).toBeLessThanOrEqual(ROOM.maxX);
      expect(z).toBeGreaterThanOrEqual(ROOM.minZ);
      expect(z).toBeLessThanOrEqual(ROOM.maxZ);
    }
  });
});
