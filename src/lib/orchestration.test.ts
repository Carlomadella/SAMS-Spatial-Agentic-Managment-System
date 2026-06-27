import { describe, expect, it } from "vitest";
import { composeRelayTitle, findRelayTarget, isIdleEligible } from "./orchestration";
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
