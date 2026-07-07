# 🚀 Deploy SAMS

SAMS ships as a **single container**: the multi-stage [`Dockerfile`](../Dockerfile)
builds the Vite frontend and the production image runs the Express runtime, which
serves **both** the API and the built SPA on one port. So "deploying SAMS" is just
"running that one container" — no separate web server, no static host to wire up.

The server binds to the port given by the `PORT` env var (managed hosts inject it;
the image defaults to `3000`). Health check: `GET /api/health`.

## Option A — local / self-hosted (Docker Compose)

```bash
cp .env.example .env            # optional; or export the vars below
docker compose up --build       # → http://localhost:3000
```

Set at least one AI key and (for code tasks) a GitHub token + repo — either in a
`.env` file next to `docker-compose.yml` or in the environment. See
[Environment variables](#environment-variables).

## Option B — Render (one-click Blueprint)

This repo ships a [`render.yaml`](../render.yaml) Blueprint.

1. On [Render](https://render.com): **New → Blueprint**, pick this repository.
2. Render reads `render.yaml`, builds the `Dockerfile` and creates the web service.
3. After the first deploy, open the service's **Environment** tab and fill the
   secrets left blank (`GEMINI_API_KEY`/`GITHUB_TOKEN`/`GITHUB_REPO`, …).

The service listens on Render's injected `$PORT` and is health-checked at
`/api/health`.

## Option C — Fly.io

```bash
fly launch --dockerfile Dockerfile   # generates fly.toml; set internal_port = 3000
fly secrets set GEMINI_API_KEY=… GITHUB_TOKEN=… GITHUB_REPO=owner/repo
fly deploy
```

Any other Docker host (Railway, Koyeb, a VPS…) works the same way: build the
`Dockerfile`, expose the port, set the env vars.

## Environment variables

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `SAMS_PROVIDER` | no | `gemini` | `gemini` (free) · `groq` (free) · `openrouter` (free) · `claude` (paid) |
| `GEMINI_API_KEY` / `GROQ_API_KEY` / `OPENROUTER_API_KEY` / `ANTHROPIC_API_KEY` | ≥1 | — | key for the chosen provider |
| `SAMS_MODEL` | no | `gemini-2.5-flash` | model id for the provider (OpenRouter: a `:free` tool-capable id, e.g. `meta-llama/llama-3.3-70b-instruct:free`) |
| `GITHUB_TOKEN` | for code tasks | — | fine-grained, **Contents: read & write** |
| `GITHUB_REPO` | for code tasks | — | `owner/repo` (overridable per-agent in the UI) |
| `GITHUB_BASE_BRANCH` | no | `main` | base branch for PRs |
| `SAMS_OPEN_PRS` | no | `true` | open a PR automatically after a commit |
| `SAMS_REQUIRE_APPROVAL` | no | `false` | stage a diff for approval before committing |
| `GITHUB_WEBHOOK_SECRET` | if exposed | — | **set it** when the runtime is on the internet (verifies webhook HMAC) |
| `SAMS_TOKEN` | no | — | **owner** Bearer token: full access, incl. settings/secrets |
| `SAMS_EDITOR_TOKEN` | no | — | **editor** Bearer token: starts work (assign/approve/sim/chat) but not settings |
| `SAMS_READONLY_TOKEN` | no | — | **viewer** token: gates the public read-only dashboard (`?public&token=…`) |
| `NOTION_TOKEN` / `NOTION_PAGE_ID` | no | — | let agents write to a Notion page |
| `SAMS_MCP_SERVERS` | no | — | JSON allow-list of MCP servers (`mcp_call`) |
| `DB_HOST` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | no | in-memory | MySQL for durable Commit Garden |
| `PORT` | no | `3000` | injected by most managed hosts |

> ⚠️ **Exposed to the internet?** Always set `GITHUB_WEBHOOK_SECRET` (so incoming
> webhooks are HMAC-verified) and consider `SAMS_TOKEN` to gate task assignment.
> Runtime settings can also be entered in-app (⚙) and persist to
> `server/.sams-runtime.json` — mount a volume to keep them across restarts (the
> Compose file already does).
