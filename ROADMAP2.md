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

> ➡️ **Il capitolo successivo vive in [`ROADMAP3.md`](./ROADMAP3.md)** (il _mondo
> condiviso_: webhook in ingresso, MCP, replay, giardini di team, presence
> realtime, multiplayer). Gli item ancora aperti qui sono ereditati lì.

> **Come si mantiene questo file**
> Stesse regole della Roadmap 1: nuove idee in cima alle sezioni, stati aggiornati,
> **Log datato** in fondo.
>
> **Legenda stato:** 💡 idea · 🔜 prossimo · 🏗️ in corso · ✅ fatto · ❄️ in pausa
> **Impatto/Effort:** 🟢 basso · 🟡 medio · 🔴 alto

> ### ✅ Chiusura (2026-07-08)
> Gli item ancora `[ ]` qui sono stati **risolti nelle Roadmap 3–4** (dove figurano ✅),
> sono **in pausa voluta**, oppure restano **idee non perseguite** che richiedono una
> decisione di prodotto o un'integrazione esterna.
> - **Fatti (R3/R4):** webhook in ingresso, replay cinematografico, immagine OG
>   condivisibile, giardini di team, presence realtime, ruoli/permessi, tour interattivo,
>   tema chiaro/scuro, ufficio multiplayer.
> - **In pausa voluta (❄️):** auto-innaffiatura via webhook (oggi refresh manuale).
> - **Non perseguiti — servono scelte/integrazioni esterne, non fatti in autonomia:**
>   "Sfruttare gli MCP" per produrre report su Google Drive / eventi su Calendar /
>   grafiche su Canva (richiede credenziali e una decisione di prodotto).

---

## 🧭 La tensione di fondo: _sandbox_ → _simulazione_

Il README lo dice: «v1 **sandbox manuale**: sei tu a guidare tutto». Ma il claim è
_"The Sims per agenti AI"_, e nei Sims i personaggi hanno **autonomia, bisogni,
obiettivi**. Oggi un agente agisce solo se gli assegni un task. Questo è il gap
concettuale numero uno — e i mattoncini (`IdleBridge`, `relay_task`, code
per-agente, `gh_create_issue`/`gh_list_prs`) **esistono già**: manca il loop che li
collega.

## 🎯 Le 3 scommesse (in ordine di esecuzione)

| #   | Scommessa                                                       | Perché                                                                                               | Effort | Stato |
| --- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------ | ----- |
| 1   | **Fondamenta dati + sicurezza** — SQLite + test sullo store     | Abilitatore nascosto (storico, metriche, multi-utente) e rete di sicurezza sulla logica più delicata | 🟡     | ✅    |
| 2   | **Fiducia** — diff preview in-app + `run_tests` reali + gate CI | Senza fiducia resta una demo; con essa diventa usabile su repo veri                                  | 🟡     | 🏗️    |
| 3   | **Autonomia** — Live simulation mode                            | Trasforma il prodotto dal claim alla realtà; richiede #1 e #2 come base                              | 🔴     | ✅    |

> Sequenza voluta: prima le fondamenta (#1), poi la fiducia (#2), infine
> l'autonomia (#3) che ha bisogno di entrambe.

---

## 🧠 Intelligenza & autonomia degli agenti

- [x] ✅ **Live simulation mode** (scommessa #3) — gli agenti pescano task da soli da
      una coda (GitHub issues con label `sams`), lavorano, aprono PR, tornano idle e ne
      prendono un altro. Da "tu comandi" a "tu supervisioni". _Implementato:_ tab "Live Sim"
      nel BottomPanel; `simLoop.ts` con claim atomico server-side; `SimBridge` che
      auto-approva, auto-libera e auto-assegna; 123 test totali.
- [x] ✅ **Bisogni/mood** — `Agent.energy` (0..100) cala con il progresso del task (ogni
      7% di avanzamento drena 1pt di energia), si recupera a idle. `Agent.mood` calcolato
      da `moodFor(status, energy)`: blocked=frustrated, done/review=proud, idle+alta=happy,
      bassa energia=tired, working=focused. Visualizzato in AgentInspector con barra
      colorata + emoji. 6 nuovi test.
- [x] ✅ **Specializzazioni che contano** — ROLE_PROMPTS con VINCOLI ASSOLUTI comportamentali:
      Revisore non modifica codice, Tester scrive solo \*.test.ts, Documentatore solo .md/Notion,
      Architetto solo design-doc. System prompt ciclo CI aggiornato a gh_trigger_workflow.
- [x] ✅ **Piano rivedibile** — i passi di `announce_plan` sono cliccabili nell'inspector:
      click → spunta verde + testo barrato. Contatore "X/N completati". Reset automatico
      al cambio di agente/task.
- [x] ✅ **Memoria di progetto persistente** — tool `remember`/`recall` (universali);
      tabella SQLite `agent_memory`; memorie iniettate nel system prompt; pannello UI
      nell'inspector con visualizzazione e cancellazione; API REST GET/DELETE `/api/memory/:id`.
- [x] ✅ **Meta-agente** 🤯 — un agente il cui repo target _è SAMS stesso_: propone
      migliorie e apre PR sul progetto. Toggle "🤯 Meta" nell'AgentInspector +
      selettore di spunti (`META_IDEAS`: test, a11y, docs, roadmap, refactor). Il
      retargeting del repo è per-task e concurrency-safe: `runWithRepo`/`currentRepo`
      via `AsyncLocalStorage` in `github.ts`, pilotato dal campo `repo` di
      `AssignBody` (validato in `/api/assign`). Logica pura in `lib/metaAgent.ts`
      (`SAMS_REPO`, `metaRepo`, `slugifyBranch`, `buildMetaTask`). 13 nuovi test
      (8 client + 5 server).
- [x] ✅ **Fame / nutrimento** 🍽️ — `Agent.hunger` (0 sazio … 100 affamato) cresce nel
      tempo (`HungerBridge`, +1 ogni 7s → `growHunger`); assegnare un task **sfama**
      (−45 in `assignTask`) e c'è uno spuntino manuale (`feedAgent`, pulsante 🍽️
      nell'inspector). Un agente affamato (≥80) diventa `tired` (`moodFor` esteso con la
      fame). Barra Fame nell'AgentInspector + indicatore 🍽️ in 3D quando ≥75. 4 test.

## 🔒 Fiducia & verifica (scommessa #2)

- [x] ✅ **Diff preview in-app** — il pannello di approvazione mostra un vero diff
      prima/dopo (LCS, righe colorate +/− con conteggio) confrontando il contenuto
      staged con quello attuale del repo (`GET /api/file` + `lib/diff.ts`).
- [x] ✅ **`gh_trigger_workflow`** — tool che avvia un workflow CI via `workflow_dispatch`
      su un branch; l'agente usa poi `gh_list_ci` + `gh_ci_jobs` per leggere i risultati
      e autocorreggersi prima di aprire la PR. System prompt aggiornato con il ciclo
      "scrivi → trigger → controlla CI → correggi → mergia".
- [x] ✅ **Gate su CI + `gh_ci_jobs`** — tool `gh_ci_jobs(run_id)` che restituisce job +
      step falliti di un run CI; system prompt aggiornato a insegnare agli agenti il ciclo
      "controlla CI → leggi failure → correggi → ri-controlla → mergia solo se verde".
- [x] ✅ **Segnalare il troncamento del loop** — quando l'agente esaurisce i `MAX_STEPS`
      senza chiamare `done`, emette un WARN esplicito invece di concludere in silenzio.

## 🔌 Strumenti & integrazioni

- [x] ✅ **Retry/backoff centralizzato** in `http.ts` (onora `Retry-After`) per i metodi
      idempotenti (GET/HEAD); POST/PATCH/PUT non vengono ritentati per non duplicare
      scritture. _Resta da fare:_ commit multi-file atomico (sotto).
- [x] ✅ **Commit multi-file atomico** via Git Data API (tree+commit) invece di N PUT
      sequenziali sull'endpoint Contents (evita commit parziali e conflitti di `sha`).
      Nuovo tool `gh_write_files` (array di file → un commit); flusso di approvazione
      aggiornato a usare `writeFilesAtomic`.
- [x] ✅ **GitHub: merge / è-mergeabile / stato check** — strumenti `gh_pr_status`
      (mergeable + check CI, sola lettura) e `gh_merge_pr` (merge/squash/rebase).
- [x] ✅ **Notion: database** (creare/aggiornare righe), non solo pagine. Due tool:
      `notion_add_row` (aggiunge una riga a un DB trovato per titolo) e
      `notion_update_row` (aggiorna una riga esistente, individuata per la proprietà
      titolo). I tipi delle proprietà sono dedotti dallo schema del DB
      (title/rich_text/number/select/multi_select/url/checkbox/date) dalla funzione
      pura testata `buildDatabaseProps`; le proprietà fuori schema sono ignorate.
- [ ] 💡 **Webhook in ingresso** — eventi GitHub (push/PR/CI) che svegliano gli agenti.
- [ ] 💡 **Sfruttare gli MCP** — report su Google Drive, eventi su Calendar, grafiche su
      Canva come strumenti agente.

## 📊 Osservabilità

- [x] ✅ **Storico & costo nel tempo** — `task_log` SQLite alimentato a ogni task
      concluso; tab **History** nel BottomPanel + totali cumulativi (`lifetime`) in
      `/api/metrics`. Sopravvive ai riavvii.
- [x] ✅ **Endpoint `/api/metrics`** — eventi, task avviati/completati, errori, uptime,
      UI connesse, più i totali durevoli; visibile anche nel System Overview.
- [x] ✅ **Logging strutturato** — `log.ts` con livelli debug/info/warn/error in JSON
      (`{ t, level, msg, ...meta }`); LOG_LEVEL da env; usato in server.ts e auth middleware.

## 🎮 Mondo 3D (feel "The Sims")

- [x] ✅ **Pathfinding attorno ai mobili** — `lib/pathfind.ts` (A\* su griglia
      8-connessa senza taglio d'angolo + string-pulling, funzione pura testata);
      `OBSTACLES` in `data/world.ts`; `Agent3D` segue i waypoint girando agli angoli.
      Niente più percorsi in linea retta attraverso le scrivanie.
- [x] ✅ **Camera cinematografica** che segue dolcemente l'agente selezionato:
      ricentro + dolly-in d'inquadratura alla selezione, tracking morbido durante il
      cammino, ritorno al centro alla deselezione (estende `CameraFollow`).
- [x] ✅ **Casa 2×2 con atrio** — quattro stanze attorno a un atrio centrale
      (Studio · Cucina · Salotto · Camera), non in fila. Muri interni come **dati
      condivisi** (`WALLS`): la stessa lista disegna i muri e genera gli ostacoli,
      quindi un muro che vedi è invalicabile; porte larghe percorse dal pathfinder.
      Sei letti (uno per agente). Ciclo giorno/notte su **ora reale**.
- [x] ✅ **Agenti vivi** — di giorno TUTTI gli agenti liberi (status ≠ working)
      vagano per la casa; dopo le 23 vanno a letto e dormono (posa + "zzz"),
      risvegliandosi al mattino o con un task. `LifeBridge`/`randomWalkPoint`/`BEDS`.
- [x] ✅ **Socializzazione** — due agenti liberi vicini ogni tanto si parlano e si
      aiutano (scambio di battute come fumetti). `TalkBridge`.
- [x] ✅ **Mobili davvero vivi** — il monitor della scrivania studio mostra il file
      _reale_ che l'agente al lavoro sta scrivendo (contenuto staged + cursore), o il
      piano quando nessun file è ancora staged; la media-wall (TV) mostra la coda dei
      task di tutti gli agenti. Logica pura in `lib/sceneDisplays.ts` (`monitorView`/
      `queueBoard`), 8 test.
- [ ] 💡 **Replay cinematografico** di un task completato — ottimo per demo/condivisione.
- [x] ✅ **Animazioni extra** — gli agenti liberi fanno micro-attività in base a dove
      stanno: caffè in cucina (☕), schizzi alla lavagna (✏️), stretching altrove (🤸).
      Pose in `Agent3D` layerate sopra l'idle; `LifeBridge` instrada ogni tanto verso
      cucina/lavagna.
- [x] ✅ **Suoni ambientali** — motore WebAudio sintetizzato (`lib/audio.ts`, zero asset):
      room tone più caldo di notte, ticchettio tastiera mentre si lavora, chime sui task
      completati, buzz sugli errori; `AudioBridge` + toggle speaker (muto di default,
      persistito).

## 🌿 Commit Garden

- [x] ✅ **Garden connesso agli agenti** — `waterAgentGarden(agentName)` in `finalizeTask`:
      ogni task completato con modifiche reali innaffia la pianta SAMS dell'agente
      (`user = sams-<agentName>`). Il lavoro reale fa crescere il giardino.
- [ ] 💡 **Immagine OG condivisibile** — esporta il giardino come PNG (canvas/OG meta)
      per i social. (Rimasto dalla Roadmap 1.)
- [ ] 💡 **Giardini di team / organizzazione** — vista aggregata di tutti i contributor.
- [x] ✅ **Eventi stagionali** — ricorrenze datate (Capodanno, San Valentino,
      fioritura di primavera, solstizio, Halloween, Natale) accendono particelle
      festive del colore-accento attorno alla pianta (`FestiveParticles`) e un
      badge nel pannello giardino. Logica pura `getSeasonalEvent(date)` in
      `lib/seasonalEvents.ts` (range mutuamente esclusivi), 8 test.
- [ ] ❄️ **Auto-innaffiatura via webhook** — opzionale (oggi refresh manuale, scelta voluta).

## 🤝 Collaborazione & multi-utente

- [ ] 💡 **Presence in tempo reale** — più utenti vedono gli stessi agenti muoversi.
- [x] ✅ **Visualizzazione degli handoff** — un arco 3D tratteggiato del colore del
      mittente con un impulso che viaggia da chi delega a chi riceve quando parte un
      `relay_task` (più whoosh audio); svanisce dopo ~3s. Stato `handoffs` nello store;
      `HandoffArc`/`Handoffs` in `OfficeScene`.
- [ ] 💡 **Ruoli/permessi** sul workspace (chi assegna task, chi solo osserva).
- [x] ✅ **Marketplace di "template agente"** (ruolo + istruzioni + modello) condivisibili —
      `lib/agentTemplates.ts`: libreria curata (`AGENT_TEMPLATES`: cacciatore di bug,
      autore di test, documentatore, revisore, architetto, rifattorizzatore),
      `applyTemplate` puro, `serializeTemplate`/`parseTemplate` per la condivisione via
      JSON, `templateFromAgent` per esportare la config corrente. UI nell'AgentInspector:
      selettore "📦 Template…" (applica in un click) + "⤓ Esporta" (copia JSON negli
      appunti). 8 test.

## 🛠️ Solidità & produzione (engineering)

- [x] ✅ **Test frontend** (scommessa #1) — Vitest + jsdom: 37 test su store
      (`applyRemote`, coda, relay, lifecycle), orchestrazione (relay/idle/coda, estratta
      in `lib/orchestration.ts`), `zoneForTitle`/`clampToRoom` e `isValidRepo`. La logica
      dei bridge è ora in helper puri testati. _Manca:_ test di rendering dei componenti.
- [x] ✅ **Persistenza su SQLite** (scommessa #1) — `db.ts` usa il builtin `node:sqlite`
      (nessuna dipendenza nativa). Tabella `task_log` durevole alimentata dai loop di
      tutti i provider; endpoint `/api/history` + `/api/metrics` (lifetime) + tab History.
      _Resta opzionale:_ migrare anche settings/garden da JSON a SQLite.
- [x] ✅ **Auth opzionale sul runtime** — `SAMS_TOKEN` env: se impostato, tutte le route
      mutanti (POST /assign, /approve, /reject, /settings, /sim/start, /sim/stop) richiedono
      `Authorization: Bearer <token>`. `hasToken` in `publicStatus`. `requireAuth` middleware.
- [x] ✅ **Pre-commit hook** (husky + lint-staged) — `eslint --max-warnings=0` sui file
      TypeScript staged; il commit fallisce su ogni warning.
- [x] ✅ **Coverage in CI** — `@vitest/coverage-v8` con soglie lines≥60%, functions≥70%,
      branches≥58% sui moduli critici (`agentTools`, `http`, `garden/model`, `db`).
      CI aggiornato a usare `npm run test:coverage`.
- [x] ✅ **i18n** — lingua di default unica: **italiano**. Tutte le scritte
      utente-visibili dell'interfaccia tradotte; etichette di stato centralizzate in
      `STATUS_META` e riusate ovunque. Invariati nomi propri e token tecnici.

## ♿ UX / Accessibilità

- [x] ✅ **Accessibilità tastiera** — Tab/Shift-Tab cicla tra agenti nel canvas (salta
      se focus in input/textarea), Escape deseleziona. Funziona in sinergia con Ctrl+K.
- [ ] 💡 **Tour interattivo** post-onboarding (evidenzia inspector, scena, garden):
      l'onboarding spiega i _concetti_, non l'_UI_.
- [ ] 💡 **Tema chiaro/scuro** rifinito su tutti i pannelli (alcuni colori sono hardcoded).

## 🃏 Wild cards

- [x] ✅ **Narrazione vocale** di cosa fanno gli agenti (TTS sugli eventi) —
      `lib/narration.ts`: `narrationLine(event)` puro decide cosa pronunciare
      (completamenti, PR, errori, revisioni) e tace sul rumore (tool, 💭, 💬);
      `narrator` singleton parla via Web Speech API (it-IT). `NarrationBridge` +
      toggle 📣 flottante (spento di default, persistito). 8 test.
- [x] ✅ **Skill tree** — gli agenti guadagnano XP completando task (`Agent.xp`,
      +30 per task in `updateProgress`/`applyRemote`) e salgono di rango
      (Novizio→Apprendista→Esperto→Veterano→Maestro). Curva pura in `lib/skill.ts`
      (`levelFromXp`, 6 test); badge ⭐Lv nell'etichetta 3D + riga Livello con barra XP
      nell'AgentInspector.
- [ ] 💡 **Ufficio multiplayer** — più umani nello stesso workspace in tempo reale.

---

## 🗒️ Log dei brainstorming (Roadmap 2)

### 2026-06-30 — marketplace di template agente
- **Template agente** 📦 — nuovo `lib/agentTemplates.ts`: libreria curata di
  configurazioni pronte (ruolo + modello + istruzioni) — cacciatore di bug 🐛,
  autore di test 🧪, documentatore 📚, revisore 🔍, architetto 🏛️, rifattorizzatore ♻️.
  `applyTemplate(agent, t)` puro imposta role/model/instructions preservando il resto;
  `serializeTemplate`/`parseTemplate` (validato) per condividere un template come JSON;
  `templateFromAgent` esporta la config corrente. Store action `applyTemplate`. UI
  nell'AgentInspector: selettore "📦 Template…" (applica) + "⤓ Esporta" (copia JSON
  negli appunti). 8 test. Test client 141 → 149. Typecheck, lint, build: verdi.

### 2026-06-30 — narrazione vocale (TTS) degli eventi

- **Narrazione vocale** 📣 — nuovo `lib/narration.ts`: `narrationLine(event)` puro
  mappa un evento su una frase italiana da pronunciare, o `null` se è rumore
  (output di tool come `read`/`ls`, ragionamento 💭, chiacchiere 💬, IDLE, INFO,
  WARN generici). Narra SUCCESS (incl. apertura PR), ERROR e revisione/blocco.
  `stripForSpeech` ripulisce URL/inline-code/emoji e converte `#N`→"numero N".
  Il `narrator` singleton parla via Web Speech API (`it-IT`, niente accesso al DOM
  al load). `NarrationBridge` (come l'AudioBridge, traccia l'ultimo evento) +
  toggle 📣 flottante accanto allo speaker, spento di default e persistito in
  `localStorage`. 8 test. Test client 133 → 141. Typecheck, lint, build: verdi.

### 2026-06-30 — meta-agente (SAMS che migliora SAMS) + fix agenti bloccati

- **Fix agenti bloccati** — blue/purple restavano immobili sopra il letto: erano
  persistiti in `localStorage` come `working` (dal vecchio seed pre-fix), quindi
  `isFreeAgent` li escludeva e `LifeBridge` non li animava mai. Ora `onRehydrate`
  resetta ogni `working` stantio → `idle` (task azzerato); un task reale in volo si
  ri-sincronizza dalla SSE.
- **Meta-agente** 🤯 — un agente può lavorare sul repository di SAMS stesso.
  Retargeting del repo per-task e concurrency-safe: `AsyncLocalStorage` in
  `github.ts` (`runWithRepo`/`currentRepo`, `repoBase` ne legge l'override), pilotato
  dal nuovo campo `repo` di `AssignBody` (validato `owner/repo` in `/api/assign`,
  altrimenti fallback al repo globale). Lato client: flag `Agent.meta`, `setMeta`,
  `lib/metaAgent.ts` puro (`SAMS_REPO`, `metaRepo`, `slugifyBranch`, `buildMetaTask`,
  `META_IDEAS`), toggle "🤯 Meta" + selettore spunti nell'AgentInspector; tutti i
  call-site di `assignRemote` passano `metaRepo(agent)` (tranne la Live Sim, le cui
  issue vivono sul repo globale). 13 nuovi test (5 server, 8 client). Test client
  125 → 133, server 108 → 113. Typecheck, lint, build: verdi.

### 2026-06-30 — eventi stagionali nel Commit Garden

- **Eventi stagionali** 🎉 — nuovo `lib/seasonalEvents.ts`: `getSeasonalEvent(date)`
  pura mappa il giorno corrente su una ricorrenza (Capodanno 1/1·31/12, San Valentino
  14/2, fioritura 20–22/3, solstizio 20–22/6, Halloween 29–31/10, Natale 20–26/12) con
  range mutuamente esclusivi (buco voluto 27–30/12 tra Natale e Capodanno). Ogni evento
  porta `emoji`, colore `accent` e `blurb`. In scena `FestiveParticles` fa salire orb
  luminosi del colore accento attorno alla pianta quando l'evento è attivo; nel pannello
  giardino compare un badge con emoji + frase. 8 nuovi test. Test client 117 → 125.
  Typecheck, lint, build: verdi.

### 2026-06-30 — skill tree (XP/livelli da task completati)

- **Skill tree** — nuovo `Agent.xp`: ogni task completato dà +30 XP
  (`updateProgress` quando arriva a 100, `applyRemote` quando lo stato passa a `done`).
  Curva e ranghi in `lib/skill.ts` (`levelFromXp`: Novizio→Apprendista→Esperto→Veterano→
  Maestro), funzione pura con 6 test. UI: badge ⭐Lv nell'etichetta dell'agente in scena +
  riga "Livello" con barra XP nell'AgentInspector. Migrazione persist back-fill di `xp`;
  seed con XP vari per mostrare i ranghi. Test client 108 → 117. Typecheck, lint, build: verdi.

### 2026-06-29 — fame/nutrimento + pulizia seed

- **Via le task fittizie dal seed** — gli agenti partono tutti `idle` senza task finte
  (prima blue/purple erano "working" per sempre e non andavano a letto). Un agente con
  una task **vera** resta a lavorare; gli altri di notte vanno a dormire — e ora si
  **sdraiano** sul letto (Agent3D: `bodyRef` + posa orizzontale; sleeping basato sulla
  posizione sul letto).
- **Fame / nutrimento** 🍽️ — nuovo bisogno alla Sims: `Agent.hunger` cresce nel tempo
  (`HungerBridge`/`growHunger`), assegnare un task sfama (`assignTask` −45), spuntino
  manuale `feedAgent`. `moodFor` esteso: affamato ≥80 → `tired`. UI: barra Fame +
  pulsante nell'AgentInspector, indicatore 🍽️ in scena. Migrazione persist back-fill di
  `hunger`/`energy`. Test client 104 → 108. Typecheck, lint, build: verdi.

### 2026-06-29 — il mondo 3D prende vita: mobili, animazioni, suoni, handoff

Quattro item del "feel The Sims" chiusi in sequenza (un commit ciascuno, sempre
con typecheck + lint + test verdi). Prima, una piccola messa a punto dei comandi:
all'avvio non si è più agganciati a un agente; click sinistro sul pavimento muove
l'agente selezionato, click destro lo sblocca e libera la camera.

- **Mobili davvero vivi** — `lib/sceneDisplays.ts` (`monitorView`/`queueBoard`, puri,
  8 test): il monitor della scrivania mostra il file reale in scrittura (contenuto
  staged + cursore) o il piano; la TV mostra la coda dei task di tutti gli agenti.
- **Animazioni extra** — micro-attività degli agenti liberi guidate dalla posizione
  (caffè ☕ / lavagna ✏️ / stretching 🤸) in `Agent3D`; `LifeBridge` instrada a
  cucina/lavagna.
- **Suoni ambientali** — `lib/audio.ts` (WebAudio sintetizzato, zero asset): room tone
  giorno/notte, tastiera, chime/buzz sugli eventi; `AudioBridge` + toggle muto persistito.
- **Visualizzazione handoff** — arco 3D tratteggiato con impulso viaggiante sul
  `relay_task` (+ whoosh); stato `handoffs` nello store, `HandoffArc`/`Handoffs` in scena.
- Test client: 96 → 104. Typecheck, lint, suite: verdi.

### 2026-06-29 — la casa prende vita: 3 stanze + agenti che vivono

- **Casa a 3 stanze** — `world.ts` rifatto: ROOM espanso (−13..13 × −7..7), tre
  stanze (Studio/Salotto/Camera) separate da due muri interni con varco; nuove
  `ZONES`, `BEDS`, `OBSTACLES` (muri+mobili), `ROOMS`/`randomWalkPoint`. Nuovo
  componente `Bed`; `OfficeScene` con pareti+divisori e arredo per stanza;
  `DEFAULT_BOUNDS` del pathfinder allineati. Ciclo giorno/notte ora su **ora reale**.
- **Agenti vivi** — `LifeBridge` (al posto di `IdleBridge`): vagano di giorno,
  dormono dopo le 23 in camera (posa di sonno + "zzz" in `Agent3D`), si svegliano
  al mattino (07:00) o con un task. `isNightNow()`.
- **Idea futura**: _fame/nutrimento_ — i task sfamano gli agenti (aggiunta in cima).
- Test client 95, server 108. Typecheck, lint: verdi.

### 2026-06-29 — Mondo 3D (pathfinding + camera) + i18n italiano

- **Pathfinding attorno ai mobili** — gli agenti aggirano sofà, tavoli e scrivania
  invece di attraversarli. `lib/pathfind.ts`: `findPath` puro (A\* 8-connesso, no
  corner-cutting, string-pulling line-of-sight, fallback a linea retta) + 5 test;
  `OBSTACLES` (footprint AABB) in `data/world.ts`; `Agent3D` calcola il percorso al
  cambio di target e segue i waypoint. Nessuna modifica a store/tipi.
- **Camera cinematografica** — `CameraFollow` ora ricentra + fa dolly-in alla
  selezione, segue l'agente mentre cammina, torna al centro alla deselezione; il
  dolly agisce solo durante la transizione così orbit/zoom restano liberi.
- **i18n → italiano** — tutte le scritte dell'interfaccia portate in italiano
  (24 file UI + dati seed/world); etichette di stato centralizzate in `STATUS_META`.
  Aggiornate le asserzioni di `output.test.ts`. Test client 87 → 92.

### 2026-06-29 — Notion database + fix lint

- **Fix lint**: `eslint.config.js` ignorava `dist`/`node_modules` ma non i file
  generati di coverage → 3 warning su `server/coverage/*.js`. Aggiunto `**/coverage`
  agli `ignores`; `eslint .` di nuovo pulito.
- **Notion DB (creare/aggiornare righe)** — completato l'item "Notion: database".
  Logica di mapping `fields → properties` estratta nella funzione **pura** esportata
  `buildDatabaseProps(schema, fields)` (riuso condiviso fra create e update),
  con 7 test in `notion.test.ts` (un tipo per asserzione, skip schema/NaN/tipi non
  supportati, troncamento 2000). Nuovo tool **`notion_update_row`** (oltre al già
  presente `notion_add_row`): trova la riga per la proprietà titolo
  (`/databases/{id}/query`, match esatto poi `contains`) e applica `PATCH /pages/{id}`.
  Test di gating esteso. Test server: **101 → 108**. Typecheck, lint, test: verdi.

### 2026-06-28 — sessione 3: profondità e UX (14 migliorie)

Feature implementate in sequenza (tutte con typecheck + test verdi):

- **Specializzazioni ruolo** — ROLE_PROMPTS con VINCOLI ASSOLUTI (Revisore/Tester/Documentatore/Architetto). Sistema prompt ciclo CI: gh_trigger_workflow → gh_list_ci → gh_ci_jobs → correggi → mergia.
- **Piano rivedibile** — passi announce_plan cliccabili in AgentInspector (spunta verde, testo barrato, contatore X/N). 2 nuovi test in agent.test.ts.
- **Memoria persistente** — tabella SQLite `agent_memory`; tool `remember`/`recall` universali; memorie iniettate nel system prompt; pannello "Memorie di progetto" nell'inspector; API REST GET/DELETE `/api/memory/:agentId`.
- **Tooltip stats 3D** — al hover su un agente nel canvas appare un pannello con stato, energia, task corrente e progresso. Scompare quando l'agente è selezionato.
- **SystemOverview potenziato** — barra distribuzione stati a colori, contatore per-stato, energia media (⚡), token lifetime.
- **Tastiera a11y** — Tab/Shift-Tab cicla tra agenti; Escape deseleziona.
- **Quick-assign da Command Palette** — digitare qualsiasi testo con un agente selezionato mostra "Assign '...' → NomeAgente" come prima opzione; Enter lo invia subito.
- **Rate limiting** — POST /api/assign restituisce 429 {retryAfterSec} se lo stesso agente riceve un task entro 20s. Cooldown azzerato al task terminale.
- **Storico filtrato** — HistoryPanel con ricerca full-text, filtro agente, filtro stato; contatore filtrato/totale.
- **Toast per stati terminali** — done → "✓ NomeAgente ha completato il task", review → "⏳ in revisione", blocked → "⚠ bloccato".
- **Export CSV log** — pulsante "CSV" nell'header del log eventi; scarica sams-events-YYYY-MM-DD_HH-MM.csv.
- **Memoria UI** — pannello collassabile nell'inspector che mostra le coppie key/value salvate con `remember`, con pulsante "Cancella tutte".

Test: 94 server, 87 frontend (181 totali). Build, lint, typecheck: verdi.

### 2026-06-28 — pass qualità & nuove feature (sessione 2)

Sette miglioramenti committati in sequenza, tutti con test o typecheck verde:

- **Logging strutturato** — `log.ts` JSON leveled (debug/info/warn/error), usato in
  server.ts (startup, error handler, unhandledRejection).
- **Auth opzionale** — `SAMS_TOKEN` env; `requireAuth` middleware su 6 route mutanti;
  `hasToken` in publicStatus; logging tentativo non autorizzato.
- **`gh_trigger_workflow`** — tool agente che avvia `workflow_dispatch` su un branch
  (chiude scommessa #2: ora gli agenti possono davvero eseguire i test via CI e
  autocorreggersi). 3 test nuovi → 92 server test totali.
- **Garden connesso agli agenti** — `waterAgentGarden(agentName)` chiamato in
  `finalizeTask` quando `didSomething`: ogni task reale annaffia la pianta dell'agente.
- **Bisogni/mood** — `Agent.energy` (0..100) + `Agent.mood` (5 stati). Drena con il
  progresso, recupera a idle. Visualizzato in AgentInspector (barra colorata + emoji).
  6 nuovi test → 87 frontend test totali.
- **Pre-commit hook** — husky init + lint-staged: `eslint --max-warnings=0` sui TS staged.
- **Coverage in CI** — `@vitest/coverage-v8`; soglie lines≥60%/functions≥70%/branches≥58%;
  CI aggiornato a `npm run test:coverage`.

Test totali: **179** (92 server, 87 frontend). Build, lint, typecheck: tutti puliti.

### 2026-06-28 — frontend: i pannelli finti diventano reali

Giro dedicato al frontend: ogni pannello placeholder della shell IDE ora è
funzionante, ognuno con la logica pura estratta e testata.

- **Terminal** (era output statico finto) → **console interattiva** sulle stesse
  azioni dello store: `help`, `status/agents`, `spawn`, `assign`, `select`,
  `clear-task`, `env`, `sim start/stop`, `tasks`, `clear`. History con ↑/↓,
  autoscroll, caret. Risoluzione agente in `lib/agentMatch.ts` (nome esatto →
  colore → prefisso → substring), 7 test.
- **Search** (era input morto) → ricerca live raggruppata su agenti (nome/ruolo/
  task), workflow (nome/descrizione) e file (path); click su agente lo seleziona.
  `lib/search.ts` puro (8 test) + `flattenFiles` in `lib/fileTree.ts` (2 test).
- **Output** (erano 3 righe hardcoded) → **console build/runtime** derivata dallo
  stato reale (header connesso/offline, slot agenti, ready/waiting) + stream di
  eventi SUCCESS/WARN/ERROR. `lib/output.ts` puro, 6 test.
- **Extensions** → niente più flag hardcoded: stato live per Agent Runtime,
  Event Stream (SSE), Live Simulation (badge "Live" pulsante).
- **Problems** → righe cliccabili che selezionano l'agente, icone/chip per
  severità (blocked/review).

Test frontend **60 → 81** (helper puri: agentMatch, search, output, fileTree).
Build, lint e test server invariati e verdi.

### 2026-06-28 — pass di qualità: caccia ai bug + hardening dei test

Dopo i nuovi pannelli (Explorer interattivo, Source Control con Git Graph,
History), un giro di **bug hunt multi-sottosistema** (3 review paralleli, ogni
finding verificato sul codice reale) ha trovato e risolto 10 bug latenti:

- **Live Sim — ciclo claim**: i claim non venivano mai rilasciati quando una
  issue si chiudeva su GitHub (leak permanente dello slot). Aggiunti TTL di
  staleness (`CLAIM_TTL_MS`), `releaseIssue` owner-aware, endpoint
  `/api/sim/release-by-agent/:agentId` (cabla il prima-morto `releaseByAgent`),
  e in `SimBridge` una mappa di claim a livello-modulo (robusta al polling) per
  non lasciare agenti bloccati in `awaiting_approval`/`review`.
- **Live Sim — sync stato**: `connectBackend` ora riconcilia `simMode/label` da
  `/api/sim/status` a ogni (ri)connessione: niente più divergenza client/server
  dopo un reload. `poll()` non ripopola più dopo uno stop in volo.
- **Store**: l'auto-clear di `done` ora controlla che l'agente sia _ancora_ in
  `done` (un riassegno entro 1.5s non cancella più il task nuovo);
  `updateProgress` a 100% pianifica lo stesso auto-clear (niente agenti incastrati
  in `done`, che bloccava il riciclo della sim).
- **UI**: Explorer aveva un `<button>` dentro un `<button>` (HTML non valido) e un
  `group-hover` senza antenato `group` → lo Spawn "+" era invisibile, ora è un
  `div role=button`. IdleBridge usava `charCodeAt(0)` (uguale per ogni id
  `agent-*` → stagger nullo); RelayBridge poteva crashare su `find()!`;
  NotificationBridge non notificava i task passati per `review`.
- **GitHub**: `writeFilesAtomic` ora rifiuta i segmenti `./..` (parità con
  `cleanPath`); `pullRequestStatus` interroga anche le combined commit-status
  legacy, non solo le check-runs (gate-on-green corretto anche con CI vecchie).

Poi **hardening dei test**: estratta la logica più rischiosa dei nuovi componenti
in helper puri e testati (`lib/gitGraph.ts` algoritmo delle corsie,
`lib/agentColor.ts`, `lib/fileTree.ts`). Test frontend **42 → 60**, server
**84 → 89**. Build e lint puliti.

### 2026-06-28 — implementazione: CI gate + commit atomico ✅ (scommessa #2 completa)

- **`gh_write_files`** — tool agente per commit atomico di N file via Git tree API
  (`writeFilesAtomic` in github.ts: get-ref → get-commit → post-tree → post-commit → patch-ref);
  flusso `/api/approve` aggiornato a usare lo stesso `writeFilesAtomic`.
- **`gh_ci_jobs(run_id)`** — tool agente che restituisce job + step con flag "← FALLITO"
  per ogni step fallito; usa `GET /actions/runs/{id}/jobs`.
- **System prompt** (`composeSystem`) aggiornato: gli agenti sanno usare `gh_ci_jobs` per
  diagnosticare la CI e correggere prima di mergiare. Scommessa #2 completa.
- Test totali: **126** (84 server, 42 frontend). Build e lint puliti.

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
emerso _dentro_ il codice durante il pass di qualità. Emersa la tensione di fondo
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
