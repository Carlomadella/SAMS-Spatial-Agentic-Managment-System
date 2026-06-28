import { describe, expect, it } from "vitest";
import { searchWorkspace } from "./search";
import type { FlatFile } from "./fileTree";
import type { Agent, AgentColor, WorkflowDef } from "../types";

function agent(name: string, color: AgentColor, role: string, task?: string): Agent {
  return {
    id: `agent-${color}`,
    name,
    color,
    model: "",
    role,
    instructions: "",
    status: task ? "working" : "idle",
    position: [0, 0],
    target: null,
    task: task ? { title: task, branch: "main", progress: 0 } : null,
    taskQueue: [],
  };
}

const AGENTS: Agent[] = [
  agent("blue-agent", "blue", "Tester", "Implement authentication"),
  agent("green-agent", "green", "Architetto"),
];

const WORKFLOWS: WorkflowDef[] = [
  { id: "wf-1", name: "Onboarding", description: "Genera report di orientamento", taskTemplate: "", defaultRole: "Doc", icon: "BookOpen" },
  { id: "wf-2", name: "Code Review", description: "Revisione delle PR aperte", taskTemplate: "", defaultRole: "Rev", icon: "GitPullRequest" },
];

const FILES: FlatFile[] = [
  { id: "f1", name: "sams.yaml", path: "configs/sams.yaml" },
  { id: "f2", name: "README.md", path: "README.md" },
];

describe("searchWorkspace", () => {
  it("returns nothing for a blank query", () => {
    expect(searchWorkspace("", AGENTS, WORKFLOWS, FILES)).toEqual([]);
    expect(searchWorkspace("   ", AGENTS, WORKFLOWS, FILES)).toEqual([]);
  });

  it("matches an agent by name", () => {
    const r = searchWorkspace("blue", AGENTS, WORKFLOWS, FILES);
    expect(r.some((x) => x.kind === "agent" && x.agentId === "agent-blue")).toBe(true);
  });

  it("matches an agent by role and by current task", () => {
    expect(searchWorkspace("architetto", AGENTS, WORKFLOWS, FILES)[0]?.agentId).toBe("agent-green");
    expect(searchWorkspace("authentication", AGENTS, WORKFLOWS, FILES)[0]?.agentId).toBe("agent-blue");
  });

  it("matches workflows by name and description", () => {
    expect(searchWorkspace("onboarding", AGENTS, WORKFLOWS, FILES)[0]?.workflowId).toBe("wf-1");
    expect(searchWorkspace("revisione", AGENTS, WORKFLOWS, FILES)[0]?.workflowId).toBe("wf-2");
  });

  it("matches files by full path", () => {
    const r = searchWorkspace("configs/", AGENTS, WORKFLOWS, FILES);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ kind: "file", label: "sams.yaml" });
  });

  it("is case-insensitive", () => {
    expect(searchWorkspace("BLUE", AGENTS, WORKFLOWS, FILES).length).toBeGreaterThan(0);
  });

  it("orders results agents → workflows → files", () => {
    // 'o' appears in an agent task, workflow names, and no file here
    const kinds = searchWorkspace("o", AGENTS, WORKFLOWS, FILES).map((r) => r.kind);
    const firstWf = kinds.indexOf("workflow");
    const firstFile = kinds.indexOf("file");
    const lastAgent = kinds.lastIndexOf("agent");
    if (firstWf !== -1 && lastAgent !== -1) expect(lastAgent).toBeLessThan(firstWf);
    if (firstFile !== -1 && firstWf !== -1) expect(firstWf).toBeLessThan(firstFile);
  });

  it("respects the result limit", () => {
    const many: FlatFile[] = Array.from({ length: 50 }, (_, i) => ({ id: `f${i}`, name: `x${i}.ts`, path: `x${i}.ts` }));
    expect(searchWorkspace("x", [], [], many, 10)).toHaveLength(10);
  });
});
