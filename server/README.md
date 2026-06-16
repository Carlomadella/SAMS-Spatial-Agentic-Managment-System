# SAMS Runtime — Claude Managed Agents

This service turns SAMS from a visual sandbox into a real control room: when you
assign a task to an agent in the UI, the runtime spins up a **Claude Managed
Agents** session that mounts your GitHub repo, does the work in a sandbox, pushes
a branch, and opens a pull request — streaming every step back to the 3D scene
(status, progress, event log).

```
SAMS UI ──POST /api/assign──▶  runtime  ──▶  Claude Managed Agents (cloud sandbox)
   ▲                                              │  bash / edit / write  →  git push
   └──────────── SSE /api/events ◀──── stream ────┘
                                   └──▶  GitHub: open Pull Request
```

## Prerequisites

- An **Anthropic API key** with Managed Agents access.
- A **GitHub fine-grained PAT** with *Contents: Read and write* (add *Pull
  requests: Read and write* for PRs) on the target repo
  (`Carlomadella/Tutto-sulla-programmazione`).

## Setup (all from the app — recommended)

From the **repo root** (one terminal command):

```bash
npm run bootstrap   # install web + runtime deps (once)
npm start           # launches the web app AND the runtime together
```

Then do everything in the UI — no files to edit:

1. Click ⚙ **Runtime settings** in the top bar.
2. Paste your **Anthropic API key** + **GitHub token**, set the **repository**,
   and **Save**.
3. Click **Provisiona agenti** (creates the managed agent + environment once).
4. Select an agent, type a task in human language, hit **Assign task (live)**.

Settings/IDs persist to `server/.sams-runtime.json` (git-ignored). The app
reaches the runtime at `http://localhost:8787` by default.

### CLI alternative (optional)

Prefer the terminal? Put `ANTHROPIC_API_KEY` + `GITHUB_TOKEN` in `server/.env`
(see `.env.example`), then:

```bash
cd server && npm install
npm run setup       # creates the Agent + Environment, saves the IDs
npm run dev         # runtime on :8787
```

## Endpoints

| Method | Path            | Purpose                                              |
| ------ | --------------- | --------------------------------------------------- |
| `GET`  | `/api/health`   | health + sanitized status                           |
| `GET`  | `/api/status`   | which keys are set, provisioned?, repo, model       |
| `POST` | `/api/settings` | save keys/repo/model (entered in the app)           |
| `POST` | `/api/provision`| create (or re-create) the Agent + Environment       |
| `GET`  | `/api/events`   | SSE stream of `WireEvent`s (status/progress/log)    |
| `POST` | `/api/assign`   | `{ agentId, agentName, title, branch? }` → run task |

## Env vars

See `.env.example`. Key ones: `ANTHROPIC_API_KEY`, `GITHUB_TOKEN`, `GITHUB_REPO`,
`GITHUB_BASE_BRANCH`, `SAMS_AGENT_ID`, `SAMS_ENVIRONMENT_ID`, `SAMS_OPEN_PRS`,
`SAMS_MODEL` (default `claude-opus-4-8`), `PORT`.

## How it maps to the UI

| Managed-agents event        | SAMS effect                          |
| --------------------------- | ------------------------------------ |
| `session.status_running`    | agent → *working*, log line          |
| `agent.message`             | log line (the agent's narration)     |
| `agent.tool_use`            | log line + progress bump             |
| `span.model_request_end`    | progress bump                        |
| `session.error`             | agent → *blocked*, error log         |
| `session.status_idle/...`   | progress 100, agent → *review*       |
| PR opened (GitHub API)      | success log with the PR URL          |

> Notes: the agent config is created **once** (`npm run setup`) and reused — the
> versioned Agent is the persistent object, sessions are per task. Progress % is a
> client-side heuristic derived from the event stream (Managed Agents doesn't emit
> a percentage). The runtime keeps secrets server-side; the browser only ever
> talks to this service, never to Anthropic/GitHub directly.
