import type { Agent, FileNode, LogEvent, WorkflowDef } from "../types";

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
    energy: 68,
    mood: "focused",
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
    energy: 80,
    mood: "proud",
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
    energy: 55,
    mood: "focused",
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
    energy: 45,
    mood: "tired",
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
    energy: 90,
    mood: "proud",
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
    energy: 100,
    mood: "happy",
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

/** Workflow definitions — what each .flow file does when triggered. */
export const WORKFLOW_DEFS: WorkflowDef[] = [
  {
    id: "wf-onboarding",
    name: "Onboarding",
    description: "Analizza il repository e genera un report di orientamento per i nuovi agenti",
    taskTemplate: "Onboarding: esplora il repository con gh_list_files, leggi README e file di configurazione principali, poi scrivi un report di orientamento su Notion con le sezioni: struttura progetto, convenzioni, aree chiave",
    defaultRole: "Documentatore",
    icon: "BookOpen",
  },
  {
    id: "wf-codereview",
    name: "Code Review",
    description: "Revisione approfondita delle PR aperte — bug, stile e sicurezza",
    taskTemplate: "Code Review: elenca le PR aperte con gh_list_prs, leggi quella più recente con gh_read_pr, analizza i file modificati con gh_read_file e documenta i problemi trovati (bug, stile, sicurezza, performance) su Notion",
    defaultRole: "Revisore",
    icon: "GitPullRequest",
  },
  {
    id: "wf-deploy",
    name: "Deploy Check",
    description: "Verifica lo stato CI/CD e apre una PR di deployment se tutto è verde",
    taskTemplate: "Deploy Check: controlla gli ultimi run CI con gh_list_ci, se tutto è verde apri una PR di deployment verso main, altrimenti documenta i problemi trovati",
    defaultRole: "Generalist",
    icon: "Rocket",
  },
];

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
      { id: "wf-onboarding", name: "onboarding.flow", kind: "file", badge: "M", workflowId: "wf-onboarding" },
      { id: "wf-codereview", name: "code-review.flow", kind: "file", badge: "M", workflowId: "wf-codereview" },
      { id: "wf-deploy", name: "deploy.flow", kind: "file", workflowId: "wf-deploy" },
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
