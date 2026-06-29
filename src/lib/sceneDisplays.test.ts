import { describe, expect, it } from "vitest";
import { monitorView, queueBoard } from "./sceneDisplays";
import type { Agent } from "../types";

function agent(over: Partial<Agent> = {}): Agent {
  return {
    id: "agent-blue",
    name: "Blu",
    color: "blue",
    model: "test",
    role: "Dev",
    instructions: "",
    status: "idle",
    position: [0, 0],
    target: null,
    task: null,
    taskQueue: [],
    energy: 100,
    mood: "happy",
    ...over,
  };
}

describe("monitorView", () => {
  it("returns null when nobody is working", () => {
    expect(monitorView(null)).toBeNull();
    expect(monitorView(agent({ status: "idle", task: null }))).toBeNull();
  });

  it("shows the staged file content when one is present", () => {
    const a = agent({
      name: "Verde",
      status: "working",
      task: { title: "Fix bug", branch: "fix/x", progress: 30 },
      pendingFiles: [{ path: "src/a.ts", content: "line1\nline2\nline3", message: "m" }],
    });
    const v = monitorView(a)!;
    expect(v.status).toBe("writing");
    expect(v.path).toBe("src/a.ts");
    expect(v.agentName).toBe("Verde");
    expect(v.lines).toEqual(["line1", "line2", "line3"]);
  });

  it("uses the last staged file and truncates lines + long content", () => {
    const long = "x".repeat(60);
    const a = agent({
      status: "working",
      task: { title: "T", branch: "b", progress: 1 },
      pendingFiles: [
        { path: "old.ts", content: "old", message: "m" },
        { path: "new.ts", content: Array.from({ length: 12 }, (_, i) => (i === 0 ? long : `l${i}`)).join("\n"), message: "m" },
      ],
    });
    const v = monitorView(a, 7)!;
    expect(v.path).toBe("new.ts");
    expect(v.lines).toHaveLength(7);
    expect(v.lines[0]).toBe("x".repeat(41) + "…");
  });

  it("falls back to the plan when no file is staged yet", () => {
    const a = agent({
      status: "working",
      task: { title: "Build", branch: "b", progress: 0, plan: ["Leggi", "Scrivi"] },
    });
    const v = monitorView(a)!;
    expect(v.status).toBe("planning");
    expect(v.lines).toEqual(["1. Leggi", "2. Scrivi"]);
  });

  it("falls back to the task title when there is no plan", () => {
    const a = agent({ status: "working", task: { title: "Solo titolo", branch: "b", progress: 0 } });
    expect(monitorView(a)!.lines).toEqual(["Solo titolo"]);
  });
});

describe("queueBoard", () => {
  it("collects queued tasks across agents in order, capped", () => {
    const a = agent({ id: "agent-blue", name: "Blu", taskQueue: [{ title: "t1", branch: "b" }, { title: "t2", branch: "b" }] });
    const b = agent({ id: "agent-green", name: "Verde", color: "green", taskQueue: [{ title: "t3", branch: "b" }] });
    const rows = queueBoard([a, b]);
    expect(rows.map((r) => r.title)).toEqual(["t1", "t2", "t3"]);
    expect(rows[2]).toMatchObject({ agentName: "Verde", color: "green" });
  });

  it("respects the max cap", () => {
    const a = agent({ taskQueue: [1, 2, 3, 4].map((n) => ({ title: `t${n}`, branch: "b" })) });
    expect(queueBoard([a], 2)).toHaveLength(2);
  });

  it("returns an empty list when no queues", () => {
    expect(queueBoard([agent()])).toEqual([]);
  });
});
