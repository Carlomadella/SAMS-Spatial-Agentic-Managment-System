import { describe, expect, it } from "vitest";
import { activeGoal, advanceGoal, goalProgress, goalSummary, isGoalComplete, type Goal } from "./goals";

function goal(over: Partial<Goal> & { id: string; agentId: string }): Goal {
  return {
    id: over.id,
    agentId: over.agentId,
    title: "Progetto",
    milestone: 3,
    completed: 0,
    createdAt: 0,
    done: false,
    ...over,
  };
}

describe("goalProgress", () => {
  it("is a clamped fraction", () => {
    expect(goalProgress({ completed: 0, milestone: 4 })).toBe(0);
    expect(goalProgress({ completed: 2, milestone: 4 })).toBe(0.5);
    expect(goalProgress({ completed: 9, milestone: 4 })).toBe(1);
  });

  it("treats a non-positive milestone as complete", () => {
    expect(goalProgress({ completed: 0, milestone: 0 })).toBe(1);
  });
});

describe("isGoalComplete", () => {
  it("is true at or past the milestone", () => {
    expect(isGoalComplete({ completed: 2, milestone: 3 })).toBe(false);
    expect(isGoalComplete({ completed: 3, milestone: 3 })).toBe(true);
  });
});

describe("activeGoal", () => {
  it("returns the first non-done goal of the agent", () => {
    const goals = [
      goal({ id: "g1", agentId: "a", done: true }),
      goal({ id: "g2", agentId: "a" }),
      goal({ id: "g3", agentId: "b" }),
    ];
    expect(activeGoal(goals, "a")?.id).toBe("g2");
    expect(activeGoal(goals, "z")).toBeNull();
  });
});

describe("advanceGoal", () => {
  it("advances the active goal and marks it done at the milestone", () => {
    let goals = [goal({ id: "g1", agentId: "a", milestone: 2 })];
    goals = advanceGoal(goals, "a");
    expect(goals[0]).toMatchObject({ completed: 1, done: false });
    goals = advanceGoal(goals, "a");
    expect(goals[0]).toMatchObject({ completed: 2, done: true });
  });

  it("does nothing when the agent has no active goal", () => {
    const goals = [goal({ id: "g1", agentId: "a", done: true })];
    expect(advanceGoal(goals, "a")).toBe(goals);
    expect(advanceGoal([], "a")).toEqual([]);
  });

  it("only touches the agent's own active goal", () => {
    const goals = [goal({ id: "g1", agentId: "a" }), goal({ id: "g2", agentId: "b" })];
    const next = advanceGoal(goals, "a");
    expect(next.find((g) => g.id === "g2")!.completed).toBe(0);
  });
});

describe("goalSummary", () => {
  it("shows capped progress and title", () => {
    expect(goalSummary(goal({ id: "g", agentId: "a", completed: 5, milestone: 3, title: "X" }))).toBe("3/3 — X");
  });
});
