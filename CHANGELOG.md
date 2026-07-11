# 📓 Changelog

Registro delle modifiche di SAMS. Il formato si ispira a
[Keep a Changelog](https://keepachangelog.com/it/1.1.0/); le date sono in formato
`AAAA-MM-GG`. La storia più ampia (motivazioni, brainstorming) vive nei file
`ROADMAP*.md`; qui c'è l'elenco puntuale di cosa è cambiato.

## [Non rilasciato]

### 2026-07-11 — Bisogni condivisi + smooth handover (opzione B3, 3° mattone) 🍽️
- **Added** — Terzo mattone del *mondo animato condiviso* (opzione B3): oltre alla posizione, il canale
  `worldsim` porta ora i **bisogni** (energy/hunger). I follower li **adottano** e ricalcolano l'umore,
  così barra energia, piattino "ho fame" e badge combaciano con la vista che guida (prima erano
  **congelati** sui follower, coi bridge di vita driver-gated). Additivo, effimero, retro-compatibile.
- **Added (server)** — `sanitizeWorldSimAgent` include `energy?`/`hunger?` clampati a 0–100 (omessi se
  assenti/non finiti). Il relay SSE li propaga senza altri cambi. +2 test.
- **Added (client)** — `SimAgent`/`ingestSim` portano i bisogni; `WorldSimBridge` (driver) li spinge.
  `applyWorldSim`, **solo se follower** (nuovo `selfViewerId` nello store + `iAmSimulator`), committa
  energy/hunger negli `agents[]` con **diff** e ricalcola `moodFor` (una sola sorgente d'umore); il
  simulatore non adotta (simula per sé). +4 test (lib + store).
- **Added (client)** — **Smooth handover**: `DriverHandoverBridge` rileva la transizione
  follower→simulatore e `seedLivePositions` semina `agent.position` dall'ultima posizione live seguita
  (`liveAgentPositions`); il `path` in `Agent3D` si ricalcola dal punto a schermo → la simulazione
  riparte senza micro-scatto. +2 test.
- **Note** — Verificato end-to-end: server di test :8799 + SSE — il driver spinge un worldsim con
  `energy:33/hunger:77` → l'eco SSE contiene i bisogni. La convergenza a due viste nel browser resta da
  provare a mano. Doc di decisione (A2 commit + B-recompute + C1) sul Drive. Client 466 → 473, server
  255 → 257.

### 2026-07-10 — Movimento condiviso: il driver anima, i follower seguono (opzione B3) 🎞️
- **Added** — Secondo mattone del *mondo animato condiviso* (opzione B3), dove sta il valore visibile:
  il **solo driver** spinge le **posizioni live** degli agenti e le altre viste le **adottano
  read-only** interpolando → tutti vedono lo stesso ufficio muoversi insieme. Canale **effimero su
  SSE** (niente DB), sulla scia dei cursori.
- **Added (server)** — `server/src/worldsim.ts` (puro: `sanitizeWorldSim`/`sanitizeWorldSimAgent`).
  `POST /api/worldsim` **gated `viewer`** ma **accettato solo dal titolare del lease** (una vista
  non-driver → 204 muto: niente doppia simulazione), broadcast `worldsim` in `WireEvent` fuori da
  `recordEvent`, rate-limit ~15/s. +7 test.
- **Added (client)** — `src/lib/worldsim.ts` (puro: `pruneSim`/`ingestSim`/`iAmSimulator` + singleton
  `liveAgentPositions`). Store `remoteSim` (server-owned, non persistito) + `applyWorldSim`/`pruneSim`;
  `sendWorldSim` in `backend.ts`; `WorldSimBridge` (heartbeat ~3.5/s: il **driver** spinge la posizione
  *live della mesh* — lo store committa solo all'arrivo). +8 test.
- **Changed** — I tre bridge di "vita" (`LifeBridge`/`HungerBridge`/`TalkBridge`) sono **driver-gated**:
  solo il simulatore fa vivere il mondo, i follower restano quieti. `Agent3D`: se un'altra vista guida,
  insegue `remoteSim[id]` (lettura ref-stabile, nessun re-render) invece del path locale e **non
  committa** (read-only). Da soli → simulazione identica a prima.
- **Note** — Verificato end-to-end: server di test :8799 + curl (driver spinge → broadcast; non-driver
  → 204 senza broadcast). La convergenza a due viste nel browser resta da provare a mano. Prossimo
  slice: adozione dei bisogni/umore sullo stesso canale + smooth handover. Client 458 → 466, server
  248 → 255.

### 2026-07-10 — Driver lease: eletta una sola vista "regista" del mondo (opzione B3) 🕹️
- **Added** — Primo mattone del *mondo animato condiviso* (opzione B3): un **lease rinnovabile**
  che elegge **una sola vista** come simulatore autorevole ("driver"). **Non sposta ancora il game
  loop** — stabilisce solo il coordinamento, quindi zero impatto sulla simulazione esistente.
- **Added (server)** — `server/src/driver.ts` (puro: `claimDriver`/`releaseDriver`/`isLeaseValid`,
  TTL 5s; il titolare vince sempre il rinnovo, gli altri solo a lease scaduto → **handover automatico**).
  `GET/POST /api/driver` **gated `viewer`**, broadcast `driver` in `WireEvent` **solo al cambio
  titolare**, rilascio immediato sul disconnect del driver (handover senza attendere la scadenza).
  Rate-limit per-vista. +7 test.
- **Added (client)** — store `worldDriver` (server-owned, non persistito) + `setWorldDriver`;
  `claimDriver`/`fetchDriver` in `backend.ts`; `DriverBridge` (heartbeat 2s); badge `🕹️` nella
  `StatusBar` — "guidi tu" / "guida <nome>" — mostrato **solo quando il mondo è condiviso** (≥2 viste),
  così la UX in solitaria resta pulita.
- **Note** — Verificato end-to-end: curl (titolo unico, negazione ai concorrenti, rinnovo, handover a
  scadenza, broadcast solo al cambio) e **due viste reali** (una "guidi tu", l'altra "guida Ospite").
  Prossimo slice B3: instradare lo snapshot ricco (posizione/bisogni) *dal solo driver* → movimento
  condiviso. Server 241 → 248.

### 2026-07-10 — Presenza di selezione: vedi su cosa è focalizzato ogni altro 👁
- **Added** — Gemella dei cursori live: ogni vista annuncia **quale agente ha selezionato** (o
  nessuno) e le altre lo mostrano con un'**aura pulsante colorata + etichetta 👁 nome** sull'agente.
  Completa la consapevolezza collaborativa della frontiera #2 (cursori = *dove* punti, selezione =
  *chi* guardi). Effimero, sullo stesso canale SSE, nessuna dipendenza nuova.
- **Added (server)** — `server/src/selections.ts` (puro `sanitizeSelection`; `agentId` vuoto = nessuna
  selezione) + `POST /api/selection` **gated `viewer`**, broadcast `selection` in `WireEvent` fuori da
  `recordEvent`, rate-limit per-vista. +5 test.
- **Added (client)** — `src/lib/selections.ts` (puro: `pruneSelections`, `selectorsOf`); store
  `remoteSelections` (server-owned, **non persistito**); `sendSelection` in `backend.ts`; `SelectionBridge`
  che invia al cambio selezione + su heartbeat 2.5s (così la staleness ripulisce alla disconnessione, TTL
  6s) e prune. `Agent3D` disegna l'aura per gli agenti selezionati da altre viste (esclude il proprio id).
  Lettura store ref-stabile → nessun re-render sui cursori. +5 test.
- **Note** — Verificato end-to-end (POST → eco SSE con `ts`; selezioni "fantasma" iniettate → aura+nome
  resi sugli agenti giusti). Nessun impatto su verità del mondo/game loop. Client 453 → 458, server 236 → 241.

### 2026-07-10 — Playbook pronti: "Nuova guida" e "Fix guidato" 🤝
- **Added** — Due nuovi modelli in `BUILTIN_PLAYBOOKS` (`src/lib/collaboration.ts`), pensati per un
  knowledge base di codice: **Nuova guida** (Architetto → Documentatore → Revisore → Tester) e
  **Fix guidato** (Generalist → Tester → Revisore). Compaiono come chip "Modelli" nel pannello
  *Tavoli di collaborazione* (Live Sim → + Tavolo).
- **Note** — A differenza dei built-in preesistenti (ruoli generici dev/reviewer/qa/docs), questi
  usano i **nomi-ruolo reali del selettore** (Architetto/Documentatore/Revisore/Tester/Generalist)
  così `findRelayTarget` li aggancia **per ruolo esatto** agli agenti seed → le staffette partono
  senza rinominare nulla. Solo dati; suite `collaboration` invariata (31 test, nomi unici / ≥2 stadi).

### 2026-07-10 — Cursori live: le viste si vedono puntare nel mondo condiviso 👆
- **Added** — Frontiera #2 ("il salto grosso" dei cursori live, in forma de-riscata sul
  **canale SSE esistente**, niente WebSocket nuovo). Ogni vista rimbalza la posizione del suo
  puntatore sul pavimento; le altre la disegnano in scena come anello+dot colorato (colore
  stabile per id) con la pill del nome, che pulsa e **sfuma con l'età**.
- **Added (server)** — `server/src/cursors.ts` (puro: `sanitizeCursor` — id/nome ritagliati,
  coordinate finite e clampate) + `POST /api/cursor` **gated `viewer`** (anche un osservatore
  read-only può mostrarsi; con i token imposti serve comunque un token valido). Effimero:
  broadcast su SSE (`cursor` in `WireEvent`), fuori da `recordEvent` (non gonfia le metriche),
  **nessuna persistenza**. Rate-limit per-vista (chiave = id del cursore, ~20/s), oltre soglia
  scarta in silenzio (204). +6 test.
- **Added (client)** — `src/lib/cursors.ts` (puro: `pruneCursors` per staleness, `cursorOpacity`
  per la dissolvenza, `cursorColor` stabile per id); store `cursors` (server-owned, **non
  persistito**) con `applyCursor`/`pruneCursors`; `sendCursor` in `backend.ts` (auto-throttle
  ~14/s, best-effort) collegato all'`onPointerMove` del pavimento; `PresenceCursors`/`RemoteCursor`
  nell'`OfficeScene` (esclude il proprio id, nasconde le Html sotto il garden). TTL 4s. +7 test.
- **Note** — Verificato end-to-end: POST → eco SSE con `ts`; e con la UI aperta un cursore
  "fantasma" iniettato compare in scena col nome. Nessun impatto su verità del mondo/game loop.
  Client 446 → 453 test, server 230 → 236.

### 2026-07-10 — Lampade interne col ciclo giorno/notte 💡
- **Added** — `src/lib/daylight.ts` (puro): `daynessAt(date)` (0 di notte → 1 a mezzogiorno,
  stessa curva del sole del `DayNightCycle`) e `lampGain(dayness, floor=0.12)` (piena di notte,
  al minimo a mezzogiorno). Singleton `daylight` scritto ogni frame dal `DayNightCycle`.
- **Changed** — Le point-light interne (`FloorLamp`/`TableLamp`/`WallSconce`) usano un wrapper
  `LampLight` che **rampa l'intensità con `lampGain`**: prima restavano a piena potenza anche
  a mezzogiorno (7 luci sempre al massimo, poco realistico). Ora la stanza è calda di sera e
  nitida di giorno. La luce della finestra (daylight) resta invariata.
- **Note** — Solo estetico, nessun cambio al contratto dati. Verificato forzando il clock del
  browser (notte vs mezzogiorno). +6 test puri (`daylight.test.ts`).

### 2026-07-10 — Rifinitura grafica del diorama 3D ✨
- **Added** — **Ombre morbide (PCSS)** nell'`OfficeScene` via `<SoftShadows>` di drei:
  il contatto resta nitido, i bordi si sfumano con la distanza → ombre molto più
  naturali di quelle dure a mappa singola. Nessuna nuova dipendenza (drei già presente).
- **Added** — **Pulviscolo atmosferico** sospeso nell'aria della stanza (`<Sparkles>`,
  densità bassa, tinta calda) che cattura la luce radente e dà volume al volume interno.
- **Added** — **Vignettatura** CSS sul viewport della scena (`App.tsx`): velo radiale che
  scurisce gli angoli e mette a fuoco il diorama al centro; `pointer-events-none` così
  orbita/selezione restano libere.
- **Changed** — Tone mapping del Canvas su **ACESFilmic** con esposizione 1.06 → colori
  più ricchi e highlight più morbidi.
- **Note** — Puramente estetico, nessun cambio di comportamento o al contratto dati.
  Bundle `OfficeScene` 82→90 kB (soft-shadow shader + sparkles). Suite invariata (440 test).

### 2026-07-09 — Config condivisa: model/instructions/repo/xp autorevoli 🧬
- **Added** — Opzione B2 (SSOT incrementale a bassa frequenza): **model, instructions,
  repo, xp** ora sono autorevoli sul server e si propagano tra le viste, riusando il
  trasporto per-riga dell'opzione A. Colonne nuove su `world_agents` + ALTER idempotente
  (`ensureWorldAgentColumns`) per i DB preesistenti; `sanitizeWorldAgent` le normalizza
  (xp intero ≥0, config ritagliata). Prima erano cosmetiche per-vista → il **model**
  appariva col default nelle altre viste.
- **Changed** — `reconcileAgents`/`materializeAgent` (`src/lib/reconcile.ts`) adottano la
  config: solo valori remoti **non vuoti** (i dati vuoti della migrazione non azzerano
  config locale buona); **xp col massimo** (monotono, non torna indietro). Il client
  (`snapshot()` in `App.tsx`) spinge i nuovi campi.
- **Note** — Nessun game loop toccato: posizione/bisogni/umore restano cosmetici per-vista
  (il movimento condiviso è una scelta separata — vedi doc opzione B). Retro-compatibile.
- **Added** — +5 test server (`worldState`/`db`: sanitize, roundtrip, ALTER) e +4 client
  (`reconcile`: adozione, no-azzeramento, xp monotono, materializzazione).

### 2026-07-09 — I viewer non spingono il mondo (niente 403 a vuoto) 🚫
- **Changed** — `WorldSyncBridge` (`src/App.tsx`) non tenta più il `POST /api/world`
  quando il ruolo è **viewer** (`!canAssign(viewerRole)`): un viewer adotta lo stato via
  SSE/`fetchWorld` e basta, invece di prendere un 403 a ogni adozione (l'adozione cambia il
  ref `agents` → prima schedulava un push inutile). In dev-open il ruolo è owner → si spinge
  come prima. Retro-compatibile.

### 2026-07-09 — Sync più silenzioso: le scritture no-op non fanno rumore 🤫
- **Changed** — `saveWorldAgents` (`server/src/db.ts`) ora ritorna un flag `changed` e
  **bumpa la versione globale solo se qualcosa è cambiato** (create/update/tombstone).
  Il `POST /api/world` fa **broadcast solo quando `changed`**: un push no-op (una vista
  che ha appena adottato e rispinge il roster identico) non genera più echo → niente
  ping-pong bump+broadcast tra viste convergenti, meno 409 a vuoto.
- **Note** — Il prune dei tombstone resta indipendente da `changed` (rimuove solo voci
  già morte, non deve forzare un broadcast). Nessun cambio al contratto client.
- **Added** — +1 test server (`db.test.ts`: changed/versione su no-op vs. cambiamento reale).

### 2026-07-09 — Identità condivisa: rename/ricolore si propagano 🎨
- **Changed** — `reconcileAgents` (`src/lib/reconcile.ts`) ora adotta anche **nome,
  colore e ruolo** dal remoto per gli agenti **già presenti**, non solo alla creazione:
  un rename/ricolore/cambio-ruolo fatto in una vista si riflette nelle altre (lo scheletro
  condiviso è autorevole su id/nome/colore/ruolo — opzione A). Prima cambiava solo status/task.
- **Note** — Se il remoto **omette** un campo (chiamanti minimi che riconciliano solo
  status/task) o invia un colore non valido, si **conserva** il valore locale (`adoptColor`
  non ricade sul default). Nessuna modifica al server (già memorizza e propaga l'identità).
- **Added** — +3 test puri (`reconcile.test.ts`: adozione, conservazione su omissione,
  stabilità del riferimento quando nulla cambia).

### 2026-07-09 — Cancellazione propagata: il delete degli agenti è sicuro 🪦
- **Added** — Tabella `world_agents` per-riga (`server/src/db.ts`): una riga per agente
  con `rev` (versione per-agente) e `deleted_at` (tombstone), al posto del solo blob
  `world_snapshot` — che resta come contatore di versione globale (CAS). Migrazione
  una-tantum che semina la tabella dal vecchio blob alla riapertura. Opzione 1 della frontiera #1.
- **Added** — `saveWorldAgents` fonde il roster **riga per riga** (create/update +
  **tombstone-by-absence**) invece di sostituire il blob; `loadWorldAgents`/`loadWorldSnapshot`
  leggono dalla tabella (tombstone inclusi); `pruneWorldTombstones` fa GC dopo 7 giorni.
- **Changed** — `reconcileAgents` (`src/lib/reconcile.ts`) ora **rimuove** un agente
  locale quando arriva col tombstone (`deleted`) — solo su flag esplicito, **mai** per
  semplice assenza, così una creazione concorrente non ancora propagata non viene distrutta.
  `RemoteWorldAgent`/`WorldAgentSnapshot` portano `deleted?`.
- **Note** — Sicurezza del delete: il server tombstona per assenza **solo** su un push
  CAS-fresco (il client aveva adottato l'ultimo roster) → un'assenza è una cancellazione
  voluta, non una vista stantìa. Un id tombstoned che ricompare **resuscita**.
- **Added** — +6 test server (`db.test.ts`: tombstone, no-clobber, resurrezione, prune,
  migrazione), +1 (`worldState.test.ts`), +4 puri e +1 di store lato client.

### 2026-07-08 — Scheletro condiviso: gli agenti creati altrove compaiono 👥
- **Changed** — `reconcileAgents` (`src/lib/reconcile.ts`) ora **crea** gli agenti
  presenti solo nello scheletro autorevole del server, adottandone identità
  (id/nome/colore/ruolo) e stato/task; i campi ricchi (posizione, energia, umore, xp)
  partono da default per-vista. Prima toccava solo gli agenti presenti in entrambe le
  liste → un agente aggiunto in un'altra vista non compariva. Opzione A della frontiera #1.
- **Added** — `materializeAgent(remote)` (puro) costruisce un `Agent` completo dallo
  snapshot; `RemoteWorldAgent` porta ora `name`/`color`/`role` opzionali.
- **Note** — **create-only**: la cancellazione degli agenti spariti dal remoto è
  volutamente rimandata (richiede il versioning per-agente per non distruggere creazioni
  concorrenti). Sicura sul trasporto attuale (blob + CAS): converge via 409/adozione.
- **Added** — +4 test puri (`reconcile.test.ts`) e +1 di store (`useStore.test.ts`).

### 2026-07-08 — Sola lettura per i viewer: Live Sim e Routine 👁
- **Changed** — `LiveSimPanel`: avvio/stop della Live Sim disabilitato ai viewer
  (con avviso quando il runtime è pronto ma il ruolo no).
- **Changed** — `Routines`: aggiunta, attiva/disattiva ed elimina disabilitate ai
  viewer. Coerente con le guardie server-side (`/api/sim/*`, `/api/routines*` → editor).

### 2026-07-08 — Sola lettura coerente per i viewer 👁
- **Changed** — `ScmView`: i pulsanti Approva/Rifiuta compaiono solo per editor/owner;
  un viewer vede un avviso "sola lettura" al loro posto.
- **Changed** — `ChatPanel`: input e invio disabilitati ai viewer (placeholder-hint);
  la `TaskCommandCard` (`/task`) mostra "sola lettura" invece del pulsante Assegna.
  Coerente con le guardie server-side (`/api/chat`, `/api/assign` richiedono editor).
- **Added** — test di rendering (RTL) del gating di `ScmView` (owner vs viewer). +2 test.

### 2026-07-08 — Attribuzione per-utente nel log del runtime 🕵️
- **Added** — `server/src/attribution.ts` (puro): `sanitizeActor` (nome dichiarato
  dal client, input non fidato → niente caratteri di controllo, cap 40) e
  `actorLabel(role, name)` → `"Marco (editor)"` / `"editor"`. +4 test.
- **Added** — `AssignBody.actor?`; gli endpoint `/api/assign`, `/api/approve`,
  `/api/reject` loggano `by: actorLabel(...)` (nome della vista + ruolo autorevole
  del token) con agente/titolo — "chi ha fatto cosa" in un workspace condiviso.
- **Changed** — client: `assignRemote`/`approveChanges`/`rejectChanges` allegano
  il nome della vista (`chatName` o "Ospite"). Retro-compat: assente → solo ruolo.

### 2026-07-08 — La UI si adatta al ruolo (owner/editor/viewer) 👑
- **Added** — `src/lib/roleUi.ts` (puro): `normalizeRole` (fallback owner in
  dev-aperto), `roleAtLeast`, `canAssign` (editor+), `canConfigure` (owner),
  `roleMeta` (badge). +5 test.
- **Added** — `fetchWhoami()` (backend) chiamato al connect → slice
  `viewerRole`/`roleEnforced` nello store (server-owned, non persistita).
- **Changed** — la UI ora nasconde/disabilita le azioni che il ruolo non può
  compiere: badge del ruolo nella `StatusBar` (solo se i token sono imposti sul
  server), pulsante "Assegna/coda" disabilitato ai viewer (con hint), ingranaggio
  Impostazioni nascosto ai non-owner. Retro-compat: dev-aperto = owner, UI identica.

### 2026-07-07 — Tavoli: esporta/importa un protocollo 📋
- **Added** — `exportPlaybook(p)` / `importPlaybook(json)` (puri): un tavolo si
  serializza in JSON condivisibile (senza id locale) e si reimporta passando per
  `sanitizePlaybookInput` (input malformato/senza stadi → `null`). +4 test.
- **Added** — `Playbooks`: pulsante 📋 "Copia" per esportare un tavolo negli
  appunti e un campo "Importa" (incolla JSON → aggiunge) nel form. Permette di
  condividere protocolli di collaborazione tra workspace.

### 2026-07-07 — Tavoli: contributori e retrospettiva di fine corsa 🤝
- **Added** — `PlaybookRun.contributors`: i nomi degli agenti che chiudono uno
  stadio si accumulano nella run (deduplicati, immutabile via `addContributor`).
- **Added** — `runRetrospective(run, now)` + `formatDuration(ms)` (puri): a fine
  tavolo un riepilogo con numero di stadi, durata e chi ha contribuito
  (es. `Tavolo "Rilascio" · 3 stadi · 4m 10s · con dev, qa`). +6 test.
- **Changed** — `advancePlaybookRun(runId, contributor?)` registra il contributore;
  il `PlaybookBridge` passa il nome dell'agente e logga la retrospettiva al termine.
- **Added** — la card della run mostra i contributori man mano che avanza.

### 2026-07-07 — Task urgenti che saltano la coda ⚡
- **Added** — `enqueueOrdered(queue, task)` (puro, `lib/orchestration`): un task
  `urgent` si inserisce davanti a quelli normali (FIFO tra gli urgenti), un task
  normale va in fondo. La coda si consuma sempre dall'indice 0, quindi basta
  l'ordinamento — nessuna modifica a `shiftQueue` né al `QueueBridge`. +4 test.
- **Changed** — `QueuedTask` porta un campo opzionale `urgent`; `enqueueTask` usa
  `enqueueOrdered`.
- **Added** — `AgentInspector`: checkbox "⚡ Urgente — salta la coda" nel form (solo
  quando l'agente è occupato → si accoda) e chip ⚡ sugli item urgenti in coda.

### 2026-07-07 — Notifiche desktop rifinite (opt-in, solo a scheda nascosta) 🔔
- **Added** — `src/lib/notify.ts` (puro): `shouldNotify` (avvisa su `SUCCESS`/`ERROR`
  e sui `WARN` che chiedono attenzione — approvazioni/blocchi), `notificationTitle`,
  `notificationBody` (troncato). +8 test.
- **Changed** — il `NotificationBridge` non è più *sempre attivo* e non chiede più il
  permesso da solo al primo completamento: ora è **opt-in** (flag `desktopNotifications`
  **persistito**), notifica **solo quando la scheda è in secondo piano** (`document.hidden`)
  e copre **più eventi** (completamenti, milestone, errori, richieste di approvazione),
  leggendo dal log invece che solo dalla transizione di stato del task. Il cursore
  `lastId` avanza sempre, così riattivandolo non parte un arretrato di avvisi.
- **Added** — comando palette "Notifiche desktop: attiva/disattiva" (richiede il
  permesso all'attivazione).
- **Rationale** — l'implementazione precedente interrompeva anche mentre guardavi la
  scena e forzava il prompt di permesso senza chiederlo: comportamento intrusivo,
  ora scelto esplicitamente dall'utente.

### 2026-07-07 — Protocolli di collaborazione (tavoli multi-agente) 🤝
- **Added** — `src/lib/collaboration.ts` (puro): `Playbook` come sequenza ordinata
  di stadi `ruolo→titolo` (`{goal}` come segnaposto) e `PlaybookRun` come *stato
  condiviso* del tavolo (con `stageIndex`). `startRun`/`advanceRun` (immutabili,
  idempotenti a fine corsa), `runMatching` (aggancia lo stadio corrente a un task
  completato per titolo espanso + ruolo), `runProgress`/`runLabel`/`playbookSummary`,
  `sanitizePlaybookInput` (scarta stadi vuoti, cappa a 8 stadi). +19 test.
- **Added** — store: slice `playbooks` + `playbookRuns` **persistiti**;
  `addPlaybook`/`removePlaybook`, `startPlaybook` (crea e restituisce la run),
  `advancePlaybookRun`/`removePlaybookRun`. +6 test store.
- **Added** — `PlaybookBridge` (App.tsx), gemello del `ChainBridge`: al `done` di un
  agente, se il task è lo stadio corrente di una run attiva, avanza la run e assegna
  lo stadio successivo al target riusando il percorso relay già verificato
  (`assignTask`/`assignRemote`, arco di handoff + affinità). Single-fire per (run,
  stadio); a fine pipeline logga e notifica il completamento del tavolo.
- **Added** — `Playbooks` nel pannello Live Sim: editor a righe "ruolo: titolo",
  elenco protocolli con "Avvia", run in corso con barra di avanzamento e stadio
  corrente. Palette Live Sim cercabile anche per "tavoli/collaborazione/playbook".
- **Added** — `BUILTIN_PLAYBOOKS`: 3 modelli pronti ("Feature completa", "Bugfix",
  "Docs & release"); chip "Modelli" nel form che precompila e si può adattare. +2 test.
- **Distinzione** — dove una `ChainRule` è una regola globale e senza fine, un
  playbook è una **pipeline bounded** con inizio, fine e avanzamento visibile.

### 2026-07-07 — Fix: dialoghi e simboli degli agenti visibili nel garden 🩹
- **Fixed** — `Agent3D`: il Commit Garden è un overlay a schermo intero, ma le
  `<Html>` degli agenti (bolle di dialogo, ☕/✏️/🍽️/zzz, etichetta nome, tooltip,
  menu radiale) sono portali DOM con z-index alto che "bucavano" l'overlay e
  restavano visibili sopra il giardino. Ora sono soppresse quando `gardenOpen`.

### 2026-07-07 — Tema della stanza (personalizzazione dell'ufficio) 🎨
- **Added** — `src/lib/roomThemes.ts` (puro): 5 palette della stanza (pareti,
  boiserie, base pedana, modanature, battiscopa) + `getRoomTheme` con fallback al
  default; "warm" riproduce l'aspetto storico. +5 test.
- **Added** — store: `roomTheme` **persistito** + `setRoomTheme`.
- **Changed** — `OfficeScene` `Floor`: i colori del guscio della stanza vengono dal
  tema selezionato invece che da costanti hardcoded (cambio a caldo).
- **Added** — palette comandi: voci "Stanza: … " per scegliere il tema (✓ sull'attivo).

### 2026-07-07 — Multi-repo per-task ⑂
- **Added** — `resolveTaskRepo(agent, taskRepo)` (puro, `lib/metaAgent`): override
  del repository per singolo task (`owner/repo` valido) che vince su `metaRepo`;
  fallback alla risoluzione per-agente. +3 test.
- **Changed** — `QueuedTask` porta un campo opzionale `repo`; il `QueueBridge`
  passa `resolveTaskRepo(fresh, next.repo)` allo svuotamento della coda.
- **Added** — `AgentInspector`: campo "repo del task (opzionale)" con validazione
  `owner/repo` (blocca l'assegnazione se malformato) e chip `⑂ repo` sugli item in
  coda con override. Il server già accettava l'override per-task.

### 2026-07-07 — Voto di qualità pre-PR sulle modifiche in staging ⚑
- **Added** — `src/lib/quality.ts` (puro): `gradeChanges` valuta i `PendingFile`
  con euristiche locali (codice senza test, messaggi di commit mancanti, residui di
  debug TODO/FIXME/console.log/debugger, file >400 righe, scope >8 file; note
  positive per test/docs/scope contenuto) → voto A/B/C/D + punteggio 0..100 +
  motivi. +8 test.
- **Added** — `ScmView`: badge `⚑ A–D` colorato nell'header della `PendingCard`,
  col dettaglio dei motivi nel tooltip, come segnale prima di "Approva e committa".

### 2026-07-07 — Preset ruolo/modello per-agente (salvati e persistiti) 💾
- **Added** — `src/lib/agentPresets.ts` (puro): `addPreset` (dedup per nome
  case-insensitive + cap a `MAX_PRESETS`, più recente in testa) e `removePreset`,
  immutabili. Un preset **è** un `AgentTemplate`. +6 test.
- **Added** — store: slice `agentPresets` **persistita** (partialize + migrazione
  onRehydrate) con `saveAgentPreset` (riusa `templateFromAgent`) e
  `removeAgentPreset`. +3 test store.
- **Added** — `AgentInspector`: pulsante "💾 Salva preset" e riga di chip "I miei
  preset" (click per applicare a qualsiasi agente, ✕ per rimuovere).

### 2026-07-07 — Oggetti interagibili dell'utente 🖱️
- **Added** — `src/lib/interactions.ts` (puro): `coffeeBreak` (sazia gli agenti
  affamati) e `officeClockChime` (ora + fase della giornata). +6 test.
- **Added** — `OfficeScene`: componente `Interactable` (hotspot cliccabile con
  cursore, etichetta all'hover, `stopPropagation`) e tre oggetti — tazza sul piano
  cucina → pausa caffè (`feedAgent`), lavagna della coda → apre il tab Task
  (`setBottomTab`), orologio a muro → toast con l'ora (`pushToast`).
- **Added** — palette comandi: "Pausa caffè per tutti" e "Che ore sono in ufficio?"
  rendono le interazioni della stanza raggiungibili anche senza l'hotspot 3D.

### 2026-07-07 — Stagioni/meteo nella casa ❄️
- **Added** — `src/lib/weather.ts` (puro): `seasonOf`/`getWeather` — stagione
  meteorologica dal mese → precipitazione (neve/pioggia/petali/sereno), colore
  particelle e tinta di luce sottile. +6 test.
- **Added** — `OfficeScene`: il `DayNightCycle` inclina *di poco* il fondale verso
  la tinta stagionale (solo di giorno); `Weather`/`WeatherCurtain` — due cortine di
  particelle oltre i vetri, geometria e caduta per tipo, riciclate a terra.
  Complementare a `seasonalEvents.ts` (ricorrenze festive del garden).

### 2026-07-07 — Umano→agente dalla chat (con conferma esplicita) ⚡
- **Added** — `src/lib/chatCommands.ts` (puro): `parseTaskCommand`/`isTaskCommand`
  per `/task [@agente] <titolo>` — `@` obbligatorio per targettizzare (un titolo con
  `:` non è ambiguo), case-insensitive, clamp di agente/titolo. +8 test.
- **Added** — `TaskCommandCard` nel `ChatPanel`: un messaggio `/task` mostra una card
  con bottone **Assegna** (conferma esplicita, niente auto-spawn). Risolve l'agente
  per nome o il primo libero e riusa `assignTask` + `assignRemote`. Guardie: agente
  inesistente/occupato, nessun libero, runtime non pronto.

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
