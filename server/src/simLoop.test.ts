import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CLAIM_TTL_MS,
  claimIssue,
  getClaims,
  getSimLabel,
  releaseByAgent,
  releaseIssue,
  simEnabled,
  simStatus,
  startSim,
  stopSim,
} from "./simLoop";

// The module keeps module-level state; reset between tests.
beforeEach(() => {
  stopSim(); // clears claims + disables
});

describe("simLoop — enable / disable", () => {
  it("starts disabled", () => {
    expect(simEnabled()).toBe(false);
  });

  it("startSim enables with default label 'sams'", () => {
    startSim();
    expect(simEnabled()).toBe(true);
    expect(getSimLabel()).toBe("sams");
  });

  it("startSim accepts a custom label", () => {
    startSim("my-label");
    expect(getSimLabel()).toBe("my-label");
  });

  it("stopSim disables and clears claims", () => {
    startSim();
    claimIssue(42, "agent-1");
    stopSim();
    expect(simEnabled()).toBe(false);
    expect(getClaims().size).toBe(0);
  });
});

describe("simLoop — claim / release", () => {
  beforeEach(() => startSim());

  it("claimIssue returns true for a new issue", () => {
    expect(claimIssue(1, "agent-a")).toBe(true);
  });

  it("claimIssue returns false if the issue is already claimed", () => {
    claimIssue(1, "agent-a");
    expect(claimIssue(1, "agent-b")).toBe(false);
  });

  it("different agents can claim different issues", () => {
    expect(claimIssue(1, "agent-a")).toBe(true);
    expect(claimIssue(2, "agent-b")).toBe(true);
    expect(getClaims().size).toBe(2);
  });

  it("releaseIssue frees the slot for re-claim", () => {
    claimIssue(7, "agent-a");
    releaseIssue(7);
    expect(claimIssue(7, "agent-b")).toBe(true);
  });

  it("releaseByAgent removes the agent's claim and returns its issue number", () => {
    claimIssue(99, "agent-a");
    const released = releaseByAgent("agent-a");
    expect(released).toBe(99);
    expect(getClaims().size).toBe(0);
  });

  it("releaseByAgent returns undefined when agent had no claim", () => {
    expect(releaseByAgent("nobody")).toBeUndefined();
  });
});

describe("simLoop — owner-aware release", () => {
  beforeEach(() => startSim());

  it("releaseIssue with a non-owner agentId does NOT release the claim", () => {
    claimIssue(5, "agent-a");
    releaseIssue(5, "agent-b"); // not the owner — must be ignored
    expect(claimIssue(5, "agent-c")).toBe(false); // still held by agent-a
    expect(getClaims().get(5)?.agentId).toBe("agent-a");
  });

  it("releaseIssue with the owner agentId releases the claim", () => {
    claimIssue(5, "agent-a");
    releaseIssue(5, "agent-a");
    expect(claimIssue(5, "agent-c")).toBe(true);
  });

  it("releaseIssue without an agentId releases unconditionally", () => {
    claimIssue(5, "agent-a");
    releaseIssue(5);
    expect(getClaims().size).toBe(0);
  });
});

describe("simLoop — stale claim takeover (TTL)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    startSim();
  });
  afterEach(() => vi.useRealTimers());

  it("a fresh claim cannot be taken over", () => {
    claimIssue(8, "agent-a");
    expect(claimIssue(8, "agent-b")).toBe(false);
  });

  it("a claim older than CLAIM_TTL_MS can be taken over by another agent", () => {
    claimIssue(8, "agent-a");
    vi.advanceTimersByTime(CLAIM_TTL_MS + 1);
    expect(claimIssue(8, "agent-b")).toBe(true);
    expect(getClaims().get(8)?.agentId).toBe("agent-b");
  });
});

describe("simLoop — simStatus", () => {
  it("reflects enabled state and claim count", () => {
    startSim("sams");
    claimIssue(3, "agent-x");
    claimIssue(4, "agent-y");
    expect(simStatus()).toEqual({ enabled: true, label: "sams", claimedCount: 2 });
  });
});
