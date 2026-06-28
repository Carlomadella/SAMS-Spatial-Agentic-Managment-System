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
