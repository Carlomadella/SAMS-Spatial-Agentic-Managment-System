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
   secrets left blank: at least `OPENROUTER_API_KEY` (or the key of the provider you
   pick in `SAMS_PROVIDER`), `SAMS_PUBLIC_URL` (the service's `https://…onrender.com`
   address, used in reset/verification links), and `GITHUB_TOKEN`/`GITHUB_REPO` for code tasks.
4. **Open the app and register right away.** The first account becomes the owner, and
   from that moment roles are enforced (see [Roles](#roles-and-access)).

The service listens on Render's injected `$PORT` and is health-checked at
`/api/health`. The Blueprint attaches a 1 GB **persistent disk** at `/var/data` and
points `SAMS_DATA_DIR` there, so accounts, chat, the world and the saved settings
survive deploys and restarts. A service with a disk runs as a single instance (Render
also turns off zero-downtime deploys for it), and needs a paid plan — `starter` is enough.

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
| `SAMS_PROVIDER` | no | `gemini` (`openrouter` in the Render Blueprint) | `gemini` (free) · `groq` (free) · `openrouter` (free) · `claude` (paid) |
| `GEMINI_API_KEY` / `GROQ_API_KEY` / `OPENROUTER_API_KEY` / `ANTHROPIC_API_KEY` | ≥1 | — | key for the chosen provider |
| `SAMS_MODEL` | no | `gemini-2.5-flash` | model id for the provider (OpenRouter: a `:free` tool-capable id, e.g. `nvidia/nemotron-3-ultra-550b-a55b:free`) |
| `GITHUB_TOKEN` | for code tasks | — | fine-grained, **Contents: read & write** |
| `GITHUB_REPO` | for code tasks | — | `owner/repo` (overridable per-agent in the UI) |
| `GITHUB_BASE_BRANCH` | no | `main` | base branch for PRs |
| `SAMS_OPEN_PRS` | no | `true` | open a PR automatically after a commit |
| `SAMS_REQUIRE_APPROVAL` | no | `false` | stage a diff for approval before committing |
| `GITHUB_WEBHOOK_SECRET` | if exposed | — | **set it** when the runtime is on the internet (verifies webhook HMAC) |
| `SAMS_TOKEN` | no | — | **owner** Bearer token: full access, incl. settings/secrets |
| `SAMS_EDITOR_TOKEN` | no | — | **editor** Bearer token: starts work (assign/approve/sim/chat) but not settings |
| `SAMS_READONLY_TOKEN` | no | — | **viewer** token: gates the public read-only dashboard (`?public&token=…`) |
| `SAMS_PUBLIC_URL` | for emails | `http://localhost:5173` | public origin used to build password-reset / verification links |
| `SAMS_MAIL_FROM` | no | `SAMS <noreply@sams.local>` | sender of the account emails |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | no | — | SMTP channel (port defaults to `587`; `465` implies TLS, or force it with `SMTP_SECURE=true`) |
| `RESEND_API_KEY` | no | — | alternative email channel via the Resend API (ignored if `SMTP_HOST` is set) |
| `NOTION_TOKEN` / `NOTION_PAGE_ID` | no | — | let agents write to a Notion page |
| `SAMS_MCP_SERVERS` | no | — | JSON allow-list of MCP servers (`mcp_call`) |
| `DB_HOST` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | no | in-memory | MySQL for durable Commit Garden |
| `SAMS_DATA_DIR` | on hosts | server working dir | folder for the database (`.sams-data.db`) and the saved settings (`.sams-runtime.json`); point it at a persistent disk/volume, or both are lost on every redeploy |
| `PORT` | no | `3000` | injected by most managed hosts |

### Roles and access

Roles (viewer < editor < owner) are **enforced as soon as either is true**:

- at least one account is registered (the first one becomes the owner), or
- a static token (`SAMS_TOKEN`, `SAMS_EDITOR_TOKEN`, `SAMS_READONLY_TOKEN`) is set.

When they are enforced, protected calls need a recognised credential: an account session
or a matching static token. An anonymous visitor gets `401` on everything except the health
check, the public status, the login/sign-up routes and the public dashboard (`?public`, which
has its own `SAMS_READONLY_TOKEN`): chat, world, history, routines, metrics and the live event
stream are for accounts only, and the workspace shows "Accesso richiesto" with a sign-in link.
A viewer can only look; an editor starts work; the owner also manages settings and users.

The live stream (`/api/events`) is an `EventSource`, which cannot send an `Authorization`
header. So the app first asks `POST /api/events/ticket` (authenticated) for a **one-time
ticket**, valid for 30 seconds, and opens the stream with `?t=<ticket>`. The session token
never appears in a URL, and a stream URL that ends up in a proxy log is already useless.
With **no accounts and no tokens** the runtime is in open dev mode and everyone is owner —
fine on your laptop, never on the internet. So on a fresh deploy, register the owner account
first: until then, whoever opens the URL first gets to do it.

The static tokens are optional once accounts exist; they are for scripts and integrations.

### Password management & the email channel

SAMS picks an email channel from the environment, and **what it can do follows from what
you configure** — there is nothing else to switch on:

| You configure | Channel | What changes |
| --- | --- | --- |
| nothing | logs only | Accounts work exactly as before: sign-up gets you straight in, no verification. A forgotten password is recovered from the **owner**, who issues a one-time reset link from the profile page (Users admin → 🔑) and hands it over. The link is also printed in the server logs. |
| `SMTP_HOST…` or `RESEND_API_KEY` | real email | New sign-ups must **confirm their address** before they can log in, and "Forgot password?" mails the link on its own. The owner-issued link keeps working as a backstop. |

The verification gate only switches on with a real channel on purpose: without one nobody
could ever confirm an address, so enforcing it would lock everyone out. The first account
(the owner — you) is always created verified, and accounts that already existed before you
added the channel stay verified, so nobody gets locked out by the upgrade.

Reset links are single-use, expire after an hour, are stored **hashed** (a database dump
hands out no valid links), and using one logs out every other device on that account.

> ⚠️ **Exposed to the internet?** Always set `GITHUB_WEBHOOK_SECRET` (so incoming
> webhooks are HMAC-verified) and register the owner account before sharing the URL.
> Runtime settings can also be entered in-app (⚙) and persist to `.sams-runtime.json`
> in `SAMS_DATA_DIR` — put that on a volume to keep them across restarts (the Compose
> file mounts one on `/data`, the Render Blueprint a disk on `/var/data`).
>
> **Precedence: environment > saved file > defaults.** A variable that is set (and
> non-empty) in the environment always wins over `.sams-runtime.json`, so rotating
> `SAMS_TOKEN` or an API key on the host takes effect on the next restart. Fields set
> by the environment are **read-only in the app** (marked "dal server" in ⚙): the
> runtime rejects in-app changes to them with `409`, so a token you think you rotated
> from the UI can never silently come back on the next restart. Change those on the host.
