import { describe, expect, it } from "vitest";
import { resolveAgentByToken } from "./agentMatch";
import type { Agent, AgentColor } from "../types";

function mk(name: string, color: AgentColor): Agent {
  return {
    id: `agent-${color}`,
    name,
    color,
    model: "",
    role: "Generalist",
    instructions: "",
    status: "idle",
    position: [0, 0],
    target: null,
    task: null,
    taskQueue: [],
  };
}

const AGENTS: Agent[] = [
  mk("blue-agent", "blue"),
  mk("green-agent", "green"),
  mk("blueprint-bot", "purple"),
];

describe("resolveAgentByToken", () => {
  it("returns undefined for a blank token", () => {
    expect(resolveAgentByToken(AGENTS, "")).toBeUndefined();
    expect(resolveAgentByToken(AGENTS, "   ")).toBeUndefined();
  });

  it("matches an exact name (case-insensitive)", () => {
    expect(resolveAgentByToken(AGENTS, "Blue-Agent")?.id).toBe("agent-blue");
  });

  it("prefers exact name over a prefix collision", () => {
    // "blue-agent" exact must win over "blueprint-bot" which also starts with 'blue'
    expect(resolveAgentByToken(AGENTS, "blue-agent")?.name).toBe("blue-agent");
  });

  it("matches by color when no name matches", () => {
    expect(resolveAgentByToken(AGENTS, "green")?.id).toBe("agent-green");
  });

  it("matches by prefix when neither name nor color match exactly", () => {
    expect(resolveAgentByToken(AGENTS, "bluep")?.name).toBe("blueprint-bot");
  });

  it("falls back to a substring match", () => {
    expect(resolveAgentByToken(AGENTS, "print")?.name).toBe("blueprint-bot");
  });

  it("returns undefined when nothing matches", () => {
    expect(resolveAgentByToken(AGENTS, "zzz")).toBeUndefined();
  });
});
