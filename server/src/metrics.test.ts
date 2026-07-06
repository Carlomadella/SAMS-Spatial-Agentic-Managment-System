import { describe, expect, it } from "vitest";
import { eventDelta, metricsSnapshot, recordChatMessage, recordClients } from "./metrics";

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

describe("shared-workspace metrics", () => {
  it("counts chat messages cumulatively", () => {
    const before = metricsSnapshot({ clients: 0 }).chatMessages;
    recordChatMessage();
    recordChatMessage();
    expect(metricsSnapshot({ clients: 0 }).chatMessages).toBe(before + 2);
  });

  it("tracks the peak of connected views (monotonic high-water mark)", () => {
    recordClients(4);
    const peak = metricsSnapshot({ clients: 1 }).peakClients;
    expect(peak).toBeGreaterThanOrEqual(4);
    // a later, smaller reading must not lower the peak
    expect(metricsSnapshot({ clients: 1 }).peakClients).toBe(peak);
  });

  it("exposes uptime and current clients", () => {
    const snap = metricsSnapshot({ clients: 2 });
    expect(snap.clients).toBe(2);
    expect(snap.uptimeSec).toBeGreaterThanOrEqual(0);
  });
});
