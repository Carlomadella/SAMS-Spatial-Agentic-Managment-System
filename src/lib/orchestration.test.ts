import { describe, expect, it } from "vitest";
import { canStartQueued, composeRelayTitle, enqueueOrdered, findRelayTarget, isIdleEligible, pickFreeAgent, planStepsDone, shouldAutoStartQueue } from "./orchestration";
import type { Agent } from "../types";

function mkAgent(over: Partial<Agent> & { id: string }): Agent {
  return {
    name: over.id,
    color: "blue",
    model: "x",
    role: "Generalist",
    instructions: "",
    status: "idle",
    position: [0, 0],
    target: null,
    task: null,
    taskQueue: [],
    ...over,
  } as Agent;
}

describe("findRelayTarget", () => {
  const agents = [
    mkAgent({ id: "a", name: "blue-agent", role: "Generalist" }),
    mkAgent({ id: "b", name: "green-agent", role: "Tester" }),
    mkAgent({ id: "c", name: "red-reviewer", role: "Revisore" }),
  ];

  it("matches by exact role (case-insensitive)", () => {
    expect(findRelayTarget(agents, "tester")?.id).toBe("b");
    expect(findRelayTarget(agents, "REVISORE")?.id).toBe("c");
  });

  it("falls back to a name substring match", () => {
    expect(findRelayTarget(agents, "reviewer")?.id).toBe("c");
    expect(findRelayTarget(agents, "blue")?.id).toBe("a");
  });

  it("returns undefined for a blank target (does not match everyone)", () => {
    expect(findRelayTarget(agents, "")).toBeUndefined();
    expect(findRelayTarget(agents, "   ")).toBeUndefined();
  });

  it("returns undefined when nothing matches", () => {
    expect(findRelayTarget(agents, "architetto")).toBeUndefined();
  });

  // Collaudo 17/11: con due Generalist il relay andava sempre al primo in elenco,
  // anche se occupato, invece che a quello libero.
  it("prefers a free agent among those with the requested role", () => {
    const team = [
      mkAgent({ id: "busy", role: "Generalist", status: "working", task: { title: "t", branch: "b", progress: 10 } }),
      mkAgent({ id: "queued", role: "Generalist", taskQueue: [{ title: "q", branch: "b" }] }),
      mkAgent({ id: "free", role: "Generalist" }),
    ];
    expect(findRelayTarget(team, "Generalist")?.id).toBe("free");
  });

  it("falls back to the first role match when nobody with that role is free", () => {
    const team = [
      mkAgent({ id: "busy1", role: "Tester", status: "working", task: { title: "t", branch: "b", progress: 10 } }),
      mkAgent({ id: "busy2", role: "Tester", status: "working", task: { title: "t", branch: "b", progress: 10 } }),
    ];
    expect(findRelayTarget(team, "tester")?.id).toBe("busy1");
  });

  it("never relays back to the sender", () => {
    const team = [mkAgent({ id: "me", role: "Generalist" }), mkAgent({ id: "other", role: "Generalist", status: "working" })];
    expect(findRelayTarget(team, "Generalist", "me")?.id).toBe("other");
    expect(findRelayTarget([mkAgent({ id: "me", role: "Generalist" })], "Generalist", "me")).toBeUndefined();
  });
});

describe("composeRelayTitle", () => {
  it("returns the bare title when there is no context", () => {
    expect(composeRelayTitle({ title: "Fix bug", context: "", fromName: "blue" })).toBe("Fix bug");
  });

  it("folds in the sender and a capped context", () => {
    const out = composeRelayTitle({ title: "Review", context: "x".repeat(200), fromName: "blue" });
    expect(out).toContain("Review [da blue:");
    expect(out.length).toBeLessThan("Review [da blue: ".length + 90);
  });
});

describe("isIdleEligible", () => {
  it("is true only when idle with no task and empty queue", () => {
    expect(isIdleEligible({ status: "idle", task: null, taskQueue: [] })).toBe(true);
  });
  it("is false when working, tasked, or with a queue", () => {
    expect(isIdleEligible({ status: "working", task: null, taskQueue: [] })).toBe(false);
    expect(isIdleEligible({ status: "idle", task: { title: "t", branch: "b", progress: 0 }, taskQueue: [] })).toBe(false);
    expect(isIdleEligible({ status: "idle", task: null, taskQueue: [{ title: "q", branch: "b" }] })).toBe(false);
  });
});

describe("canStartQueued / shouldAutoStartQueue", () => {
  const queued = { status: "idle" as const, task: null, taskQueue: [{ title: "q", branch: "b" }] };

  it("canStartQueued requires idle, no task, and a non-empty queue", () => {
    expect(canStartQueued(queued)).toBe(true);
    expect(canStartQueued({ ...queued, taskQueue: [] })).toBe(false);
    expect(canStartQueued({ ...queued, status: "working" })).toBe(false);
  });

  it("shouldAutoStartQueue fires only on the transition into idle", () => {
    expect(shouldAutoStartQueue(queued, { status: "working" })).toBe(true);
    expect(shouldAutoStartQueue(queued, { status: "idle" })).toBe(false); // already idle → no re-fire
    expect(shouldAutoStartQueue(queued, undefined)).toBe(true);
  });
});

describe("pickFreeAgent", () => {
  it("returns undefined with no agents", () => {
    expect(pickFreeAgent([])).toBeUndefined();
  });

  it("prefers a free agent, the most rested one", () => {
    const agents = [
      mkAgent({ id: "busy", status: "working", task: { title: "t", branch: "b", progress: 10 }, energy: 100 }),
      mkAgent({ id: "free-low", status: "idle", energy: 40 }),
      mkAgent({ id: "free-high", status: "idle", energy: 90 }),
    ];
    expect(pickFreeAgent(agents)?.id).toBe("free-high");
  });

  it("falls back to the least-loaded agent when none are free", () => {
    const agents = [
      mkAgent({ id: "two", status: "working", task: { title: "t", branch: "b", progress: 0 }, taskQueue: [{ title: "q", branch: "b" }] }),
      mkAgent({ id: "one", status: "working", task: { title: "t", branch: "b", progress: 0 }, taskQueue: [] }),
    ];
    expect(pickFreeAgent(agents)?.id).toBe("one");
  });
});

describe("enqueueOrdered", () => {
  const t = (title: string, urgent = false) => ({ title, branch: "b", urgent });

  it("appends a normal task at the end", () => {
    const q = [t("a"), t("b")];
    expect(enqueueOrdered(q, t("c")).map((x) => x.title)).toEqual(["a", "b", "c"]);
  });

  it("puts an urgent task ahead of normal ones", () => {
    const q = [t("a"), t("b")];
    expect(enqueueOrdered(q, t("urg", true)).map((x) => x.title)).toEqual(["urg", "a", "b"]);
  });

  it("keeps urgents in FIFO among themselves", () => {
    let q = [t("normal")];
    q = enqueueOrdered(q, t("u1", true));
    q = enqueueOrdered(q, t("u2", true));
    expect(q.map((x) => x.title)).toEqual(["u1", "u2", "normal"]);
  });

  it("does not mutate the input array", () => {
    const q = [t("a")];
    enqueueOrdered(q, t("u", true));
    expect(q.map((x) => x.title)).toEqual(["a"]);
  });
});

// Collaudo 2026-11-19: a task finito (avanzamento 100%, stato "In revisione") il
// piano diceva ancora "0/6 completati", perché i passi si spuntano solo a mano.
describe("planStepsDone", () => {
  it("a lavoro in corso conta solo i passi spuntati a mano", () => {
    expect([...planStepsDone(4, new Set([1]), "working", 40)]).toEqual([1]);
  });
  it("a lavoro finito (review/done o 100%) tutti i passi sono completati", () => {
    expect([...planStepsDone(3, new Set(), "review", 100)]).toEqual([0, 1, 2]);
    expect([...planStepsDone(3, new Set(), "done", 90)]).toEqual([0, 1, 2]);
    expect([...planStepsDone(2, new Set(), "awaiting_approval", 100)]).toEqual([0, 1]);
  });
  it("un task bloccato non segna i passi come fatti", () => {
    expect(planStepsDone(3, new Set(), "blocked", 45).size).toBe(0);
  });
});

// Collaudo sim-prenota-sale (17 e 19/11): Sim-Architetto chiedeva "un Generalist" e il
// relay sceglieva red-agent (primo libero in elenco) invece di Sim-Dev. Scelta
// dell'utente (19/11): un campo «Squadra»; il relay preferisce la squadra del mittente.
describe("findRelayTarget e la squadra", () => {
  const sender = mkAgent({ id: "arch", name: "Sim-Architetto", role: "Architetto", squad: "Simulazione" });
  const red = mkAgent({ id: "red", name: "red-agent", role: "Generalist" });
  const simDev = mkAgent({ id: "dev", name: "Sim-Dev", role: "Generalist", squad: "Simulazione" });

  it("preferisce un agente libero della stessa squadra del mittente", () => {
    expect(findRelayTarget([sender, red, simDev], "Generalist", "arch")?.id).toBe("dev");
  });

  it("la squadra si confronta senza badare a maiuscole e spazi", () => {
    const dev2 = { ...simDev, squad: " simulazione " };
    expect(findRelayTarget([sender, red, dev2], "Generalist", "arch")?.id).toBe("dev");
  });

  it("se il compagno di squadra è occupato, meglio un libero di un'altra squadra", () => {
    const busy = { ...simDev, status: "working" as const, task: { title: "x", branch: "", progress: 10 } };
    expect(findRelayTarget([sender, red, busy], "Generalist", "arch")?.id).toBe("red");
  });

  it("se sono tutti occupati, resta in squadra (andrà in coda al compagno)", () => {
    const t = { title: "x", branch: "", progress: 10 };
    const busyRed = { ...red, status: "working" as const, task: t };
    const busyDev = { ...simDev, status: "working" as const, task: t };
    expect(findRelayTarget([sender, busyRed, busyDev], "Generalist", "arch")?.id).toBe("dev");
  });

  it("un mittente senza squadra si comporta come prima (primo libero)", () => {
    const noSquad = { ...sender, squad: undefined };
    expect(findRelayTarget([noSquad, red, simDev], "Generalist", "arch")?.id).toBe("red");
  });
});
