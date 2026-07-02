# SAMS · Spatial Agentic Management System

> **The Sims, but for managing AI agents.** A 3D, game-like workspace where each
> AI agent is a little character you can spawn, select, walk around an office and
> assign work to — wrapped in a familiar IDE-style shell.

This is **v1: a manual sandbox**. You are in control — spawn agents, click to
select them, send them walking across the floor, dispatch them to zones
(Desk, Whiteboard, Kanban Wall, Vault, Security Gate, Lounge) and assign tasks.
Everything you do streams into a live Event Log.

![SAMS layout](docs/preview.svg)

## Stack

- **React + TypeScript + Vite**
- **three.js** via **@react-three/fiber** + **@react-three/drei** for the 3D scene
- **Zustand** for state (agents, tasks, events, UI)
- **Tailwind CSS** for the IDE shell
- **lucide-react** for icons

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
```

Other scripts:

```bash
npm run build    # type-check (tsc) + production build
npm run preview  # serve the production build
```

> A modern browser with **WebGL** is required for the 3D scene.

## What you can do

| Action | How |
| --- | --- |
| Spawn an agent | **+ Agent** button (top bar) or `⌘/Ctrl + K` → *Spawn agent* |
| Select an agent | Click it in the scene, the **System Overview** minimap, or the Explorer |
| Walk an agent | Select it, then **click the floor** where you want it to go |
| Dispatch to a zone | Click a zone ring in the scene, use the **radial menu**, the **Spatial CAD** panel, or the inspector's *Send to…* |
| Assign / update a task | Use the **Agent inspector** (bottom-right): title + branch, then drag the progress slider |
| Set status | Radial menu around a selected agent, or the inspector's status buttons |
| Remove an agent | Radial menu (trash) or the inspector |
| Source-control actions | The **Security Gate** panel (right): open PR, commit, push, approve… (streamed to the Event Log) |
| Command everything | `⌘/Ctrl + K` command palette |

## Layout (mirrors the reference design)

```
┌───────────────────────────────────────────────────────────┐
│ TitleBar — brand · command search (⌘K) · panel toggles     │
├──┬───────────┬─────────────────────────────┬───────────────┤
│A │ Explorer  │                             │ System Overview│
│c │ /Search   │      3D OFFICE SCENE         │  (minimap)     │
│t │ /SCM      │   agents · zones · radial    ├───────────────┤
│B │ /CAD      │      menu · click-to-walk    │ Security Gate  │
│a │ /Exts     │                             │ Source Control │
│r │           ├─────────────────────────────┤  actions       │
│  │           │ Terminal·Output·Event Log·Pb │ Agent Inspector│
├──┴───────────┴─────────────────────────────┴───────────────┤
│ StatusBar — branch · env · warnings · agents · Connected    │
└───────────────────────────────────────────────────────────┘
```

## Project structure

```
src/
  data/        world layout (room + zones) and seed agents/events/file-tree
  scene/       react-three-fiber scene
    OfficeScene.tsx   canvas, camera, lights, floor, walls, zones, agents
    Agent3D.tsx       a "Sims-like" character: walking, selection, radial menu
    Furniture.tsx     desk, whiteboard, kanban, vault, gate, sofa, plant
    RadialMenu.tsx    the in-world pie menu
  components/   IDE shell (TitleBar, ActivityBar, panels, BottomPanel, …)
  store/        Zustand store — the heart of the sandbox
  lib/          small utils + shared UI metadata
  types.ts      domain model
```

## Development

```bash
npm run dev               # Vite dev server (frontend only)
npm start                 # frontend + runtime together (scripts/dev-all.mjs)
npm run build             # typecheck + production build
npm run lint              # ESLint over frontend + server + e2e
npm test                  # frontend unit tests (Vitest + jsdom)
npm run test:e2e          # Playwright smoke tests
npm --prefix server test  # server unit tests (Vitest)
```

CI (`.github/workflows/ci.yml`) runs lint, build, and both test suites on every push/PR.

## Live mode — real agents (Claude Managed Agents)

SAMS can drive **real** AI agents: assign a task in plain language and the agent
mounts your GitHub repo, does the work in a sandbox, pushes a branch, and opens a
pull request — streaming status/progress/logs into the 3D scene. Everything is
driven from the app; the only terminal command is a single start:

```bash
npm run bootstrap   # install web + runtime deps (once)
npm start           # launch the app AND the runtime together
```

Then, **inside the app** (no terminal, no files to edit):

1. Click the ⚙ button in the top bar to open **Runtime settings**.
2. Choose the **engine**:
   - **Gemini (Google, free tier)** — default. Get a free key at
     <https://aistudio.google.com/apikey>. No provisioning needed.
   - **Claude (Anthropic, paid)** — needs API credits; click *Provisiona agenti*.
3. Paste the engine key + a **GitHub token** (fine-grained, *Contents: Read and
   write*), set the **repository**, optionally a **Notion** token, then **Save**.
4. Select an agent, type a task in human language in the inspector, and hit
   **Assign task (live)**. Watch the Event Log and the PR appear.

With **Gemini**, agents can also write content into a **Notion page by title**
(e.g. *"red-agent: aggiungi un esempio di async/await nella pagina JAVASCRIPT"*).

**Reusable for any repo:** just change the **Repository** field in settings — the
agents are repo-agnostic. Keys and provisioned IDs are stored locally in
`server/.sams-runtime.json` (git-ignored). The app talks to the runtime at
`http://localhost:8787` by default (override with `VITE_SAMS_BACKEND_URL`). Full
guide: [`server/README.md`](./server/README.md).

## Reactive mode — incoming GitHub webhooks

SAMS can **react** to your repo, not just push to it. Point a GitHub webhook at
the runtime and events flow into the 3D world live:

- **push / PR opened·closed·merged** → a summary line in the Event Log.
- **CI failed** (`workflow_run`) → a 🔔 *wake*: a contextual fix task ("indaga e
  correggi la CI sul branch X").
- **review requested** (`pull_request`) → a 🔔 *wake*: a review task for that PR.

A *wake* is **only auto-assigned** to a free agent when you opt in: enable
**"Rispondi ai webhook GitHub"** in the **Live Sim** panel (off by default — when
off, the suggestion just shows in the Event Log so you can act on it manually).

**Setup:** GitHub → *Repo → Settings → Webhooks → Add webhook*

- **Payload URL:** `https://<your-host>/api/webhook/github`
- **Content type:** `application/json`
- **Secret:** set one, and give the runtime the **same** value via
  `GITHUB_WEBHOOK_SECRET` in `server/.env`.

> ⚠️ **If the runtime is reachable from the internet, always set
> `GITHUB_WEBHOOK_SECRET`.** The endpoint verifies GitHub's `x-hub-signature-256`
> HMAC and rejects unsigned/forged requests with `401`. Leaving the secret empty
> disables verification — convenient for `localhost`, unsafe when exposed.

## MCP tools — Drive / Calendar / Canva (and more)

Agents can call external **MCP servers** through a single generic tool,
`mcp_call(server, tool, args)` — e.g. write a report to Google Drive, create a
Calendar event, or generate a Canva graphic. It's an **allow-list**: nothing is
exposed unless you configure it, and the tool isn't even offered when the list is
empty.

Configure via `SAMS_MCP_SERVERS` in `server/.env` — a JSON array:

```jsonc
SAMS_MCP_SERVERS='[
  { "name": "drive", "url": "https://your-mcp-host/drive", "token": "…",
    "tools": ["files.create", "files.read"] },   // optional per-server allow-list
  { "name": "calendar", "url": "https://your-mcp-host/calendar" }
]'
```

Each entry needs a `name` and an `http(s)` `url` (an MCP server speaking JSON-RPC
`tools/call`, plain-JSON or SSE response). `token` (optional) is sent as a Bearer
header; `tools` (optional) restricts which tools that server may run. The agent
sees the configured servers in the tool description and calls, e.g.,
`mcp_call("drive", "files.create", { name: "report.md", content: "…" })`.

## Public dashboard (read-only)

Open `?public` (e.g. `http://localhost:5173/?public`) for a **shareable, read-only
dashboard**: runtime status, task metrics and the Commit Garden leaderboard, with
**no** controls to assign tasks. It polls `GET /api/public` every 10s.

By default the endpoint is open. To gate it behind a link secret, set
`SAMS_READONLY_TOKEN` in `server/.env`; the dashboard then needs the matching
`&token=…` (`?public&token=…`). This is independent from `SAMS_TOKEN` (which
guards the *mutating* routes) — the public snapshot never exposes secrets and
can't change anything.

## Commit Garden (a room you can enter)

The office has a **🌿 garden door** (back-right wall; also the Sprout button in the
title bar or `⌘K → Open Commit Garden`). It opens **Commit Garden** — a virtual
garden where every GitHub push waters a plant that grows (seed → sprout → … →
blooming), with a public profile page at `/u/:user`.

It's **built into the SAMS runtime** (not a separate app), so a single
`npm start` runs everything. Plants grow **only from real pushes** — there's no
manual watering. With the **GitHub webhook** connected (see the reactive-mode
section above), a `push` **auto-waters** the pusher's garden in real time (no need
to reopen it); otherwise growth is picked up on the next refresh. Optional: a
`GITHUB_TOKEN` raises GitHub's rate limit; set
`DB_HOST`/`DB_USER`/… in `server/.env` for MySQL persistence (in-memory
otherwise). Override the API origin with `VITE_GARDEN_API` if you host it apart.

## Roadmap

The first roadmap is complete — see [`ROADMAP.md`](./ROADMAP.md) for the full,
checked-off history. The next chapter lives in [`ROADMAP2.md`](./ROADMAP2.md)
(in-app diff approval, SQLite persistence, frontend tests, centralized
retry/backoff, optional runtime auth, deeper 3D world).

Highlights still on deck:

- **Live simulation mode** — agents that pick up tasks and progress on their own.
- Multi-repo targets, per-agent role/model presets, PR review from the gate panel.
- Multi-room layouts, drag-to-move, richer character models.

---

*Italiano:* SAMS è un "The Sims" per gli agenti AI — un ufficio 3D dove crei,
selezioni e comandi gli agenti dentro una shell in stile IDE. Questa è la v1
**sandbox manuale**: sei tu a guidare tutto.
