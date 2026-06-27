import type { Agent, FileNode, LogEvent } from "../types";

// ---------------------------------------------------------------------------
// Initial population of the workspace. This is a manual sandbox: these agents
// are just a starting point — the user adds / moves / commands them from here.
// ---------------------------------------------------------------------------

export const SEED_AGENTS: Agent[] = [
  {
    id: "agent-blue",
    name: "blue-agent",
    color: "blue",
    model: "Claude Opus",
    role: "Generalist",
    instructions: "",
    status: "working",
    position: [0, 3.0],
    target: null,
    task: { title: "Implement authentication flow", branch: "feature/auth-flow", progress: 72 },
    taskQueue: [],
  },
  {
    id: "agent-green",
    name: "green-agent",
    color: "green",
    model: "Claude Sonnet",
    role: "Tester",
    instructions: "",
    status: "done",
    position: [3.0, -2.4],
    target: null,
    task: { title: "Run test suite", branch: "feature/auth-flow", progress: 100 },
    taskQueue: [],
  },
  {
    id: "agent-orange",
    name: "orange-agent",
    color: "orange",
    model: "Claude Sonnet",
    role: "Revisore",
    instructions: "",
    status: "review",
    position: [5.0, -1.6],
    target: null,
    task: { title: "Waiting for review: PR #128", branch: "feature/payments", progress: 40 },
    taskQueue: [],
  },
  {
    id: "agent-purple",
    name: "purple-agent",
    color: "purple",
    model: "Claude Opus",
    role: "Architetto",
    instructions: "",
    status: "working",
    position: [-1.6, -2.4],
    target: null,
    task: { title: "Update workflow: code-review.flow", branch: "chore/flows", progress: 55 },
    taskQueue: [],
  },
  {
    id: "agent-yellow",
    name: "yellow-agent",
    color: "yellow",
    model: "Claude Haiku",
    role: "Documentatore",
    instructions: "",
    status: "done",
    position: [6.0, 1.4],
    target: null,
    task: { title: "Deploy to staging environment", branch: "release/0.4", progress: 100 },
    taskQueue: [],
  },
  {
    id: "agent-red",
    name: "red-agent",
    color: "red",
    model: "Claude Sonnet",
    role: "Generalist",
    instructions: "",
    status: "idle",
    position: [-6.2, 2.4],
    target: null,
    task: null,
    taskQueue: [],
  },
];

/** Event log seeded to mirror a lively workspace. Timestamps are recent. */
export function seedEvents(now = Date.now()): LogEvent[] {
  const rows: Array<[string, Agent["color"], LogEvent["level"], string]> = [
    ["blue-agent", "blue", "INFO", "Started task: Implement authentication flow"],
    ["green-agent", "green", "SUCCESS", "Tests passed: 24/24"],
    ["orange-agent", "orange", "WARN", "Waiting for review: Pull Request #128"],
    ["purple-agent", "purple", "INFO", "Updated workflow: code-review.flow"],
    ["yellow-agent", "yellow", "SUCCESS", "Deployed to staging environment"],
    ["red-agent", "red", "IDLE", "No active tasks"],
  ];
  return rows.map((row, i) => {
    const [name, color, level, message] = row;
    return {
      id: `seed-evt-${i}`,
      ts: now - (rows.length - i) * 1100,
      agentId: `agent-${color}`,
      agentName: name,
      color,
      level,
      message,
    };
  });
}

/**
 * The non-agent part of the Explorer tree (workflows / environments / assets /
 * configs / docs). The agents folder is generated live from the store.
 */
export const STATIC_TREE: FileNode[] = [
  {
    id: "workflows",
    name: "workflows",
    kind: "folder",
    children: [
      { id: "wf-onboarding", name: "onboarding.flow", kind: "file", badge: "M" },
      { id: "wf-codereview", name: "code-review.flow", kind: "file", badge: "M" },
      { id: "wf-deploy", name: "deploy.flow", kind: "file" },
    ],
  },
  {
    id: "environments",
    name: "environments",
    kind: "folder",
    children: [
      { id: "env-dev", name: "dev.env", kind: "file" },
      { id: "env-staging", name: "staging.env", kind: "file", badge: "M" },
      { id: "env-prod", name: "prod.env", kind: "file" },
    ],
  },
  {
    id: "assets",
    name: "assets",
    kind: "folder",
    children: [
      { id: "as-arch", name: "architecture.spatial", kind: "file", badge: "M" },
      { id: "as-office", name: "office-layout.spatial", kind: "file", badge: "M" },
      { id: "as-furniture", name: "furniture.spatial", kind: "file", badge: "U" },
    ],
  },
  {
    id: "configs",
    name: "configs",
    kind: "folder",
    children: [
      { id: "cfg-sams", name: "sams.yaml", kind: "file", badge: "M" },
      { id: "cfg-agents", name: "agents.yaml", kind: "file" },
      { id: "cfg-perms", name: "permissions.yaml", kind: "file", badge: "U" },
    ],
  },
  { id: "doc-readme", name: "README.md", kind: "file", badge: "M" },
  { id: "doc-changelog", name: "CHANGELOG.md", kind: "file" },
  { id: "doc-license", name: "LICENSE", kind: "file", badge: "U" },
];
