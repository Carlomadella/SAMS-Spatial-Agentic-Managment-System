# 🗺️ SAMS — Roadmap 2 (il capitolo successivo)

La **Roadmap 1** (`ROADMAP.md`) è completata: stanza 3D viva, agenti autonomi
multi-provider (Gemini / Groq / Claude), Commit Garden con stagioni e biomi,
runtime Express con SSE, onboarding, test e2e. A seguire è arrivato un **pass di
qualità** che ha consolidato le fondamenta:

- runtime de-duplicato in un unico livello `agentTools.ts` (tool specs, dispatcher,
  finalize condivisi tra i provider);
- HTTP irrobustito (`http.ts`: timeout, parse difensivo, `HttpError` con status);
  validazione repo/path GitHub; segreti a `chmod 600`; SSE senza leak; middleware
  errori; `pendingBuffer` con TTL;
- **ESLint vero** in CI; suite test salita a 50.

Questa seconda roadmap parte da lì: meno "far funzionare le cose", più
**profondità, fiducia e scala**.

> **Come si mantiene questo file**
> Stesse regole della Roadmap 1: nuove idee in cima alle sezioni, stati aggiornati,
> **Log datato** in fondo.
>
> **Legenda stato:** 💡 idea · 🔜 prossimo · 🏗️ in corso · ✅ fatto · ❄️ in pausa
> **Impatto/Effort:** 🟢 basso · 🟡 medio · 🔴 alto

---

## 🧭 La tensione di fondo: *sandbox* → *simulazione*

Il README lo dice: «v1 **sandbox manuale**: sei tu a guidare tutto». Ma il claim è
*"The Sims per agenti AI"*, e nei Sims i personaggi hanno **autonomia, bisogni,
obiettivi**. Oggi un agente agisce solo se gli assegni un task. Questo è il gap
concettuale numero uno — e i mattoncini (`IdleBridge`, `relay_task`, code
per-agente, `gh_create_issue`/`gh_list_prs`) **esistono già**: manca il loop che li
collega.

## 🎯 Le 3 scommesse (in ordine di esecuzione)

| # | Scommessa | Perché | Effort | Stato |
|---|-----------|--------|--------|-------|
| 1 | **Fondamenta dati + sicurezza** — SQLite + test sullo store | Abilitatore nascosto (storico, metriche, multi-utente) e rete di sicurezza sulla logica più delicata | 🟡 | ✅ |
| 2 | **Fiducia** — diff preview in-app + `run_tests` reali + gate CI | Senza fiducia resta una demo; con essa diventa usabile su repo veri | 🟡 | 🏗️ |
| 3 | **Autonomia** — Live simulation mode | Trasforma il prodotto dal claim alla realtà; richiede #1 e #2 come base | 🔴 | ✅ |

> Sequenza voluta: prima le fondamenta (#1), poi la fiducia (#2), infine
> l'autonomia (#3) che ha bisogno di entrambe.

---

## 🧠 Intelligenza & autonomia degli agenti
- [x] ✅ **Live simulation mode** (scommessa #3) — gli agenti pescano task da soli da
      una coda (GitHub issues con label `sams`), lavorano, aprono PR, tornano idle e ne
      prendono un altro. Da "tu comandi" a "tu supervisioni". _Implementato:_ tab "Live Sim"
      nel BottomPanel; `simLoop.ts` con claim atomico server-side; `SimBridge` che
      auto-approva, auto-libera e auto-assegna; 123 test totali.
- [ ] 💡 **Bisogni/mood** — energia che cala con task lunghi, pausa caffè in lounge,
      umore legato all'esito (PR mergiata = festa, CI rossa = testa bassa). Comunica lo
      stato reale e dà vita alla scena.
- [ ] 💡 **Specializzazioni che contano** — oggi i ruoli sono solo prompt; renderli
      comportamenti distinti (il Tester rifiuta codice di produzione, l'Architetto
      produce solo design-doc).
- [ ] 💡 **Piano rivedibile** — l'utente modifica/riordina i passi di `announce_plan`
      prima che l'agente proceda.
- [ ] 💡 **Memoria di progetto persistente** — memoria per-agente che sopravvive tra i
      task (decisioni prese, cosa è già stato fatto). Richiede #1 (SQLite).
- [ ] 💡 **Meta-agente** 🤯 — un agente il cui repo target *è SAMS stesso*: propone
      migliorie e apre PR sul progetto. Auto-miglioramento dimostrabile.

## 🔒 Fiducia & verifica (scommessa #2)
- [x] ✅ **Diff preview in-app** — il pannello di approvazione mostra un vero diff
      prima/dopo (LCS, righe colorate +/− con conteggio) confrontando il contenuto
      staged con quello attuale del repo (`GET /api/file` + `lib/diff.ts`).
- [ ] 💡 **`run_tests` in sandbox** — strumento che lancia davvero la suite e fa
      autocorreggere l'agente sui fallimenti reali (oggi l'auto-verifica è solo
      "mentale" via prompt: l'agente *dice* di aver controllato i test).
- [ ] 💡 **Gate su CI** — non aprire/mergiare finché GitHub Actions non è verde (i tool
      `gh_list_ci` ci sono già; manca il loop che li usa per decidere).
- [x] ✅ **Segnalare il troncamento del loop** — quando l'agente esaurisce i `MAX_STEPS`
      senza chiamare `done`, emette un WARN esplicito invece di concludere in silenzio.

## 🔌 Strumenti & integrazioni
- [x] ✅ **Retry/backoff centralizzato** in `http.ts` (onora `Retry-After`) per i metodi
      idempotenti (GET/HEAD); POST/PATCH/PUT non vengono ritentati per non duplicare
      scritture. _Resta da fare:_ commit multi-file atomico (sotto).
- [ ] 💡 **Commit multi-file atomico** via Git Data API (tree+commit) invece di N PUT
      sequenziali sull'endpoint Contents (evita commit parziali e conflitti di `sha`).
- [x] ✅ **GitHub: merge / è-mergeabile / stato check** — strumenti `gh_pr_status`
      (mergeable + check CI, sola lettura) e `gh_merge_pr` (merge/squash/rebase).
- [ ] 💡 **Notion: database** (creare/aggiornare righe), non solo pagine.
- [ ] 💡 **Webhook in ingresso** — eventi GitHub (push/PR/CI) che svegliano gli agenti.
- [ ] 💡 **Sfruttare gli MCP** — report su Google Drive, eventi su Calendar, grafiche su
      Canva come strumenti agente.

## 📊 Osservabilità
- [x] ✅ **Storico & costo nel tempo** — `task_log` SQLite alimentato a ogni task
      concluso; tab **History** nel BottomPanel + totali cumulativi (`lifetime`) in
      `/api/metrics`. Sopravvive ai riavvii.
- [x] ✅ **Endpoint `/api/metrics`** — eventi, task avviati/completati, errori, uptime,
      UI connesse, più i totali durevoli; visibile anche nel System Overview.
- [ ] 💡 **Logging strutturato** lato runtime (livelli, niente segreti).

## 🎮 Mondo 3D (feel "The Sims")
- [ ] 💡 **Pathfinding attorno ai mobili** (oggi i percorsi sono in linea retta e
      attraversano le scrivanie).
- [ ] 💡 **Camera cinematografica** che segue dolcemente l'agente selezionato con
      inquadrature e transizioni (estende l'attuale `CameraFollow`).
- [ ] 💡 **Mobili davvero vivi** — il monitor mostra il *diff reale* del file in
      scrittura; la media-wall i task in coda (oggi solo titolo + progresso).
- [ ] 💡 **Replay cinematografico** di un task completato — ottimo per demo/condivisione.
- [ ] 💡 **Animazioni extra** — disegnare sulla lavagna, caffè, stretching.
- [ ] 💡 **Suoni ambientali** legati al ciclo giorno/notte già esistente.

## 🌿 Commit Garden
- [ ] 💡 **Garden connesso agli agenti** — completare un task innaffia la pianta: il
      lavoro reale fa crescere il giardino (oggi sono due mondi separati).
- [ ] 💡 **Immagine OG condivisibile** — esporta il giardino come PNG (canvas/OG meta)
      per i social. (Rimasto dalla Roadmap 1.)
- [ ] 💡 **Giardini di team / organizzazione** — vista aggregata di tutti i contributor.
- [ ] 💡 **Eventi stagionali** — fioriture speciali, decorazioni a tema.
- [ ] ❄️ **Auto-innaffiatura via webhook** — opzionale (oggi refresh manuale, scelta voluta).

## 🤝 Collaborazione & multi-utente
- [ ] 💡 **Presence in tempo reale** — più utenti vedono gli stessi agenti muoversi.
- [ ] 💡 **Visualizzazione degli handoff** — una "linea" 3D quando un agente fa
      `relay_task` verso un altro.
- [ ] 💡 **Ruoli/permessi** sul workspace (chi assegna task, chi solo osserva).
- [ ] 💡 **Marketplace di "template agente"** (ruolo + istruzioni + modello) condivisibili.

## 🛠️ Solidità & produzione (engineering)
- [x] ✅ **Test frontend** (scommessa #1) — Vitest + jsdom: 37 test su store
      (`applyRemote`, coda, relay, lifecycle), orchestrazione (relay/idle/coda, estratta
      in `lib/orchestration.ts`), `zoneForTitle`/`clampToRoom` e `isValidRepo`. La logica
      dei bridge è ora in helper puri testati. _Manca:_ test di rendering dei componenti.
- [x] ✅ **Persistenza su SQLite** (scommessa #1) — `db.ts` usa il builtin `node:sqlite`
      (nessuna dipendenza nativa). Tabella `task_log` durevole alimentata dai loop di
      tutti i provider; endpoint `/api/history` + `/api/metrics` (lifetime) + tab History.
      _Resta opzionale:_ migrare anche settings/garden da JSON a SQLite.
- [ ] 💡 **Auth opzionale sul runtime** — header con token locale per le route mutanti;
      bind `127.0.0.1` in dev, `0.0.0.0` solo in container.
- [ ] 💡 **Pre-commit hook** (husky + lint-staged) — lint+typecheck prima del commit.
- [ ] 💡 **Coverage in CI** — soglia minima su `agentTools`, `http`, `garden/model`.
- [ ] 💡 **i18n** — oggi i messaggi mescolano IT/EN; estrarre le stringhe e scegliere una
      lingua di default.

## ♿ UX / Accessibilità
- [ ] 🏗️ **Accessibilità** — ✅ nomi accessibili (aria-label/aria-pressed) sui pulsanti
      icona-only di TitleBar/ActivityBar/Toaster/modali + toast in live region. _Manca:_
      navigazione da tastiera nel 3D e il resto degli elementi interattivi.
      (`eslint-plugin-jsx-a11y` non installabile finché non supporta ESLint 10.)
- [ ] 💡 **Tour interattivo** post-onboarding (evidenzia inspector, scena, garden):
      l'onboarding spiega i *concetti*, non l'*UI*.
- [ ] 💡 **Mobile usabile** — sotto i 768px i pannelli collassano ma scena+inspector non
      sono davvero usabili.
- [ ] 💡 **Tema chiaro/scuro** rifinito su tutti i pannelli (alcuni colori sono hardcoded).

## 🃏 Wild cards
- [ ] 💡 **Narrazione vocale** di cosa fanno gli agenti (TTS sugli eventi SSE).
- [ ] 💡 **Skill tree** — gli agenti sbloccano abilità/decorazioni completando task.
- [ ] 💡 **Ufficio multiplayer** — più umani nello stesso workspace in tempo reale.

---

## 🗒️ Log dei brainstorming (Roadmap 2)

### 2026-06-28 — implementazione: Live Simulation mode ✅ (scommessa #3 completa)
Agenti autonomi che pescano GitHub issues con label configurabile (default `sams`):
- **`simLoop.ts`** (server) — claim atomico in-memory (`Map<issueNumber, {agentId, claimedAt}>`);
  Node.js single-threaded garantisce atomicità senza lock esterni. Label `sams:in-progress`
  aggiunta/rimossa su GitHub come effetto collaterale visibile.
- **6 endpoint REST** — `/api/sim/start`, `/api/sim/stop`, `/api/sim/status`,
  `/api/sim/issues`, `/api/sim/claim/:n`, `/api/sim/release/:n`.
- **`SimBridge.tsx`** (frontend) — bridge invisibile che: (1) polling 30 s;
  (2) rilevamento `wasActive → isNowIdle` via `useStore.subscribe`; (3) auto-approve
  dei file staged così il ciclo non si blocca sull'approvazione manuale; (4) auto-clear
  dello status `review` → `idle` per riavviare il loop.
- **`LiveSimPanel.tsx`** — tab "Live Sim" nel BottomPanel con toggle start/stop, lista
  issues con claim status e link GitHub, istruzioni inline.
- **11 test per `simLoop.ts`** — test totali: **123** (81 server, 42 frontend).

### 2026-06-27 — implementazione (giro 3): diff preview ✅ (scommessa #2 avviata)
Diff preview reale in 3 sotto-passi: (1) `lib/diff.ts` LCS puro + test;
(2) `GET /api/file` + client `fetchFile` per il contenuto "prima"; (3)
`StagedFileDiff` nel pannello di approvazione (righe +/− colorate, +N/−M).
112 test. _Restano in #2:_ `run_tests` reali in sandbox (decisione aperta:
quale comando eseguire e con quale isolamento) e il gate su CI.

### 2026-06-27 — implementazione (giro 2): SQLite ✅ (scommessa #1 completa)
Persistenza durevole in 3 sotto-passi committati:
- **db.ts** con `node:sqlite` (builtin Node 22 — zero dipendenze native, niente
  problemi Docker/alpine); tabella `task_log` + helper testati con `:memory:`.
- **Cablaggio**: ogni task concluso (Gemini/Groq via `finalizeTask`, Claude via
  `sessions.ts`) viene registrato; `GET /api/history` + `lifetime` in `/api/metrics`.
- **UI**: tab **History** nel BottomPanel + metriche live nel System Overview.
Con i test frontend del giro 1, la **scommessa #1 è completa**. 107 test totali.
- 🔜 **Prossimo**: scommessa #2 (fiducia) — diff preview reale, partendo da una
  util di diff pura e testata.

### 2026-06-27 — implementazione (giro 1 della Roadmap 2)
Avviata l'esecuzione in ordine di priorità, a piccoli incrementi committati.
- ✅ **Test frontend** (scommessa #1): Vitest + jsdom, suite da 0 a 37 test
  (store, orchestrazione, world, validation). Logica dei bridge estratta in
  `lib/orchestration.ts` (relay-matching, idle/coda) e testata.
- ✅ **Troncamento del loop**: WARN esplicito quando si esauriscono i `MAX_STEPS`.
- ✅ **Retry/backoff** in `http.ts` su GET/HEAD (onora `Retry-After`); POST non
  ritentati per non duplicare scritture.
- ✅ **Dispatcher `executeTool`** coperto da test (done/plan/relay/web_fetch/…).
- ✅ **A11y**: nomi accessibili sui controlli icona-only + toast in live region.
- ✅ **Validazione `owner/repo`** nel form impostazioni con hint inline.
- Test totali: **96+** (62 server, 37 frontend). `eslint .` pulito, build verde.
- 🔜 **Prossimo**: SQLite (scommessa #1, persistenza), poi diff preview reale
  (scommessa #2). Sono i due item più grandi: da affrontare con cura e test.

### 2026-06-27 — brainstorming approfondito + riorganizzazione
Sessione di brainstorming sull'evoluzione del prodotto, partendo da ciò che è
emerso *dentro* il codice durante il pass di qualità. Emersa la tensione di fondo
**sandbox → simulazione** e tre scommesse in sequenza: (1) fondamenta dati +
test, (2) fiducia (diff/run_tests/CI), (3) autonomia (live simulation). Aggiunte
nuove idee: meta-agente, bisogni/mood, garden connesso agli agenti, osservabilità
(storico/costo, `/api/metrics`), replay cinematografico, narrazione vocale, skill
tree, marketplace di template. Prossimo passo operativo: scommessa #1, a partire
dai **test frontend sullo store** (più sicuri da fare a piccoli passi).

### 2026-06-27 — apertura Roadmap 2
Nata dopo il completamento della Roadmap 1 e un pass di qualità dedicato:
de-duplicazione del runtime (`agentTools.ts`), `http.ts` condiviso, validazione
repo/path GitHub, segreti a `0600`, SSE senza leak, middleware errori,
`pendingBuffer` con TTL, **ESLint** reale in CI e suite test a 50.
