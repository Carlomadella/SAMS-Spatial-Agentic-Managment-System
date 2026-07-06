# 📓 Changelog

Registro delle modifiche di SAMS. Il formato si ispira a
[Keep a Changelog](https://keepachangelog.com/it/1.1.0/); le date sono in formato
`AAAA-MM-GG`. La storia più ampia (motivazioni, brainstorming) vive nei file
`ROADMAP*.md`; qui c'è l'elenco puntuale di cosa è cambiato.

## [Non rilasciato]

### 2026-07-07 — Presence con nomi + canale bidirezionale 👤
- **Added** — `server/src/presence.ts` (puro): `sanitizeObserverIdentity`,
  `distinctPeople` (deduplica per id, ordine stabile), `presenceState`. +9 test.
- **Changed** — `clients` da `Set<Response>` a `Map<Response,Observer>`;
  `broadcastPresence` invia anche `people` (nomi distinti) oltre a `presence`
  (conteggio, invariato per retro-compatibilità). L'identità arriva dai query param
  dell'EventSource al connect (`/api/events?v=…&n=…`).
- **Added** — POST `/api/presence` (rate-limited 20/30s): rinomina una vista a
  caldo, senza riconnettere l'EventSource (canale client→server). Aggiorna tutte le
  connessioni con lo stesso id e ri-annuncia la presence via SSE.
- **Added** — client: `viewerId` stabile in localStorage (deduplica le schede),
  `announcePresence`; store slice `people`; `presenceTooltip`/`sanitizePeople` in
  `lib/presence.ts` (+7 test); `StatusBar` elenca i nomi nel tooltip del badge 👁;
  `ChatPanel` annuncia il nome sul blur.
- **Added** — roster presence in cima al `ChatPanel`: mostra live *chi* sta
  guardando (chip con i nomi) e `watchingLabel` per il conteggio delle persone
  distinte (fallback alle viste). +3 test.
- _Verifica_: end-to-end sul runtime — 2 viste con nomi (`Ada`, `Bob`) + una
  anonima (`Ospite`, client senza query param) e rename live `Ada → Ada Lovelace`
  propagato via SSE (`changed:1`).

### 2026-07-06 — Osservabilità del workspace condiviso 📈
- **Added** — `metrics.ts`: contatori `chatMessages` (cumulativo) e `peakClients`
  (picco di viste connesse simultaneamente), esposti in `/api/metrics`;
  `recordChatMessage`/`recordClients`. +3 test.
- **Added** — log strutturati "Vista connessa/disconnessa" con il numero di viste.
- **Added** — `SystemOverview` mostra 👁 viste correnti·picco quando ci sono viste.
- _Verifica_: end-to-end — 2 viste + 2 messaggi → `clients:2, chatMessages:2,
  peakClients:2`; dopo la disconnessione `clients:0` ma il picco resta.

### 2026-07-06 — Rate-limit sulla chat 🚦 (workspace condiviso)
- **Added** — `server/src/rateLimit.ts` (puro): `createRateLimiter(max, windowMs)`
  a finestra scorrevole con `now` iniettabile (`hit`/`retryAfterMs`), memoria per
  chiave limitata a `max`. +5 test.
- **Added** — POST `/api/chat` applica il limiter per IP (max 10 msg/30s): oltre
  soglia risponde `429` con `retryAfterSec`. Il `ChatPanel` mostra un avviso e
  conserva il testo per il retry.
- _Verifica_: end-to-end — 10 POST → 200, dall'11° → 429 "riprova tra 29s".

### 2026-07-06 — Presence anche nella dashboard pubblica 👁
- **Added** — `buildPublicSnapshot` include `viewers` (clamp a intero ≥ 0) e
  `/api/public` passa `clients.size`; la `PublicDashboard` mostra "N stanno
  guardando" accanto allo stato runtime. +1 test.
- _Verifica_: end-to-end sul runtime reale — `viewers` 0 → 2 (due stream SSE) → 0.

### 2026-07-06 — Chat: badge messaggi non letti 🔴 (frontiera #2)
- **Added** — `src/lib/chat.ts` (puro): `countsAsUnread` (non conta i propri
  messaggi né quando la chat è attiva) e `unreadBadge` (cap "9+"). +7 test.
- **Added** — store: campo transiente `chatUnread`, incrementato in `applyRemote`
  all'arrivo di un messaggio altrui mentre la Chat non è il tab attivo; azzerato
  aprendo il tab e da `markChatRead` (chiamato dal `ChatPanel` al mount/aggiornamento).
- **Added** — `BottomPanel`: badge con il conteggio non letti sul tab **Chat**.
- _Test_: client 258 → 265.

### 2026-07-06 — Chat di workspace 💬 (frontiera #2)
- **Added** — `server/src/chat.ts` (puro): `sanitizeChatInput` (autore con
  fallback "Ospite", testo con trim/clamp). +4 test.
- **Added** — persistenza SQLite: tabella `chat_messages` + `listChatMessages`/
  `insertChatMessage` in `db.ts` (prune agli ultimi 200). +3 test.
- **Added** — endpoint `GET/POST /api/chat`: i messaggi si persistono e si
  rimbalzano via SSE a tutte le viste (`WireEvent.chat`, fuori da `recordEvent`).
- **Added** — client: slice `chatMessages` (server-owned, non persistito) +
  `chatName` (persistito); `applyRemote` intercetta l'evento `chat`; hydrate della
  chat al connect; helper `fetchChat`/`sendChat`.
- **Added** — `ChatPanel` + tab **Chat** nel pannello in basso e comando palette
  "Apri Chat di workspace".
- _Verifica_: end-to-end sul runtime reale — `GET` vuoto → `POST` → broadcast SSE
  `chat` ricevuto + persistenza confermata; `POST` vuoto → 400.

### 2026-07-06 — Presence: osservatori connessi 👁 (frontiera #2, primo slice)
- **Added** — `src/lib/presence.ts` (puro): `sanitizeObservers`, `observerLabel`,
  `observerBadge`, `isShared` per il badge presence. +9 test.
- **Added** — il runtime rimbalza via SSE quante viste sono collegate:
  `broadcastPresence()` su connect/disconnect (fuori da `recordEvent`, così non
  gonfia le metriche degli eventi runtime); `WireEvent.presence`. `cleanup` del
  client SSE reso idempotente (close + error contano il drop una volta sola).
- **Added** — store: campo transiente `observers` (mai persistito), aggiornato da
  `applyRemote` che intercetta l'evento `presence` senza toccare agenti/task/eventi;
  `setBackendOnline(false)` lo riporta a 1.
- **Added** — `StatusBar`: badge 👁 con il conteggio delle viste, evidenziato quando
  il mondo è condiviso (più di una vista) e con tooltip descrittivo.
- _Test_: client 246 → 258.

### 2026-07-05 — Roadmap 4: avvio (fondazione + prodotto) 🚀
- **Added** — multi-repo per-agente: campo `Agent.repo` + override in `metaRepo`
  (`isValidRepo`) e sezione "Repository" nell'inspector; i task dell'agente
  lavorano sul repo scelto.
- **Added** — deploy "one-click": `docs/DEPLOY.md` + Blueprint Render `render.yaml`.
- **Added** — riepilogo `world` (agenti/attivi/idle) dallo snapshot autorevole,
  esposto in `GET /api/public` e mostrato nella dashboard pubblica.
- **Added** — stato autorevole del mondo, primo slice: `server/src/worldState.ts`
  (puro) + tabella SQLite `world_snapshot` + `GET/POST /api/world` +
  `WorldSyncBridge` (push snapshot, throttle 20s). Il mondo sopravvive al refresh.
- **Added** — tour interattivo dell'interfaccia: `src/lib/tour.ts` (+ `placeTourCard`
  puro, card sempre nel viewport) e `Tour.tsx` con spotlight sugli elementi
  `data-tour`; auto-avvio dopo l'onboarding + comando "Avvia tour".
- **Added** — notifica "nuova versione" della PWA (`pwa.ts` rileva l'update del SW).
- **Added** — palette comandi estesa (Live Sim/routine/reazioni, Replay, Diario,
  Cronologia, Task, Impostazioni, tema, toggle meta/webhook, tour).
- **Changed** — `playwright.config.ts` cross-platform: usa il Chromium della CI
  solo in CI, altrimenti quello gestito da Playwright (e2e eseguibili in locale).
- **Fixed** — la card del passo 4/6 del tour (inspector) finiva fuori schermo.
- **Removed** — sezione "Risposte · cronologia" (AgentThread) dall'inspector: non
  compare più al click su un agente (le risposte restano nell'Event Log/Cronologia).
- _Test_: client 236 → 246, server 163 → 173.

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
**prodotto condiviso**: presence realtime, ruoli/permessi, stato del mondo
autorevole sul server, deploy & hosting, collaborazione fra agenti reali.
