# 📓 Changelog

Registro delle modifiche di SAMS. Il formato si ispira a
[Keep a Changelog](https://keepachangelog.com/it/1.1.0/); le date sono in formato
`AAAA-MM-GG`. La storia più ampia (motivazioni, brainstorming) vive nei file
`ROADMAP*.md`; qui c'è l'elenco puntuale di cosa è cambiato.

## [Non rilasciato]

### 2026-07-05 — PWA: SAMS diventa una web app installabile 📲
- **Added** — `public/manifest.webmanifest`: manifest PWA (name/short_name,
  `display: standalone`, theme/background color, 5 icone 192/512 in versione
  *any* e *maskable*).
- **Added** — `public/sw.js`: service worker che rende l'app **offline-capable**
  (network-first sul guscio SPA, stale-while-revalidate sugli asset). **Non
  intercetta mai** `/api/**` (lo stream SSE `/api/events`), `/u/**` né richieste
  non-GET, così realtime e mutazioni restano intatti.
- **Added** — `src/lib/pwa.ts`: registra il service worker **solo** nelle build
  di produzione (mai in `npm run dev`).
- **Added** — `scripts/gen-icons.mjs`: genera le icone PNG dal robottino di
  `favicon.svg` (supersampling 4× + encoder PNG puro, nessun rasterizzatore
  esterno) → `icon-192/512`, `maskable-192/512`, `apple-touch-icon`.
- **Changed** — `index.html`: link al manifest + meta `apple-touch-icon` /
  standalone per iOS; `viewport-fit=cover`.
- **Docs** — README: nuova sezione "Install it as an app (PWA)".
- _Verifica_: typecheck, lint, build verdi; build servita con `vite preview` →
  manifest `application/manifest+json`, `sw.js`, icone e index tutti `200`.

### 2026-07-05 — Trigger temporali / routine ⏰ (frontiera #1 completa)
- **Added** — `server/src/routines.ts` (puro): una `Routine` in modalità
  `interval` (ogni N min) o `daily` (a HH:MM locale); `sanitizeRoutine`,
  `isDue`, `nextRun`, `dueRoutines`, `describeSchedule`. +11 test.
- **Added** — persistenza SQLite: tabella `routines` + CRUD in `db.ts`
  (`listRoutines`/`insertRoutine`/`deleteRoutine`/`setRoutineEnabled`/
  `markRoutineRun`). +3 test.
- **Added** — endpoint `GET/POST/DELETE /api/routines` + `/toggle` e uno
  **scheduler** (tick 30s) che, se il runtime è pronto e c'è una UI connessa,
  emette un `wake` con `source: "routine"`.
- **Added** — UI `Routines` nel pannello Live Sim; helper fetch in `backend.ts`.
- **Changed** — `WakeBridge`: i wake `source: "routine"` si assegnano **sempre**
  (la routine abilitata è l'opt-in); i `source: "webhook"` restano gated dal
  toggle esistente. `WireEvent.wake` / `RemoteUpdate.wake` estesi con `source`.
- _Test_: server 149 → 163.

### 2026-07-05 — Reazioni a catena ⛓ (pipeline dichiarative)
- **Added** — `src/lib/chains.ts` (puro): una `ChainRule`
  (`when`/`fromRole`/`target`/`title`/`branch`/`enabled`) automatizza la
  staffetta; `ruleMatches` (filtri + guardia anti-loop diretto), `matchingChains`,
  `chainTitle` (segnaposto `{task}`), `chainSummary`. +10 test.
- **Added** — store: slice `chains` persistito +
  `addChain`/`updateChain`/`removeChain`/`toggleChain` (con migrazione).
- **Added** — `ChainBridge`: al passaggio di un agente in "done" assegna (o
  accoda) il follow-up al target — arco di handoff + affinità come un relay,
  con cooldown per-regola anti-cascata.
- **Added** — UI `ChainRules` nel pannello Live Sim.
- _Test_: client 226 → 236.

---

## Capitoli precedenti (sintesi)

Le versioni storiche sono tracciate per intero, con lo stato di ogni item, nei
file dedicati:

- **Capitolo 3** — [`ROADMAP3.md`](./ROADMAP3.md): mondo reattivo (webhook in
  ingresso, MCP, reazioni a catena, routine), mondo raccontabile (replay,
  immagine OG, giardini di team, dashboard pubblica, diario del mondo),
  profondità simulativa (relazioni, obiettivi, economia del token, meta-agente
  proattivo). Frontiera "mondo condiviso" rimandata al capitolo 4.
- **Capitolo 2** — [`ROADMAP2.md`](./ROADMAP2.md): persistenza SQLite, diff
  preview + gate CI, Live Simulation, meta-agente, bisogni/energia, suoni,
  narrazione vocale, skill tree, marketplace di template.
- **Capitolo 1** — [`ROADMAP.md`](./ROADMAP.md): stanza 3D viva, agenti autonomi
  multi-provider, Commit Garden, runtime Express con SSE.

## Prossimo

Il capitolo 4 — [`ROADMAP4.md`](./ROADMAP4.md) — porta SAMS da demo personale a
**prodotto condiviso**: multiplayer/presence, stato del mondo autorevole sul
server, deploy & hosting, layout mobile davvero usabile, collaborazione fra
agenti reali.
