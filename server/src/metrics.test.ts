import { describe, expect, it } from "vitest";
import { eventDelta } from "./metrics";

describe("eventDelta", () => {
  it("counts every event once", () => {
    expect(eventDelta({ agentId: "a", agentName: "x", message: "hi" }).events).toBe(1);
  });

  it("flags a task start (working at low progress)", () => {
    expect(eventDelta({ agentId: "a", agentName: "x", status: "working", progress: 6 }).tasksStarted).toBe(1);
    // a mid-task working tick is not a start
    expect(eventDelta({ agentId: "a", agentName: "x", status: "working", progress: 60 }).tasksStarted).toBe(0);
  });

  it("flags a task completion on review or done", () => {
    expect(eventDelta({ agentId: "a", agentName: "x", status: "review" }).tasksCompleted).toBe(1);
    expect(eventDelta({ agentId: "a", agentName: "x", status: "done" }).tasksCompleted).toBe(1);
    expect(eventDelta({ agentId: "a", agentName: "x", status: "idle" }).tasksCompleted).toBe(0);
  });

  it("flags errors by level", () => {
    expect(eventDelta({ agentId: "a", agentName: "x", level: "ERROR", message: "boom" }).errors).toBe(1);
    expect(eventDelta({ agentId: "a", agentName: "x", level: "INFO" }).errors).toBe(0);
  });
});
