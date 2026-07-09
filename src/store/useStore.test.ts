import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "./useStore";
import { SEED_AGENTS } from "../data/seed";

// Reset to a clean, deterministic baseline before each test (without wiping the
// action functions, which a full replace would do).
beforeEach(() => {
  localStorage.clear();
  useStore.setState({
    agents: SEED_AGENTS.map((a) => ({
      ...a,
      status: "idle",
      task: null,
      taskQueue: [],
      target: null,
      pendingFiles: undefined,
      energy: 100,
      mood: "happy" as const,
    })),
    events: [],
    tasks: [],
    tokensUsed: 0,
    pendingRelays: [],
    toasts: [],
    selectedAgentId: null,
  });
});

const firstId = () => useStore.getState().agents[0].id;
const agent = (id: string) => useStore.getState().agents.find((a) => a.id === id);

describe("assignTask", () => {
  it("sets the task, marks the agent working and records it", () => {
    const id = firstId();
    useStore.getState().assignTask(id, "Fix login", "feature/login");
    const a = agent(id)!;
    expect(a.status).toBe("working");
    expect(a.task).toMatchObject({ title: "Fix login", branch: "feature/login", progress: 0 });
    const rec = useStore.getState().tasks.at(-1)!;
    expect(rec).toMatchObject({ agentId: id, title: "Fix login", status: "working" });
  });

  it("defaults an empty branch to main", () => {
    const id = firstId();
    useStore.getState().assignTask(id, "Task", "");
    expect(agent(id)!.task!.branch).toBe("main");
  });
});

describe("preset ruolo/modello per-agente", () => {
  it("saveAgentPreset cattura ruolo/modello/istruzioni correnti dell'agente", () => {
    useStore.setState({ agentPresets: [] });
    const id = firstId();
    useStore.getState().setRole(id, "Tester");
    useStore.getState().setInstructions(id, "solo test");
    useStore.getState().saveAgentPreset(id, "Il mio tester");
    const presets = useStore.getState().agentPresets;
    expect(presets).toHaveLength(1);
    expect(presets[0]).toMatchObject({ name: "Il mio tester", role: "Tester", instructions: "solo test" });
  });

  it("applyTemplate su un preset riporta la configurazione su un altro agente", () => {
    useStore.setState({ agentPresets: [] });
    const [a, b] = useStore.getState().agents;
    useStore.getState().setRole(a.id, "Revisore");
    useStore.getState().setInstructions(a.id, "leggi le PR");
    useStore.getState().saveAgentPreset(a.id, "Rev");
    const preset = useStore.getState().agentPresets[0];
    useStore.getState().applyTemplate(b.id, preset);
    expect(agent(b.id)).toMatchObject({ role: "Revisore", instructions: "leggi le PR" });
  });

  it("removeAgentPreset elimina il preset per id", () => {
    useStore.setState({ agentPresets: [] });
    const id = firstId();
    useStore.getState().saveAgentPreset(id, "Uno");
    useStore.getState().saveAgentPreset(id, "Due");
    const first = useStore.getState().agentPresets[0];
    useStore.getState().removeAgentPreset(first.id);
    expect(useStore.getState().agentPresets.some((p) => p.id === first.id)).toBe(false);
  });
});

describe("protocolli di collaborazione (playbook)", () => {
  beforeEach(() => useStore.setState({ playbooks: [], playbookRuns: [] }));

  it("addPlaybook ripulisce e scarta gli stadi non validi", () => {
    useStore.getState().addPlaybook({
      name: "  Rilascio  ",
      goal: "auth",
      branch: "",
      stages: [
        { role: "dev", title: "Implementa {goal}" },
        { role: "", title: "buco" },
      ],
    });
    const pbs = useStore.getState().playbooks;
    expect(pbs).toHaveLength(1);
    expect(pbs[0]).toMatchObject({ name: "Rilascio", stages: [{ role: "dev", title: "Implementa {goal}" }] });
    expect(pbs[0].id).toBeTruthy();
  });

  it("addPlaybook ignora un protocollo senza stadi validi", () => {
    useStore.getState().addPlaybook({ name: "Vuoto", goal: "", branch: "", stages: [] });
    expect(useStore.getState().playbooks).toHaveLength(0);
  });

  it("startPlaybook crea una run al primo stadio e la restituisce", () => {
    useStore.getState().addPlaybook({ name: "P", goal: "x", branch: "", stages: [{ role: "dev", title: "a" }, { role: "qa", title: "b" }] });
    const pbId = useStore.getState().playbooks[0].id;
    const run = useStore.getState().startPlaybook(pbId);
    expect(run).not.toBeNull();
    expect(run!.stageIndex).toBe(0);
    expect(useStore.getState().playbookRuns).toHaveLength(1);
  });

  it("startPlaybook su un id inesistente non crea nulla", () => {
    expect(useStore.getState().startPlaybook("ghost")).toBeNull();
    expect(useStore.getState().playbookRuns).toHaveLength(0);
  });

  it("advancePlaybookRun avanza gli stadi e conclude dopo l'ultimo", () => {
    useStore.getState().addPlaybook({ name: "P", goal: "x", branch: "", stages: [{ role: "dev", title: "a" }, { role: "qa", title: "b" }] });
    const run = useStore.getState().startPlaybook(useStore.getState().playbooks[0].id)!;
    useStore.getState().advancePlaybookRun(run.id);
    expect(useStore.getState().playbookRuns[0].stageIndex).toBe(1);
    useStore.getState().advancePlaybookRun(run.id);
    expect(useStore.getState().playbookRuns[0].done).toBe(true);
  });

  it("removePlaybookRun scarta la run", () => {
    useStore.getState().addPlaybook({ name: "P", goal: "x", branch: "", stages: [{ role: "dev", title: "a" }] });
    const run = useStore.getState().startPlaybook(useStore.getState().playbooks[0].id)!;
    useStore.getState().removePlaybookRun(run.id);
    expect(useStore.getState().playbookRuns).toHaveLength(0);
  });
});

describe("world autorevole (adoptWorld / noteWorldVersion / evento world)", () => {
  beforeEach(() => useStore.setState({ serverWorldVersion: 0 }));

  it("adoptWorld adotta status e task del server sull'agente per id", () => {
    const id = firstId();
    useStore.getState().adoptWorld([{ id, status: "working", task: "Fix CI", progress: 30 }]);
    expect(agent(id)!.status).toBe("working");
    expect(agent(id)!.task).toEqual({ title: "Fix CI", branch: "", progress: 30 });
  });

  it("noteWorldVersion è monotòna (non indietreggia)", () => {
    useStore.getState().noteWorldVersion(5);
    expect(useStore.getState().serverWorldVersion).toBe(5);
    useStore.getState().noteWorldVersion(3);
    expect(useStore.getState().serverWorldVersion).toBe(5);
    useStore.getState().noteWorldVersion(8);
    expect(useStore.getState().serverWorldVersion).toBe(8);
  });

  it("l'evento SSE 'world' adotta lo snapshot e aggiorna la versione base", () => {
    const id = firstId();
    useStore.getState().applyRemote({
      agentId: "world",
      world: { agents: [{ id, status: "review", task: "R", progress: 100 }], version: 7, updatedAt: 1 },
    });
    expect(agent(id)!.status).toBe("review");
    expect(useStore.getState().serverWorldVersion).toBe(7);
    // Non deve aver creato eventi di log (non è un evento agente).
    expect(useStore.getState().events).toHaveLength(0);
  });

  it("adoptWorld crea un agente presente solo nello scheletro remoto (mondo condiviso)", () => {
    const before = useStore.getState().agents.length;
    const keep = firstId();
    useStore.getState().adoptWorld([
      { id: keep, status: "idle", task: null, progress: 0 },
      { id: "remote-nova", status: "working", task: "Deploy", progress: 20, name: "Nova", color: "orange", role: "Ops" },
    ]);
    expect(useStore.getState().agents).toHaveLength(before + 1);
    const nova = agent("remote-nova");
    expect(nova).toBeTruthy();
    expect(nova).toMatchObject({ name: "Nova", color: "orange", role: "Ops", status: "working" });
    expect(nova!.task).toEqual({ title: "Deploy", branch: "", progress: 20 });
  });
});

describe("updateProgress", () => {
  it("clamps to 0..100 and rounds", () => {
    const id = firstId();
    useStore.getState().assignTask(id, "T", "b");
    useStore.getState().updateProgress(id, 42.6);
    expect(agent(id)!.task!.progress).toBe(43);
    useStore.getState().updateProgress(id, 999);
    expect(agent(id)!.task!.progress).toBe(100);
  });

  it("marks the agent done when it reaches 100", () => {
    const id = firstId();
    useStore.getState().assignTask(id, "T", "b");
    useStore.getState().updateProgress(id, 100);
    expect(agent(id)!.status).toBe("done");
  });

  it("does nothing when the agent has no task", () => {
    const id = firstId();
    useStore.getState().updateProgress(id, 50);
    expect(agent(id)!.task).toBeNull();
  });
});

describe("task queue", () => {
  it("enqueues, shifts and removes by index", () => {
    const id = firstId();
    useStore.getState().enqueueTask(id, { title: "one", branch: "b1" });
    useStore.getState().enqueueTask(id, { title: "two", branch: "b2" });
    expect(agent(id)!.taskQueue).toHaveLength(2);

    useStore.getState().shiftQueue(id);
    expect(agent(id)!.taskQueue.map((t) => t.title)).toEqual(["two"]);

    useStore.getState().enqueueTask(id, { title: "three", branch: "b3" });
    useStore.getState().removeFromQueue(id, 0);
    expect(agent(id)!.taskQueue.map((t) => t.title)).toEqual(["three"]);
  });
});

describe("relay queue", () => {
  it("pushes and shifts pending relays FIFO", () => {
    const r = { target: "Tester", title: "t", branch: "b", context: "c", fromName: "x", fromId: "id" };
    useStore.getState().pushRelay(r);
    useStore.getState().pushRelay({ ...r, title: "t2" });
    expect(useStore.getState().pendingRelays).toHaveLength(2);
    useStore.getState().shiftRelay();
    expect(useStore.getState().pendingRelays.map((x) => x.title)).toEqual(["t2"]);
  });
});

describe("applyRemote", () => {
  it("updates status and progress on the matching agent", () => {
    const id = firstId();
    useStore.getState().assignTask(id, "T", "b");
    useStore.getState().applyRemote({ agentId: id, status: "review", progress: 80 });
    const a = agent(id)!;
    expect(a.status).toBe("review");
    expect(a.task!.progress).toBe(80);
  });

  it("synthesizes a task from progress when the agent has none", () => {
    const id = firstId();
    useStore.getState().applyRemote({ agentId: id, progress: 25, message: "Booting" });
    expect(agent(id)!.task).toMatchObject({ progress: 25, title: "Booting" });
  });

  it("applies a plan onto the (synthesized) task", () => {
    const id = firstId();
    useStore.getState().applyRemote({ agentId: id, progress: 10, plan: ["a", "b", "c"] });
    expect(agent(id)!.task!.plan).toEqual(["a", "b", "c"]);
  });

  it("keeps pendingFiles on awaiting_approval and clears them on a later status", () => {
    const id = firstId();
    const files = [{ path: "x.ts", content: "1", message: "m" }];
    useStore.getState().applyRemote({ agentId: id, status: "awaiting_approval", pendingFiles: files });
    expect(agent(id)!.pendingFiles).toEqual(files);
    useStore.getState().applyRemote({ agentId: id, status: "review" });
    expect(agent(id)!.pendingFiles).toBeUndefined();
  });

  it("appends an event when a message is present and accumulates tokens", () => {
    const id = firstId();
    useStore.getState().applyRemote({ agentId: id, message: "hello", tokens: 100 });
    useStore.getState().applyRemote({ agentId: id, message: "again", tokens: 50 });
    expect(useStore.getState().events.map((e) => e.message)).toEqual(["hello", "again"]);
    expect(useStore.getState().tokensUsed).toBe(150);
  });

  it("extracts a URL from the message into the latest task record", () => {
    const id = firstId();
    useStore.getState().assignTask(id, "T", "b");
    useStore.getState().applyRemote({ agentId: id, status: "review", message: "PR https://github.com/o/r/pull/9" });
    expect(useStore.getState().tasks.at(-1)!.url).toBe("https://github.com/o/r/pull/9");
  });

  it("queues a relay when relayTo is present", () => {
    const id = firstId();
    useStore.getState().applyRemote({
      agentId: id,
      relayTo: { target: "Revisore", title: "review it", branch: "b", context: "" },
    });
    expect(useStore.getState().pendingRelays.at(-1)).toMatchObject({ target: "Revisore", fromId: id });
  });

  it("ignores events for unknown agents but still logs the message", () => {
    useStore.getState().applyRemote({ agentId: "ghost", message: "orphan" });
    expect(useStore.getState().events.at(-1)!.message).toBe("orphan");
  });
});

describe("energy & mood", () => {
  it("new agent starts with full energy and happy mood", () => {
    const id = useStore.getState().addAgent("blue");
    const a = useStore.getState().agents.find((x) => x.id === id)!;
    expect(a.energy).toBe(100);
    expect(a.mood).toBe("happy");
  });

  it("updateProgress drains energy proportionally", () => {
    const id = firstId();
    useStore.getState().assignTask(id, "T", "b");
    // baseline energy is 100 (reset in beforeEach via SEED_AGENTS defaults)
    useStore.getState().updateProgress(id, 35); // drain floor(35/7) = 5
    expect(useStore.getState().agents.find((x) => x.id === id)!.energy).toBe(95);
  });

  it("clearTask restores some energy", () => {
    const id = firstId();
    useStore.getState().assignTask(id, "T", "b");
    useStore.getState().updateProgress(id, 70); // drain 10
    const before = useStore.getState().agents.find((x) => x.id === id)!.energy;
    useStore.getState().clearTask(id);
    const after = useStore.getState().agents.find((x) => x.id === id)!.energy;
    expect(after).toBeGreaterThan(before);
    expect(after).toBeLessThanOrEqual(100);
  });

  it("blocked status sets frustrated mood", () => {
    const id = firstId();
    useStore.getState().setStatus(id, "blocked");
    expect(useStore.getState().agents.find((x) => x.id === id)!.mood).toBe("frustrated");
  });

  it("review/done status sets proud mood", () => {
    const id = firstId();
    useStore.getState().setStatus(id, "review");
    expect(useStore.getState().agents.find((x) => x.id === id)!.mood).toBe("proud");
    useStore.getState().setStatus(id, "done");
    expect(useStore.getState().agents.find((x) => x.id === id)!.mood).toBe("proud");
  });

  it("idle status with high energy sets happy mood", () => {
    const id = firstId();
    // energy starts at 100 in test baseline
    useStore.getState().setStatus(id, "idle");
    expect(useStore.getState().agents.find((x) => x.id === id)!.mood).toBe("happy");
  });
});

describe("hunger", () => {
  const setHunger = (id: string, h: number) =>
    useStore.setState((s) => ({ agents: s.agents.map((a) => (a.id === id ? { ...a, hunger: h } : a)) }));

  it("growHunger raises every agent's hunger, capped at 100", () => {
    const id = firstId();
    setHunger(id, 99);
    useStore.getState().growHunger(5);
    expect(agent(id)!.hunger).toBe(100);
  });

  it("feedAgent lowers hunger, floored at 0", () => {
    const id = firstId();
    setHunger(id, 20);
    useStore.getState().feedAgent(id, 50);
    expect(agent(id)!.hunger).toBe(0);
  });

  it("assigning a task feeds the agent by 45", () => {
    const id = firstId();
    setHunger(id, 70);
    useStore.getState().assignTask(id, "Fix the bug", "feature/x");
    expect(agent(id)!.hunger).toBe(25);
  });

  it("a starving agent turns hungry even at full energy", () => {
    const id = firstId();
    setHunger(id, 85);
    useStore.getState().setStatus(id, "idle"); // energy 100 would normally be happy
    expect(agent(id)!.mood).toBe("hungry");
  });
});

describe("xp / level", () => {
  it("completing a task grants XP", () => {
    const id = firstId();
    useStore.setState((s) => ({ agents: s.agents.map((a) => (a.id === id ? { ...a, xp: 0 } : a)) }));
    useStore.getState().assignTask(id, "Build a thing", "feature/x");
    const before = agent(id)!.xp;
    useStore.getState().updateProgress(id, 100);
    expect(agent(id)!.xp).toBe(before + 30);
  });

  it("partial progress does not grant XP", () => {
    const id = firstId();
    useStore.getState().assignTask(id, "Build", "b");
    const before = agent(id)!.xp;
    useStore.getState().updateProgress(id, 60);
    expect(agent(id)!.xp).toBe(before);
  });

  it("addAgent starts at 0 XP (level 1)", () => {
    const id = useStore.getState().addAgent("blue");
    expect(agent(id)!.xp).toBe(0);
  });
});

describe("agent lifecycle", () => {
  it("addAgent appends a uniquely-named agent and selects it", () => {
    const before = useStore.getState().agents.length;
    const id = useStore.getState().addAgent("blue");
    expect(useStore.getState().agents).toHaveLength(before + 1);
    expect(useStore.getState().selectedAgentId).toBe(id);
    const names = useStore.getState().agents.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length); // all unique
  });

  it("removeAgent deselects when the removed agent was selected", () => {
    const id = useStore.getState().addAgent("red");
    useStore.getState().selectAgent(id);
    useStore.getState().removeAgent(id);
    expect(useStore.getState().selectedAgentId).toBeNull();
    expect(agent(id)).toBeUndefined();
  });

  it("clearTask resets the task and returns the agent to idle", () => {
    const id = firstId();
    useStore.getState().assignTask(id, "T", "b");
    useStore.getState().clearTask(id);
    const a = agent(id)!;
    expect(a.task).toBeNull();
    expect(a.status).toBe("idle");
  });
});
