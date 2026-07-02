import { describe, expect, it } from "vitest";
import { buildPublicSnapshot, readonlyAuthorized, type PublicSnapshotInput } from "./publicView";

describe("readonlyAuthorized", () => {
  it("is open when no token is configured", () => {
    expect(readonlyAuthorized("", undefined)).toBe(true);
    expect(readonlyAuthorized("", "whatever")).toBe(true);
  });

  it("requires an exact match when configured", () => {
    expect(readonlyAuthorized("s3cret", "s3cret")).toBe(true);
    expect(readonlyAuthorized("s3cret", "wrong")).toBe(false);
    expect(readonlyAuthorized("s3cret", undefined)).toBe(false);
    expect(readonlyAuthorized("s3cret", "s3cre")).toBe(false); // different length
  });
});

const input = (): PublicSnapshotInput => ({
  now: 1000,
  status: { provider: "gemini", ready: true, repo: "acme/app", baseBranch: "main", model: "flash" },
  metrics: {
    tasksStarted: 4,
    tasksCompleted: 3,
    errors: 1,
    uptimeSec: 120,
    lifetime: { total: 40, completed: 33, tokens: 5000 },
  },
  board: [
    { user: "ada", stage: "tree", growth: 80, waterings: 12 },
    { user: "linus", stage: "sprout", growth: 20, waterings: 30 },
  ],
});

describe("buildPublicSnapshot", () => {
  it("flattens status, metrics and garden into a read-only view", () => {
    const s = buildPublicSnapshot(input());
    expect(s.generatedAt).toBe(1000);
    expect(s.runtime).toEqual({ provider: "gemini", ready: true, repo: "acme/app", baseBranch: "main", model: "flash" });
    expect(s.metrics.tasksCompleted).toBe(3);
    expect(s.metrics.lifetimeTokens).toBe(5000);
    expect(s.garden.contributors).toBe(2);
    expect(s.garden.totalWaterings).toBe(42);
  });

  it("ranks the top gardens by waterings", () => {
    const s = buildPublicSnapshot(input());
    expect(s.garden.top.map((g) => g.user)).toEqual(["linus", "ada"]);
  });

  it("defaults lifetime to zeros when absent", () => {
    const i = input();
    delete i.metrics.lifetime;
    const s = buildPublicSnapshot(i);
    expect(s.metrics.lifetimeTasks).toBe(0);
    expect(s.metrics.lifetimeTokens).toBe(0);
  });
});
