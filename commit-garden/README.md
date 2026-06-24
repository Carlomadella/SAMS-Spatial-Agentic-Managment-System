# 🌱 Commit Garden

A virtual garden where **every GitHub push waters a plant that grows**. Keep
committing and your plant goes seed → sprout → sapling → bush → tree → blooming.
It gamifies the "remember to push" habit, and gives you a public, SEO-friendly
profile page to show off your streak.

```
React + SVG (client, :5174)  ──/api──►  Express (server, :8088)  ──►  GitHub Events API
        ▲                                      │
        └──────────  growth/state  ◄───────────┴──►  MySQL (optional; in-memory fallback)
Public page:  GET /u/:user   →  server-rendered, SEO-friendly HTML (Open Graph)
```

## Quick start

```bash
cd commit-garden
npm run bootstrap     # install client + server (once)
npm start             # API on :8088, web on :5174
```

Open **http://localhost:5174**, type a GitHub username, and grow the garden.
Works with **no setup**: GitHub's public Events API needs no token (light rate
limit) and the DB falls back to in-memory. Add a token / MySQL when you want.

### Optional config (`server/.env`, see `.env.example`)
- `GITHUB_TOKEN` — raises GitHub rate limit (60/h → 5000/h).
- `DB_HOST`/`DB_USER`/… — enable MySQL persistence (`server/schema.sql`).

## How growth works
- On each refresh the server reads your recent **PushEvents** and adds the new
  commits as **waterings** (deduped via `lastSeen`).
- **Stage** is derived from total waterings; **streak** counts consecutive days
  with a push (a missed day resets it). The plant looks **thirsty** until you
  push again today.

## API
| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/garden/:user` | refresh from GitHub + return state |
| `GET` | `/api/leaderboard` | top gardens |
| `GET` | `/u/:user` | public SEO profile page (HTML + OG) |

> Plants grow **only** from real GitHub pushes — there's no manual "water"
> action (that would be cheating). Hitting `/api/garden/:user` re-reads the
> user's recent pushes and waters accordingly.

---

## Recommended next features
1. **Daily auto-refresh (cron)** — poll watched users once/day so plants update
   without a visit; record a `wilting` state after N missed days.
2. **GitHub webhook** — instant watering on `push` (no polling); verify the HMAC
   signature.
3. **OG image** — render a PNG of the plant for `og:image` (rich link previews).
4. **Garden of many plants** — one plant per repo, arranged in a plot.
5. **Badges & milestones** — "7-day streak", "first bloom", shareable SVG badge
   for READMEs (`/badge/:user.svg`).
6. **Weather/seasons** — commit frequency drives sun/rain; seasonal palettes.
7. **Auth (GitHub OAuth)** — claim your garden, private toggle, settings.
8. **Leaderboard filters** — by language, by streak, friends-only.
9. **Embeddable widget** — `<iframe>`/web component to drop the plant on a blog.
10. **Tests + CI** — unit tests for the growth model; GitHub Action on push.

## Instructions to give the SAMS agents
Point a SAMS agent at the repo and assign tasks like these (one per task):

- **green-agent (QA):** "In `commit-garden/server`, add Vitest and unit tests
  for `garden.ts` (`stageFor`, `growthFor`, `water` streak logic incl. missed
  day). Branch `feature/garden-tests`."
- **blue-agent (Backend):** "Add a GitHub webhook endpoint
  `POST /api/webhook` in `commit-garden/server` that verifies the
  `x-hub-signature-256` HMAC and waters the pushed user. Branch
  `feature/garden-webhook`."
- **yellow-agent (DevOps):** "Add a daily cron (node-cron) that refreshes all
  stored gardens and marks wilting after 3 missed days. Branch
  `feature/garden-cron`."
- **orange-agent (Frontend):** "Add a shareable README badge route
  `GET /badge/:user.svg` and show the markdown snippet in the client. Branch
  `feature/garden-badge`."
- **purple-agent (Docs):** "Write `commit-garden/CONTRIBUTING.md` and expand the
  README with screenshots and the growth-stage table. Branch `chore/garden-docs`."

> Tip: keep each task small and specific (goal + scope + 'done' criteria +
> branch). The agent edits files, pushes the branch and opens a PR.
