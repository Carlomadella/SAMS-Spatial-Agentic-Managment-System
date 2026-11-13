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
   address, used in reset/verification links), and `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`
   so every user works on their own GitHub (see [Sign in with GitHub](#sign-in-with-github)).
4. **Open the app and register right away.** The first account becomes the owner, and
   from that moment roles are enforced (see [Roles](#roles-and-access)).

The service listens on Render's injected `$PORT` and is health-checked at
`/api/health`. The Blueprint uses Render's **free plan**, which has no persistent disk,
so:

- **`SAMS_DB_URL` is required**: accounts, chat, the world, routines, history and the
  choices made in ⚙ (engine, model, repo, branch, PRs, approval, Notion page,
  provisioning ids) live in an external MySQL 8. The Blueprint sets
  `SAMS_EPHEMERAL_DISK=1`, and with it the runtime **refuses to start** without
  `SAMS_DB_URL` rather than keep data on a disk that is wiped.
- **The server's keys and tokens are never stored in the database**: set them as environment
  variables (`OPENROUTER_API_KEY`, `GITHUB_TOKEN`, …). The only exception are the GitHub
  tokens of users who connected their account, stored **encrypted** with `SAMS_SECRET_KEY`. ⚙ shows a notice, the key fields
  are read-only, and the runtime answers `409` with the name of the variable to set.
- The service **sleeps after ~15 minutes without traffic** and takes about a minute to
  wake up; Render may also restart it at any time. **Routines run only while it is
  awake.** Free services share 750 instance hours per workspace per month.
- **Outbound SMTP is blocked** on the free plan (ports 25/465/587): send email with
  `RESEND_API_KEY`.

Variables marked `sync: false` are asked for only when the Blueprint is first created;
on an existing service add new ones (e.g. `SAMS_DB_URL`) by hand in the Environment tab.

**Moving an existing disk-based service to free.** Before syncing the Blueprint: copy the
data on the disk into MySQL (`npm run db:to-mysql` on the `.sams-data.db` from
`/var/data`, target empty), set `SAMS_DB_URL` (and `SAMS_DB_SSL_CA` if needed) and set
the keys that were saved from ⚙ as variables. To stay on a paid plan with a disk
instead, use `plan: starter`, a `disk:` on `/var/data`, `SAMS_DATA_DIR=/var/data` and no
`SAMS_EPHEMERAL_DISK`.

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
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | for per-user GitHub | — | GitHub OAuth App: each user connects their own GitHub and picks their repo (see [Sign in with GitHub](#sign-in-with-github)) |
| `SAMS_SECRET_KEY` | with the OAuth App | — | long random string; encrypts the users' GitHub tokens in the database. **Never change it** once users have connected |
| `GITHUB_TOKEN` | fallback | — | the server's own token (fine-grained, **Contents: read & write**). With the OAuth App set it is used only by static-token scripts and server-side jobs (routines, sim, webhooks) |
| `GITHUB_REPO` | fallback | — | `owner/repo` of the server's token. Setting it locks the field in ⚙ |
| `GITHUB_BASE_BRANCH` | no | `main` | base branch for PRs |
| `SAMS_OPEN_PRS` | no | `true` | open a PR automatically after a commit |
| `SAMS_REQUIRE_APPROVAL` | no | `false` | stage a diff for approval before committing |
| `GITHUB_WEBHOOK_SECRET` | if exposed | — | **set it** when the runtime is on the internet (verifies webhook HMAC). With `NODE_ENV=production` and no secret, the webhook answers 503 to every request |
| `SAMS_TOKEN` | no | — | **owner** Bearer token: full access, incl. settings/secrets |
| `SAMS_EDITOR_TOKEN` | no | — | **editor** Bearer token: starts work (assign/approve/sim/chat) but not settings |
| `SAMS_READONLY_TOKEN` | no | — | **viewer** token: gates the public read-only dashboard (`?public&token=…`) |
| `SAMS_PUBLIC_URL` | for emails | `http://localhost:5180` | public origin used to build password-reset / verification links |
| `SAMS_MAIL_FROM` | no | `SAMS <noreply@sams.local>` | sender of the account emails |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | no | — | SMTP channel (port defaults to `587`; `465` implies TLS, or force it with `SMTP_SECURE=true`) |
| `RESEND_API_KEY` | no | — | alternative email channel via the Resend API (ignored if `SMTP_HOST` is set) |
| `NOTION_TOKEN` / `NOTION_PAGE_ID` | no | — | let agents write to a Notion page |
| `SAMS_MCP_SERVERS` | no | — | JSON allow-list of MCP servers (`mcp_call`) |
| `SAMS_DB_URL` | on hosts without a disk | SQLite in `SAMS_DATA_DIR` | `mysql://user:password@host:3306/db` — keep accounts, chat, world, routines and history in MySQL 8 instead of the SQLite file. Set but unreachable → the runtime does not start. Append `?ssl-mode=REQUIRED` for TLS. Move existing data with `npm run db:to-mysql` (in `server/`, target empty). The non-secret settings from ⚙ live in the same database; keys and tokens do not (see `SAMS_EPHEMERAL_DISK`) |
| `SAMS_EPHEMERAL_DISK` | on hosts without a disk | off | `1` = the server's disk is wiped on restart (e.g. Render free). Keys and tokens can then only come from environment variables: ⚙ shows them read-only and the runtime rejects them with `409`. The other settings are still saved, in the database |
| `SAMS_DB_SSL_CA` | no | — | CA certificate (PEM text or file path) for providers with their own CA, e.g. Aiven |
| `DB_HOST` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | no | in-memory | MySQL for durable Commit Garden |
| `SAMS_DATA_DIR` | on hosts | server working dir | folder for the SQLite database (`.sams-data.db`) and the keys saved from ⚙ (`.sams-runtime.json`); point it at a persistent disk/volume, or both are lost on every redeploy. With `SAMS_DB_URL` + `SAMS_EPHEMERAL_DISK=1` it is not needed |
| `SAMS_TRUST_PROXY` | behind a proxy | off | how many proxies sit in front (Render: `1`, already in `render.yaml`), or a list of their IPs/CIDRs; lets per-IP limits see the real client. Never more hops than there really are, and `true` is refused: the client could choose its own IP. Check with `GET /api/admin/client-ip` as owner |
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

**Inviting people.** Anyone can sign up, but a new account starts as viewer. To bring someone
in with the right role, the owner invites them from the profile page (*Invita qualcuno*):
email + role (editor or viewer; never owner, so a forwarded link can't hand out full control).
With an email channel the invite is mailed; without one the owner gets the link to hand over.
The link (`/invito?token=…`) is single-use, bound to that address and valid for 7 days; only
its hash is stored, and the invitee's account is created already verified. A new invite to
the same address replaces the pending one, and pending invites can be revoked.

The live stream is tied to the credential that opened it: after a logout, an expired or
revoked session or a changed static token, the server closes the stream within one
heartbeat (25 s).

### Password management & the email channel

SAMS picks an email channel from the environment, and **what it can do follows from what
you configure** — there is nothing else to switch on:

| You configure | Channel | What changes |
| --- | --- | --- |
| nothing | logs only | Accounts work exactly as before: sign-up gets you straight in, no verification. A forgotten password is recovered from the **owner**, who issues a one-time reset link from the profile page (Users admin → 🔑) and hands it over. "Forgot password?" issues no link without a channel, and no email body (so no reset or invite link) is ever written to the logs: anyone who can read the logs could otherwise take over an account. |
| `SMTP_HOST…` or `RESEND_API_KEY` | real email | New sign-ups must **confirm their address** before they can log in, and "Forgot password?" mails the link on its own. The owner-issued link keeps working as a backstop. |

The verification gate only switches on with a real channel on purpose: without one nobody
could ever confirm an address, so enforcing it would lock everyone out. The first account
(the owner — you) is always created verified, and accounts that already existed before you
added the channel stay verified, so nobody gets locked out by the upgrade.

Reset links are single-use, expire after an hour, are stored **hashed** (a database dump
hands out no valid links), and using one logs out every other device on that account.

> ⚠️ **Exposed to the internet?** Always set `GITHUB_WEBHOOK_SECRET` (so incoming
> webhooks are HMAC-verified; in production, without it, the webhook refuses everything) and register the owner account before sharing the URL.
> Runtime settings can also be entered in-app (⚙). Where they go depends on the kind:
> **choices** (engine, model, repo, branch, PRs, approval, Notion page, provisioning ids)
> are saved in the database, in the `settings` table; **keys and tokens** are saved in
> `.sams-runtime.json` in `SAMS_DATA_DIR` — put that on a volume to keep them across
> restarts (the Compose file mounts one on `/data`, the Render Blueprint a disk on
> `/var/data`), or set them as environment variables. On the first start with this
> version the choices found in an older `.sams-runtime.json` are imported into the
> database once and removed from the file, which then keeps only the keys.
>
> **Precedence: environment > saved value (database or file) > defaults.** A variable that is set (and
> non-empty) in the environment always wins over what was saved, so rotating
> `SAMS_TOKEN` or an API key on the host takes effect on the next restart. Fields set
> by the environment are **read-only in the app** (marked "dal server" in ⚙): the
> runtime rejects in-app changes to them with `409`, so a token you think you rotated
> from the UI can never silently come back on the next restart. Change those on the host.

## Sign in with GitHub

Every SAMS account can connect **its own GitHub** and choose one of its repositories:
the tasks that person assigns work on that repo, with that person's permissions
(branches, commits and PRs appear under their GitHub name). Nobody is tied to the
server's repository.

1. On GitHub: **Settings → Developer settings → OAuth Apps → New OAuth App**.
   - *Application name*: `SAMS`
   - *Homepage URL*: your public address (e.g. `https://sams-83ts.onrender.com`)
   - *Authorization callback URL*: the same address + `/api/github/callback`
     (e.g. `https://sams-83ts.onrender.com/api/github/callback`). It must match
     `SAMS_PUBLIC_URL` exactly.
2. Copy the **Client ID**, then **Generate a new client secret** and copy it.
3. On the server set `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` and `SAMS_SECRET_KEY`
   (a long random string; the Render Blueprint generates it). Restart.
4. In the app: **⚙ → Il tuo GitHub → Collega GitHub**, authorize, then pick the repo
   and press **Usa questa repo**. SAMS checks that you can write to it.

How it behaves:

- The OAuth App asks for the `repo` scope (read/write and PRs, private repos included).
- With the OAuth App configured, a signed-in user who has not connected GitHub (or not
  chosen a repo) gets a clear `409` when assigning a task: work never falls back to the
  server's repository.
- Approving a staged diff commits to the repo of the task, with the token of whoever
  assigned it, even if someone else approves.
- **Disconnect** deletes the stored token and revokes it on GitHub.
- Changing the public address (e.g. a custom domain) means updating the callback URL in
  the OAuth App and `SAMS_PUBLIC_URL` together.

## Custom domain

Render's free plan supports custom domains with automatic HTTPS. You must own the
domain: buy it from a registrar, then in Render **Settings → Custom Domains → Add**,
create the DNS record Render shows at your registrar, and wait for verification. Then
update `SAMS_PUBLIC_URL` and the OAuth App's URLs to the new address.
