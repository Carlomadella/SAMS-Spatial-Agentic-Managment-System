# 🗺️ SAMS — Roadmap 4 (da demo personale a prodotto condiviso)

Le **Roadmap 1–3** hanno costruito un mondo vivo: una stanza 3D con agenti
autonomi multi-provider, Commit Garden, runtime Express con SSE (R1); persistenza
SQLite, diff+gate CI, Live Simulation, meta-agente, bisogni, suoni, narrazione,
skill tree, marketplace (R2); un mondo **reattivo** (webhook, MCP, reazioni a
catena, routine), **raccontabile** (replay, immagine OG, giardini di team,
dashboard pubblica, diario) e con **profondità simulativa** (relazioni, obiettivi,
economia, meta proattivo) — e da poco è una **PWA installabile e offline** (R3).

Restano vere due cose, però: il mondo è ancora **guardato da una persona sola** e
SAMS è ancora una **demo**, non un prodotto che altri possono ospitare e usare. Il
quarto capitolo scioglie proprio questo: rendere il mondo **condiviso** (più
osservatori, live) e SAMS **distribuibile**.

> **Come si mantiene questo file**
> Stesse regole delle Roadmap 1–3: nuove idee in cima alle sezioni, stati
> aggiornati, **Log datato** in fondo. Gli item ⬅️ sono _ereditati_ dalla
> Roadmap 3 (ancora aperti) e continuano qui.
>
> **Legenda stato:** 💡 idea · 🔜 prossimo · 🏗️ in corso · ✅ fatto · ❄️ in pausa
> **Impatto/Effort:** 🟢 basso · 🟡 medio · 🔴 alto

---

## 🧭 La tensione di fondo: _mondo mio_ → _mondo nostro_ (e prodotto)

Un ufficio di agenti è bello da soli, ma diventa uno _strumento_ quando più
persone lo **guardano insieme** in tempo reale e quando chiunque può ospitarlo per
il proprio team. Finora la verità del mondo vive nel browser (Zustand-persist) di
un solo utente; il salto del capitolo 4 è spostarla sul server e aprirla agli
altri — prima come architettura, poi come prodotto rifinito e installabile.

## 🎯 Le 3 frontiere (in ordine di esecuzione)

| #   | Frontiera                                                             | Perché                                                                          | Effort | Stato |
| --- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------ | ----- |
| 1   | **Stato autorevole sul server** — la verità del mondo migra su SQLite | Prerequisito di tutto il resto: senza, la presence realtime non sta in piedi    | 🔴     | 🏗️    |
| 2   | **Mondo condiviso** — presence realtime + ruoli/permessi + chat       | Da demo personale a strumento di squadra: più persone, stesso ufficio, live     | 🔴     | 💡    |
| 3   | **Prodotto & distribuzione** — deploy, onboarding, temi               | Chiunque può ospitare e usare SAMS; la PWA è il primo tassello, non l'ultimo    | 🟡     | 🏗️    |

> Sequenza voluta: prima l'**architettura** (lo stato autorevole è la fondazione),
> poi le **persone** (presence e ruoli ci si appoggiano sopra), infine la
> **distribuzione** (ha senso rifinire il prodotto quando c'è qualcosa da
> condividere). La #3 può però avanzare in parallelo per i pezzi indipendenti
> (temi, onboarding) senza aspettare le altre.

---

## 🧱 Stato autorevole sul server (frontiera #1)

- [x] ✅ **Copia autorevole durevole (primo slice)** — `server/src/worldState.ts`
      (puro: `WorldSnapshot`, `sanitizeWorldAgents`, `summarizeWorld`) + tabella
      SQLite `world_snapshot` (upsert single-row, versione monotona) + endpoint
      `GET/POST /api/world`. Lato client la `WorldSyncBridge` spinge uno snapshot
      compatto (throttle 20s). Il mondo ora sopravvive al refresh ed è leggibile da
      altre viste — senza ancora migrare la scrittura. 10 test.
- [ ] 🏗️ ⬅️ **Migrare la verità di agenti/task da Zustand-persist a SQLite** — la
      lettura autorevole c'è (sopra); manca il resto: il client diventa una _vista_
      e il server l'unica sorgente di verità (schema completo + scrittura autorevole).
- [ ] 🏗️ **Canale bidirezionale** — oggi lo stream è solo server→client (SSE). Per
      lo stato autorevole serve anche client→server strutturato (WebSocket, o SSE +
      POST) con una **riconciliazione** deterministica dello store. _Fatto: primo
      mattone — **concorrenza ottimistica (compare-and-swap)** su `POST /api/world`.
      Puro `isFreshWrite(current, base?)` (`worldState.ts`): il client dichiara la
      `baseVersion` vista, il server rifiuta con **409 + snapshot corrente** se un
      altro scrittore l'ha superata. Lato client `src/lib/reconcile.ts` (puro:
      `compareVersion`, `nextBase`, monotòna) + `WorldSyncBridge` che traccia la base,
      semina da `fetchWorld` all'avvio e, sul 409, adotta la versione remota e
      ripresenta. Verificato end-to-end (due scrittori: base obsoleta → 409 →
      riconcilia → 200). 3+6 test._ Resta: la scrittura autorevole verso lo store
      (adottare davvero lo stato remoto, oggi il 409 riallinea solo la versione).
- [ ] 💡 **Migrazione morbida** — un import dallo stato locale (localStorage) alla
      prima connessione, così nessuno perde il proprio ufficio nel passaggio.
- [ ] 💡 **Ottimismo + conferma** — la UI applica subito le azioni e le riconcilia
      con l'eco autorevole del server (come già fa `applyRemote` per i task).

## 🤝 Mondo condiviso (frontiera #2)

- [x] ✅ **Presence — osservatori connessi (primo slice)** — `src/lib/presence.ts`
      (puro: `sanitizeObservers`, `observerLabel`, `observerBadge`, `isShared`). Il
      runtime rimbalza via SSE quante viste sono collegate (`broadcastPresence` su
      connect/disconnect, fuori da `recordEvent` per non gonfiare le metriche); lo
      store tiene `observers` e la `StatusBar` mostra un badge 👁 "N stanno
      guardando", evidenziato quando il mondo è condiviso. Conteggio per-connessione
      (non ancora identità utente). Il conteggio compare anche nella **dashboard
      pubblica** (`viewers` in `/api/public`: "N stanno guardando"). 10 test.
- [x] ✅ **Presence con nomi + canale bidirezionale (secondo slice)** — non più solo
      *quante* viste, ma *chi*. `server/src/presence.ts` (puro: `sanitizeObserverIdentity`,
      `distinctPeople`, `presenceState`) + `clients` da `Set` a `Map<Response,Observer>`.
      L'identità arriva dal client in due modi — **primo pezzo concreto del canale
      client→server (frontiera #1)**: (1) al connect, come query param dell'EventSource
      (`/api/events?v=…&n=…`); (2) a caldo via `POST /api/presence` (rate-limited) per
      rinominarsi **senza riconnettersi**. Il badge 👁 resta un conteggio di viste; il
      **tooltip** ora elenca i nomi (`presenceTooltip`, fino a 5 + "e altri N"), deduplicati
      per `viewerId` persistito. Retro-compatibile: `presence` resta un numero, `people` è
      additivo. Verificato end-to-end sul runtime (due viste + rename live via SSE). 25 test.
- [ ] 💡 ⬅️ **Presence in tempo reale (agenti live)** — più utenti vedono gli stessi
      agenti muoversi e gli stessi eventi, live. Estende presence+nomi (sopra) con lo
      stato condiviso: si appoggia al canale bidirezionale (ora avviato) e allo
      stato autorevole della frontiera #1.
- [x] ✅ **Ruoli/permessi sul workspace** — chi assegna task, chi solo osserva.
      `server/src/roles.ts` (puro: `bearerToken`, `resolveRole`, `roleAtLeast`) modella
      la gerarchia **viewer < editor < owner** sui tre token: `SAMS_TOKEN` (owner:
      tutto, incl. config/segreti), `SAMS_EDITOR_TOKEN` (editor: avvia lavoro ma non
      tocca le impostazioni), `SAMS_READONLY_TOKEN` (viewer: solo lettura + dashboard
      pubblica). Guardia `requireRole(min)` in `server.ts`: `settings`/`provision`
      richiedono owner, le route che avviano lavoro (assign/approve/reject/sim/world/
      chat/presence/routine) richiedono editor; 401 se manca il token, 403 se il ruolo
      è insufficiente. Retro-compatibile: **nessun token configurato → tutto owner**
      (come prima). Endpoint `GET /api/whoami` per far adattare la UI al ruolo.
      Verificato end-to-end sul runtime (owner/editor/viewer su settings+assign). 8 test.
      _Resta: adattamento della UI client al ruolo (nascondere le azioni ai viewer)._
- [x] ✅ **Chat di workspace** — un canale umano-umano accanto alla scena,
      separato dall'event log. `server/src/chat.ts` (puro: `sanitizeChatInput`) +
      tabella SQLite `chat_messages` (con prune a 200) + `GET/POST /api/chat`; i
      messaggi si rimbalzano via SSE a tutte le viste (`chat` in `WireEvent`). Lato
      client: slice `chatMessages` (server-owned, non persistito) + `chatName`
      (persistito), tab **Chat** nel pannello in basso, hydrate al connect e comando
      palette "Apri Chat". Badge dei messaggi **non letti** sul tab (logica pura
      `countsAsUnread`/`unreadBadge`, azzerato all'apertura). 14 test.
- [x] ✅ **Umano→agente dalla chat (con conferma esplicita)** — un messaggio
      `/task [@agente] <titolo>` diventa una **card azionabile** in chat. `parseTaskCommand`
      (puro, `src/lib/chatCommands.ts`: `@` obbligatorio per targettizzare, così un titolo
      con due punti non è ambiguo) + `TaskCommandCard` che risolve l'agente (per nome, o il
      primo libero) e, **solo su click**, assegna riusando `assignTask` + `assignRemote`
      (stessi cooldown/approvazioni). Niente parte in automatico. Guardie: agente
      inesistente/occupato, nessun libero, runtime non pronto. 8 test.
- [ ] 🏗️ **Rate-limit & quota per-utente** ⬅️ — quando il workspace è condiviso,
      evitare che un utente saturi il runtime (per-utente, non solo per-agente).
      _Fatto: limiter puro riutilizzabile `server/src/rateLimit.ts` (finestra
      scorrevole, `now` iniettabile) applicato alla **chat** (max 10 msg/30s per IP
      → 429 con `retryAfterSec`). 5 test._ Resta: quota per-utente identificato
      (serve identità/ruoli) sugli endpoint che avviano lavoro (assign).

## 📦 Prodotto & distribuzione (frontiera #3)

- [x] ✅ **PWA installabile + offline** — manifest, service worker (senza toccare
      `/api` né l'SSE), icone generate da `favicon.svg`. Primo tassello della
      distribuzione: SAMS si installa e parte standalone.
- [x] ✅ **Deploy con un click** — `docs/DEPLOY.md` (guida + tabella env) e un
      Blueprint Render `render.yaml` (Docker, health `/api/health`, secrets vuoti da
      compilare). Compose per il locale, Fly/Railway/qualsiasi host Docker per il
      resto. Il server già ascolta su `$PORT`.
- [ ] 🏗️ ⬅️ **Tema chiaro/scuro** rifinito su tutti i pannelli (alcuni colori sono
      ancora hardcoded); centralizzare i token di colore. _Fatto: la palette degli
      **stati agente** (working/review/blocked/done/idle/…) era duplicata in
      `Agent3D.tsx` e `SystemOverview.tsx` → centralizzata in `STATUS_META` (campo
      `hex`, allineato alle classi `dot`) con helper puro `statusHex(status)` (fallback
      idle). 3 test._ Resta: pochi hex nei componenti-grafici (GitGraph/GardenView) e
      i token CSS accent.
- [x] ✅ ⬅️ **Tour interattivo** post-onboarding — `src/lib/tour.ts` (step +
      `placeTourCard` puro, card sempre dentro il viewport) + `Tour.tsx` con
      spotlight sugli elementi `data-tour` (scena, inspector, pannello in basso,
      garden…). Auto-avvio una volta dopo l'onboarding; comando "Avvia tour" nella
      palette. 10 test.
- [x] ✅ ⬅️ **Palette comandi estesa** — comandi rapidi per Live Sim (routine/
      reazioni), Replay, Diario, Cronologia, Task, Impostazioni, tema e i toggle
      meta-agente / webhook, più "Avvia tour".
- [x] ✅ **Notifica "nuova versione"** — `pwa.ts` rileva un service worker
      aggiornato dietro a uno attivo e mostra una toast "ricarica per aggiornare".

## 🧠 Profondità agentica (trasversale)

- [x] ✅ **Multi-repo per-task** ⬅️ — oltre al retarget del meta-agente e
      all'override per-agente (`agent.repo`), ora si può scegliere il repo bersaglio
      per **singolo task** dalla UI. `resolveTaskRepo(agent, taskRepo)` (puro, in
      `lib/metaAgent`): un override per-task valido vince, altrimenti si ricade su
      `metaRepo` (agente → SAMS se meta → globale). `QueuedTask.repo` porta
      l'override anche nella **coda** (svuotata dal `QueueBridge`). UI inspector:
      campo "repo del task (opzionale)" con validazione `owner/repo` + chip `⑂ repo`
      sugli item in coda. Il server già accetta l'override per-task. 3 test.
- [x] ✅ **Preset ruolo/modello per-agente** ⬅️ — profili salvati (ruolo + modello +
      istruzioni) applicabili in un click. `src/lib/agentPresets.ts` (puro:
      `addPreset` con dedup per nome + cap a `MAX_PRESETS`, `removePreset`) sopra al
      marketplace di template (un preset **è** un `AgentTemplate`). Store: slice
      `agentPresets` **persistita** + `saveAgentPreset`/`removeAgentPreset` (riusa
      `templateFromAgent`/`applyTemplate`). UI nell'`AgentInspector`: "💾 Salva
      preset" e una riga di chip "I miei preset" (click per applicare, ✕ per
      rimuovere). 6 + 3 test (puro + store).
- [x] ✅ **Protocolli di collaborazione** — oltre a relay/reazioni a catena, un
      "tavolo" dove più agenti contribuiscono allo stesso obiettivo con hand-off
      espliciti e stato condiviso. `src/lib/collaboration.ts` (puro: `Playbook`
      come sequenza ordinata di stadi ruolo→titolo; `PlaybookRun` come *stato
      condiviso* con `stageIndex`; `startRun`/`advanceRun`/`runMatching`/
      `expandStageTitle`, `{goal}` come segnaposto). A differenza di una `ChainRule`
      (regola globale senza fine) una run è una **pipeline bounded** con inizio,
      fine e avanzamento visibile. Store: `playbooks` + `playbookRuns` **persistiti**;
      `PlaybookBridge` (gemello del `ChainBridge`) al `done` avanza la run e assegna
      lo stadio successivo riusando il percorso relay verificato. UI `Playbooks` nel
      Live Sim (editor "ruolo: titolo" per riga, barra di avanzamento delle run,
      "Avvia"). 19 + 6 test.
- [x] ✅ **Qualità dell'output** — un voto A–D sulle modifiche in staging *prima
      della PR*, nello spirito del gate CI ma locale. `src/lib/quality.ts` (puro:
      `gradeChanges`) valuta i `PendingFile` con euristiche (codice senza test,
      messaggi mancanti, residui di debug TODO/console.log, file enormi, scope
      ampio) e restituisce voto + punteggio + motivi. UI: badge `⚑ A/B/C/D` colorato
      nella `PendingCard` (`ScmView`), col dettaglio dei motivi nel tooltip, accanto
      all'agente in attesa di approvazione. 8 test.

## 🎮 Mondo 3D & feel (trasversale)

- [x] ✅ ⬅️ **Stagioni/meteo nella casa** — `src/lib/weather.ts` (puro:
      `seasonOf`/`getWeather`; stagione meteorologica → precipitazione + tinta di
      luce) guida due effetti nella scena: (1) **luce stagionale** — il
      `DayNightCycle` inclina *di poco* il fondale verso la tinta della stagione,
      solo di giorno (svanisce di notte); (2) **precipitazione oltre i vetri** —
      neve/pioggia/petali che cadono in due cortine (parete di fondo + parete-
      finestra), geometria e dinamica per tipo, riciclate a terra. Complementare a
      `seasonalEvents.ts` (ricorrenze festive del garden). Logica pura testata (6
      test); resa 3D da rifinire a occhio nel browser.
- [x] ✅ ⬅️ **Oggetti interagibili** — `src/lib/interactions.ts` (puro:
      `coffeeBreak`, `officeClockChime`) + un componente `Interactable` nella scena
      (hotspot cliccabile con cursore a mano, etichetta all'hover, `stopPropagation`
      così non muove l'agente). Tre micro-interazioni *dell'utente*: la **tazza sul
      piano cucina** → pausa caffè che sazia gli agenti affamati (`feedAgent`); la
      **lavagna della coda** → apre il tab Task (`setBottomTab`); l'**orologio a
      muro** → rintocca ora + fase della giornata (`pushToast`). Logica pura testata
      (6 test); resa/posizioni 3D da rifinire a occhio nel browser.
- [ ] 🏗️ ⬅️ **Personalizzazione dell'ufficio** — spostare i mobili, scegliere il
      tema della stanza; layout persistito (naturale una volta che lo stato è
      autorevole sul server). _Fatto: **tema della stanza** — `src/lib/roomThemes.ts`
      (puro: 5 palette pareti/pavimento/modanature + `getRoomTheme` con fallback;
      "warm" = aspetto storico) → il `Floor` di `OfficeScene` legge i colori dal
      tema; store `roomTheme` **persistito**; scelta dalla palette comandi ("Stanza:
      …"). 5 test._ Resta: spostare i mobili (layout persistito), naturale con lo
      stato autorevole (#1).

## 🛠️ Solidità & produzione (engineering)

- [ ] 💡 ⬅️ **Test di rendering dei componenti** — la logica pura è ben coperta;
      manca il rendering (React Testing Library) dei pannelli critici.
- [x] ✅ **E2E cross-platform** — `playwright.config.ts` usa l'`executablePath`
      Chromium della CI solo quando `process.env.CI` è impostato e il file esiste;
      altrimenti ricade sul Chromium gestito da Playwright, così la suite gira anche
      in locale dopo `npx playwright install chromium`.
- [ ] 🏗️ **Osservabilità del runtime** — metriche/log strutturati sufficienti a
      diagnosticare un workspace condiviso (chi ha fatto cosa, quando). _Fatto:
      contatori `chatMessages` (cumulativo) e `peakClients` (picco viste) in
      `metrics.ts`, esposti in `/api/metrics` e nel `SystemOverview` (👁 correnti·
      picco); log strutturati "Vista connessa/disconnessa" con il conteggio. 3 test._
      Resta: attribuzione per-utente (serve identità/ruoli).

---

## 🗒️ Log dei brainstorming (Roadmap 4)

### 2026-07-08 — stato autorevole: CAS + riconciliazione (frontiera #1)
Terzo dei tre slice. Primo mattone de-riscato del **canale bidirezionale**: rende
la copia autorevole sicura con più scrittori, senza ancora migrare tutto lo store.
- **Puro server** `isFreshWrite(currentVersion, baseVersion?)` in `worldState.ts`:
  base assente → nessun controllo (retro-compatibile); base combaciante → fresca;
  divergente → conflitto. Load→check→save è atomico nel gestore (SQLite sincrono,
  niente `await` nel mezzo). 3 test.
- **Server** `POST /api/world`: compare-and-swap — se la `baseVersion` è obsoleta
  risponde **409** con `{conflict, version, agents}` (lo snapshot autorevole).
- **Puro client** `src/lib/reconcile.ts`: `compareVersion(local, remote)` (in-sync/
  behind/ahead) e `nextBase(prev, server)` (monotòna: si allinea alla versione più
  recente, mai indietro). 6 test.
- **Wiring client** `pushWorld(agents, base)` ora invia la base e restituisce
  `{ok, conflict, version, offline}`; `WorldSyncBridge` traccia la base, la semina da
  `fetchWorld` all'avvio (così anche la prima push è CAS-guardata) e, sul 409, adotta
  la versione remota e ripresenta presto (il proprio stato ridiventa autorevole).
- **Verifica end-to-end** sul runtime: push fresca → 200 (V+1); base obsoleta → 409
  con snapshot; push riconciliata → 200 (V+2); senza base → 200 (retro-compat).
- Test: client 372 → 378, server 209 → 212. Typecheck, lint, build: verdi.

### 2026-07-08 — ruoli/permessi owner/editor/viewer (frontiera #2)
Secondo dei tre slice. Chiude uno dei due nodi "da decidere con l'utente": il modello
dei ruoli sul workspace condiviso. Scelto un modello **retro-compatibile e additivo**
sopra l'auth a token già esistente, senza rompere nulla.
- **Puro** `server/src/roles.ts`: `bearerToken` (estrae da `Authorization: Bearer …`),
  `resolveRole(tokens, provided)` (owner→editor→viewer per precedenza; nessun token
  configurato → owner/dev aperto; configurato ma non combaciante → viewer degenere),
  `roleAtLeast`. 8 test (inclusi i casi limite: tier vuoto non matcha, precedenza owner).
- **Config**: nuovo `SAMS_EDITOR_TOKEN` (`editorToken`), additivo; `publicStatus` espone
  `hasEditorToken`; documentato in `docs/DEPLOY.md`.
- **Server**: `requireRole(min)` sostituisce `requireAuth`. `settings`/`provision` →
  owner (prima `provision` era **aperto**: ora chiuso); assign/approve/reject/sim/world/
  chat/presence/routine → editor. 401 senza token, 403 se ruolo insufficiente. Nuovo
  `GET /api/whoami` (`{role, enforced}`) per la UI.
- **Verifica end-to-end** sul runtime reale (tre token via store): owner 200 su settings,
  editor 403 su settings ma 200 su assign, viewer 403 su assign, nessun token 401.
- Retro-compat: con solo `SAMS_TOKEN` (o nessun token) il comportamento è identico a prima.
- Test: server 201 → 209. Typecheck, lint, build: verdi.

### 2026-07-08 — colori-stato centralizzati (prodotto / tema)
Primo di tre slice chiesti insieme (polish → ruoli → stato autorevole). Sul fronte
**#3 prodotto**, il pezzo più a basso rischio: rimuovere una duplicazione reale della
palette dei colori di stato dell'agente, ripetuta identica nella scena 3D e nel
pannello 2D.
- **Puro** `statusHex(status)` in `lib/meta.ts`: legge dal campo `hex` aggiunto a
  `STATUS_META` (allineato alle classi tailwind `dot`), fallback al grigio idle. 3 test.
- **Wiring**: `Agent3D.tsx` deriva il suo `STATUS_HEX` da `STATUS_META`; `SystemOverview.tsx`
  usa `statusHex` al posto della mappa locale `STATUS_COLOR` (il dot idle passa da
  `#475569` a `#94a3b8`, ora coerente con `bg-slate-400`).
- Verifica: helper unit-testato; typecheck/lint verdi; la resa nei pannelli è da vedere
  a occhio. Test: client 369 → 372. Verdi.

### 2026-07-07 — tavoli: esporta/importa (prodotto + agentica)
Undicesimo slice. Rende i protocolli di collaborazione *condivisibili* tra
workspace (tocca la frontiera #3 distribuzione), riusando la validazione già scritta.
- **Puro** `exportPlaybook`/`importPlaybook` in `collaboration.ts`: JSON senza id,
  reimport via `sanitizePlaybookInput`. 4 test.
- **UI** `Playbooks`: 📋 copia negli appunti per riga + campo "Importa" (incolla JSON).
- Verifica: funzioni pure testate; copia/incolla nel browser da provare a mano.
  Test: client 365 → 369. Verdi.

### 2026-07-07 — tavoli: contributori + retrospettiva (profondità agentica)
Decimo slice: completa la sensazione del "tavolo di collaborazione" facendo vedere
*chi ha fatto cosa* e chiudendo con un riepilogo. Estende lo stato condiviso della
run senza toccare le scelte di prodotto aperte.
- **Puro** `addContributor` (dedup/immutabile), `runRetrospective`+`formatDuration`
  in `collaboration.ts`. 6 test.
- **Wiring**: `PlaybookRun.contributors`, `advancePlaybookRun(runId, contributor?)`;
  il `PlaybookBridge` registra il nome dell'agente ad ogni hand-off e logga la
  retrospettiva ("N stadi · durata · con A, B") a fine corsa; la card della run
  mostra i contributori.
- Verifica: funzioni pure + store testati; il riepilogo live è da vedere a mano.
  Test: client 359 → 365. Verdi.

### 2026-07-07 — task urgenti che saltano la coda (profondità agentica)
Nono slice. Piccolo e de-riscato: dare priorità a un task in coda senza toccare il
consumo della coda (FIFO dall'indice 0) né il `QueueBridge`.
- **Puro** `enqueueOrdered` in `lib/orchestration`: un `urgent` si inserisce davanti
  ai normali (FIFO tra urgenti), un normale va in fondo. Immutabile. 4 test.
- **Wiring**: `QueuedTask.urgent`, `enqueueTask` usa l'helper; UI inspector con
  checkbox "⚡ Urgente" e chip ⚡ sugli item. Zero cambi al bridge/shiftQueue.
- Verifica: helper unit-testato + store; l'accodamento live è da provare a mano.
  Test: client 355 → 359. Verdi.

### 2026-07-07 — notifiche desktop rifinite (prodotto)
Ottavo slice, sul fronte **prodotto** (#3). Il `NotificationBridge` esisteva già ma
era intrusivo: sempre attivo, forzava il prompt di permesso al primo completamento e
interrompeva anche a scheda in primo piano. Rifatto in stile modulo puro + wiring:
- **Puro** `src/lib/notify.ts`: `shouldNotify` (SUCCESS/ERROR + WARN che chiedono
  azione), `notificationTitle`/`notificationBody`. 8 test.
- **Wiring**: bridge unificato **opt-in** (`desktopNotifications` persistito), che
  notifica **solo a `document.hidden`** e legge dal **log eventi** (più copertura:
  completamenti, milestone, errori, approvazioni) invece che dalla sola transizione
  di stato. Cursore `lastId` che avanza sempre (niente arretrato alla riattivazione).
- Comando palette per attivarlo (richiede il permesso all'accensione).
- Verifica: modulo unit-testato; il vecchio bridge sempre-attivo rimosso; la notifica
  reale nel browser è da provare a mano. Test: client 345 → 355. Verdi.

### 2026-07-07 — protocolli di collaborazione (tavoli multi-agente)
Settimo slice, dalla **profondità agentica** e indipendente dalle scelte di
prodotto aperte (#1 autorevole, #2 ruoli). Chiude "protocolli di collaborazione":
un **tavolo** dove più agenti lavorano allo stesso obiettivo con hand-off espliciti
e ordinati. La distinzione con le reazioni a catena: una `ChainRule` è una regola
globale e senza fine; un **playbook** è una pipeline *bounded* con inizio, fine e
avanzamento visibile.
- **Puro** `src/lib/collaboration.ts`: `Playbook` (sequenza di `CollabStage`
  ruolo→titolo, `{goal}` come segnaposto) e `PlaybookRun` (lo stato condiviso del
  tavolo, con `stageIndex`). `startRun`/`advanceRun` (immutabili, idempotenti a
  fine corsa), `runMatching` (trova la run il cui stadio corrente combacia con un
  task appena completato, per titolo espanso + ruolo), `runProgress`/`runLabel`/
  `playbookSummary`. `sanitizePlaybookInput` scarta stadi vuoti e cappa a 8. 19 test.
- **Store**: slice `playbooks` + `playbookRuns` **persistiti** (partialize +
  migrazione onRehydrate); `addPlaybook`/`removePlaybook`, `startPlaybook` (crea e
  restituisce la run), `advancePlaybookRun`/`removePlaybookRun`. 6 test store.
- **Bridge** `PlaybookBridge` in App.tsx, gemello del `ChainBridge`: al passaggio di
  un agente in "done", se il task è lo stadio corrente di una run attiva, avanza la
  run e assegna lo stadio successivo al target (`findRelayTarget`), **riusando lo
  stesso percorso di assegnazione già verificato** (`assignTask`/`assignRemote`,
  arco di handoff + affinità + whoosh). Single-fire per (run, stadio).
- **UI** `Playbooks` nel pannello Live Sim (accanto a Reazioni a catena): editor a
  righe "ruolo: titolo", elenco protocolli con "Avvia", run in corso con barra di
  avanzamento e stadio corrente. La palette Live Sim ora è cercabile anche per
  "tavoli/collaborazione/playbook".
- Verifica: moduli unit-testati + wiring store testato; il bridge riusa il path del
  `ChainBridge` già verificato end-to-end; il click "Avvia" nel browser è da provare
  a mano. Test: client 320 → 345. Typecheck, lint, build: verdi.

### 2026-07-07 — tema della stanza (personalizzazione dell'ufficio)
Sesto slice. Primo pezzo della "personalizzazione dell'ufficio" fattibile subito
(persistenza locale), senza aspettare lo stato autorevole (#1): scegliere la
palette cromatica della stanza.
- **Puro** `src/lib/roomThemes.ts`: 5 temi (pareti, boiserie, base pedana,
  modanature, battiscopa) + `getRoomTheme(id)` con fallback al default. "warm"
  riproduce esattamente l'aspetto storico → il default non cambia nulla. 5 test.
- **Store**: `roomTheme` **persistito** (partialize + migrazione) + `setRoomTheme`.
- **Scena**: il `Floor` di `OfficeScene` non usa più costanti hardcoded ma legge i
  colori dal tema (`useStore((s) => s.roomTheme)`), così cambia a caldo.
- **UI**: comandi "Stanza: 🏜️ Sabbia calda / 🧊 Azzurro freddo / …" nella palette,
  con ✓ sul tema attivo.
- Verifica: modulo unit-testato; il cambio a video è da vedere a occhio.
- Test: client 315 → 320. Typecheck, lint, build: verdi.

### 2026-07-07 — multi-repo per-task (profondità agentica)
Quinto slice della sessione. La UI aveva già l'override repo **per-agente**
(`agent.repo`) e il server accettava un `repo` per-assegnazione (override via
AsyncLocalStorage); mancava scegliere il repo per **singolo task**. Aggiunto senza
toccare il server.
- **Puro** `resolveTaskRepo(agent, taskRepo)` in `lib/metaAgent`: un override
  per-task `owner/repo` valido vince su tutto; altrimenti ricade su `metaRepo`
  (override d'agente → SAMS se meta → globale). 3 test.
- **Tipi/coda**: `QueuedTask.repo?` porta l'override anche nei task in coda; il
  `QueueBridge` (App.tsx) passa `resolveTaskRepo(fresh, next.repo)` allo svuotamento.
- **UI** `AgentInspector`: campo "repo del task (opzionale)" con validazione
  `owner/repo` (bordo rosso + blocco del pulsante se malformato) e chip `⑂ repo`
  sugli item in coda che hanno un override.
- Verifica: modulo unit-testato; il contratto col runtime è invariato (il server
  già validava `body.repo`); l'assegnazione live è da provare a mano.
- Test: client 312 → 315. Typecheck, lint, build: verdi.

### 2026-07-07 — voto di qualità pre-PR (profondità agentica)
Quarto slice, sempre indipendente dalle scelte di prodotto aperte. Chiude
"qualità dell'output": un voto sulle modifiche in staging *prima* dell'approvazione,
nello spirito del gate CI ma **locale** (nessuna rete), che gira sui `PendingFile`
già nello store.
- **Puro** `src/lib/quality.ts` (`gradeChanges`): euristiche leggere — codice
  senza test (−25), file senza messaggio di commit (−10 cad.), residui di debug
  TODO/FIXME/console.log/debugger (−8 cad.), file >400 righe (−12 cad.), scope >8
  file (−15); note positive per test/docs/scope contenuto. Punteggio 0..100 →
  voto A/B/C/D con l'elenco dei motivi. 8 test.
- **UI** `ScmView`: badge `⚑ A–D` colorato nell'header della `PendingCard`, col
  dettaglio dei motivi nel tooltip, così l'utente ha un segnale prima di
  "Approva e committa".
- Verifica: modulo unit-testato; il badge nel pannello è da vedere a occhio.
- Test: client 304 → 312. Typecheck, lint, build: verdi.

### 2026-07-07 — preset ruolo/modello per-agente (profondità agentica)
Terzo slice della sessione, dalla **profondità agentica** e ancora indipendente
dalle scelte di prodotto aperte. Chiude l'item "preset salvati applicabili in un
click", appoggiandosi al marketplace di template già esistente.
- **Puro** `src/lib/agentPresets.ts`: un preset *è* un `AgentTemplate`; qui vive
  solo la gestione della lista — `addPreset` (dedup per nome case-insensitive +
  cap a `MAX_PRESETS`, più recente in testa) e `removePreset`, immutabili. 6 test.
- **Store**: slice `agentPresets` **persistita** (partialize + migrazione
  onRehydrate) con `saveAgentPreset` (riusa `templateFromAgent`) e
  `removeAgentPreset` (riusa `removePreset`). Applicazione via l'`applyTemplate`
  già esistente. 3 test store.
- **UI** `AgentInspector`: pulsante "💾 Salva preset" (nome via prompt, default =
  ruolo) e una riga di chip "I miei preset" — click per applicare a *qualsiasi*
  agente selezionato, ✕ per rimuovere.
- Verifica: moduli unit-testati + wiring store testato; l'interazione nel pannello
  è da provare a mano nel browser.
- Test: client 295 → 304. Typecheck, lint, build: verdi.

### 2026-07-07 — oggetti interagibili dell'utente (trasversale 3D & feel)
Secondo slice indipendente della sessione, sempre dalla sezione **Mondo 3D &
feel**: dare all'utente micro-interazioni cliccando gli oggetti della stanza, non
solo guardando gli agenti. Stesso stampo: **modulo puro + wiring 3D**.
- **Puro** `src/lib/interactions.ts`: `coffeeBreak(agents)` decide *chi* nutrire
  (solo gli affamati), di quanto e con quale messaggio; `officeClockChime(now)`
  formatta ora + fase della giornata. La dispatch resta al chiamante. 6 test.
- **Scena** `OfficeScene.tsx`: nuovo `Interactable` (hotspot cliccabile con
  cursore, etichetta all'hover, `stopPropagation` per non spostare l'agente).
  Montati tre oggetti: **tazza sul piano cucina** → pausa caffè (`feedAgent` su
  ogni id), **lavagna della coda** → apre il tab Task (`setBottomTab`), **orologio
  a muro** → toast con l'ora (`pushToast`).
- Verifica: modulo unit-testato; wiring typecheckato/buildato; il click nella
  scena 3D è da provare a mano nel browser.
- Test: client 289 → 295. Typecheck, lint, build: verdi.

### 2026-07-07 — stagioni/meteo nella casa (trasversale 3D & feel)
Slice indipendente e a basso rischio dalla sezione **Mondo 3D & feel**, scelto
apposta perché non tocca le scelte di prodotto ancora aperte (#1 autorevole, #2
ruoli). Stesso stampo degli slice R4: **modulo puro + wiring 3D minimale**.
- **Puro** `src/lib/weather.ts` (`seasonOf`/`getWeather`): stagione meteorologica
  dell'emisfero nord dal mese → tipo di precipitazione (neve/pioggia/petali/
  sereno), colore particelle e una **tinta di luce** con `tintStrength` volutamente
  bassa (≤0.2). Deterministico e `now` iniettabile. 6 test.
- **Scena** `OfficeScene.tsx`: (1) il `DayNightCycle` fa un ultimo `lerp` del
  fondale verso la tinta stagionale, moltiplicata per la *diurnità* così di notte
  svanisce; (2) `Weather`/`WeatherCurtain` — due cortine di particelle oltre i
  vetri (parete di fondo + parete-finestra), che riciclano ogni mota a terra;
  geometria e caduta cambiano per tipo (streak veloci per la pioggia, sfere lente
  per la neve, quad rotanti per i petali). Zero allocazioni in `useFrame`.
- **Distinzione**: complementare a `seasonalEvents.ts` (ricorrenze festive *datate*
  nel Commit Garden). Qui è l'atmosfera *continua* dell'ufficio.
- Verifica: modulo unit-testato; wiring typecheckato/buildato; la resa 3D
  (posizione/opacità delle cortine) è da rifinire a occhio nel browser.
- Test: client 283 → 289. Typecheck, lint, build: verdi.

### 2026-07-07 — umano→agente dalla chat, con conferma esplicita (nodo "d")
Chiuso il nodo **(d)** nella sua forma de-riscata: la chat diventa *azionabile*
senza però avviare nulla in automatico. Un messaggio `/task [@agente] <titolo>` è
solo un **intento**; il lavoro reale parte esclusivamente da un click su "Assegna"
nella card (conferma esplicita, come chiedeva il log del 2026-07-06).
- **Parsing puro** `src/lib/chatCommands.ts` (`parseTaskCommand`/`isTaskCommand`):
  `@` obbligatorio per targettizzare un agente, così un titolo con `:` non viene
  scambiato per un nome; clamp di agente/titolo; case-insensitive. 8 test.
- **UI** `TaskCommandCard` nel `ChatPanel`: risolve l'agente (per nome, o il primo
  libero) e **riusa il percorso di assegnazione già esistente** (`assignTask` +
  `assignRemote`, con i loro cooldown/approvazioni). Guardie chiare: agente
  inesistente, occupato, nessun libero, runtime non pronto.
- **Sicurezza**: nessun auto-spawn; l'assegnazione passa per lo stesso `/api/assign`
  verificato altrove. Verifica: parser unit-testato + wiring typecheckato che riusa
  il path verificato; il click nel browser 3D è da provare manualmente.
- Test: client 275 → 283. Typecheck, lint, build: verdi.

**Restano aperti (scelte di prodotto, da fare con l'utente):** (a) migrazione
autorevole #1 (riconciliazione/ownership) e (b) ruoli/permessi owner/editor/viewer.

### 2026-07-07 — presence con nomi + primo pezzo del canale bidirezionale
Ripreso il nodo aperto **(c)** del 2026-07-06: la presence sapeva *quante* viste
guardano, non *chi*. Slice piccolo e de-riscato che però **avvia il canale
client→server** (primo pezzo concreto della frontiera #1), scelto apposta perché
sblocca la presence realtime senza affrontare subito la migrazione autorevole.
- **Server** 👤: `presence.ts` puro (`sanitizeObserverIdentity`, `distinctPeople`,
  `presenceState`); `clients` da `Set<Response>` a `Map<Response,Observer>`;
  `broadcastPresence` ora porta anche `people` (nomi distinti). Identità dal client
  in due modi: query param dell'EventSource al connect **e** `POST /api/presence`
  (rate-limited, 20/30s) per rinominarsi a caldo senza riconnettere.
- **Client** 🏷️: `viewerId` stabile persistito in localStorage (deduplica le schede);
  l'EventSource si presenta con `?v=…&n=…` (riusa `chatName`); `announcePresence`
  sul blur del nome in chat; store con slice `people`; `StatusBar` mostra i nomi nel
  tooltip (`presenceTooltip`, fino a 5 + "e altri N").
- **Retro-compatibilità**: `presence` resta un numero (client vecchi ok), `people` è
  additivo; una connessione senza query param compare come "Ospite" anonimo.
- Verificato end-to-end sul runtime reale (due viste con nomi + rename live
  propagato via SSE). Test: client 265 → 272, server 190 → 201. Typecheck, lint,
  build: verdi.

**Nodo aperto per la prossima sessione:** i nomi ci sono, ma la presence è ancora
*conteggio + identità*, non **stato condiviso live** (vedere gli stessi agenti
muoversi). Quello richiede la scrittura autorevole e la riconciliazione della
frontiera #1 — ora che il canale client→server è avviato, è il passo naturale.
Restano aperti anche **ruoli/permessi (b)** e **umano→agente dalla chat (d)**.

### 2026-07-06 — la frontiera #2 prende corpo (mondo condiviso, a slice de-riscati)
Sessione dedicata al **mondo condiviso** (#2), affrontato come catena di slice
piccoli e testati che si appoggiano **solo al canale SSE già esistente** — così
non dipendono dalla grossa migrazione autorevole (#1), volutamente rimandata.
- **Presence** 👁: il runtime rimbalza quante viste sono connesse
  (`broadcastPresence` su connect/disconnect, fuori da `recordEvent`); badge nella
  `StatusBar` e conteggio anche nella **dashboard pubblica** (`viewers`).
- **Chat di workspace** 💬: `chat_messages` in SQLite + `GET/POST /api/chat`,
  broadcast via SSE, tab **Chat**, badge non letti, **rate-limit** per IP
  (limiter puro riutilizzabile `rateLimit.ts`). Verificata end-to-end sul runtime.
- **Osservabilità** 📈: `chatMessages`/`peakClients` in `/api/metrics` + log
  strutturati connessione/disconnessione.
- Test: client 246 → 265, server 173 → 190. Typecheck, lint, build, e2e-backend
  (curl su runtime reale) tutti verdi.

**Nodo aperto per la prossima sessione (da decidere con l'utente):** i pezzi
rimasti implicano scelte, non solo codice. (a) **Migrazione autorevole #1**: con
più scrittori l'eco del `world_snapshot` è ambiguo (last-write-wins) — va
disegnata la riconciliazione/ownership prima di renderla condivisa davvero. (b)
**Ruoli/permessi**: serve scegliere il modello (owner/editor/viewer su `SAMS_TOKEN`).
(c) **Presence con nomi** (non solo conteggio): richiede il canale bidirezionale
(client→server) — primo pezzo concreto di #1. (d) **Umano→agente dalla chat**:
avvia lavoro reale, meglio progettarlo con conferma esplicita.

### 2026-07-05 — primi avanzamenti R4 (fondazione + prodotto)
Avviate in parallelo la frontiera #1 (con un primo slice de-riscato) e la #3.
- **Stato autorevole — primo slice** 🧱: `server/src/worldState.ts` (puro) +
  tabella SQLite `world_snapshot` + `GET/POST /api/world` + `WorldSyncBridge` che
  spinge uno snapshot compatto (throttle 20s). Il mondo ora ha una **copia
  durevole e leggibile** sul server, senza ancora migrare la scrittura.
- **Prodotto** 📦: **notifica "nuova versione"** (il service worker rileva un
  update e invita a ricaricare); **palette comandi estesa** (Live Sim/routine/
  reazioni, Replay, Diario, Cronologia, Task, Impostazioni, tema, toggle
  meta/webhook, "Avvia tour"); **tour interattivo** con spotlight sugli elementi
  `data-tour` e card sempre dentro il viewport (`placeTourCard` puro, testato).
- **Engineering**: **E2E cross-platform** — la config Playwright non è più
  inchiodata al Chromium Linux della CI e gira anche in locale.
- Fix: la card del passo 4/6 del tour (inspector, target a tutta altezza) finiva
  fuori schermo → risolto con `placeTourCard` (clamp nel viewport).
- Test: client 236 → 246, server 163 → 173. Typecheck, lint, build: verdi.
  Restano aperti: migrazione autorevole completa (#1), presence/ruoli/chat (#2),
  deploy con un click e temi centralizzati (#3), profondità agentica.

### 2026-07-05 — apertura Roadmap 4
Nata dopo la chiusura della frontiera #1 di R3 (reazioni a catena + trigger
temporali/routine) e la trasformazione di SAMS in **PWA installabile e offline**.
Con questo, di R3 restano aperti solo la frontiera **#3 (mondo condiviso)** —
rimandata di proposito — e vari item minori (3D & feel, UX, engineering). La
tensione emersa: SAMS è un mondo vivo e ora _installabile_, ma ancora **osservato
da una persona sola** e ancora una **demo** più che un prodotto ospitabile.

Tre frontiere in sequenza per R4: (1) **stato autorevole sul server** — la
fondazione: la verità del mondo migra da Zustand-persist (client) a SQLite
(server), con il client come vista; (2) **mondo condiviso** — presence realtime,
ruoli/permessi, chat, che si appoggiano alla #1; (3) **prodotto & distribuzione**
— la PWA è il primo tassello, seguono deploy con un click, temi, tour, palette
estesa. Come temi trasversali proseguono la **profondità agentica** (multi-repo,
preset, collaborazione, qualità dell'output) e il **mondo 3D & feel**.

Prossimo passo operativo da decidere con l'utente: probabilmente lo **stato
autorevole sul server** (sblocca tutto il resto ma è il pezzo più grosso) oppure,
sul fronte prodotto e a basso rischio, i pezzi indipendenti della #3 (**temi**,
**tour**, **palette comandi**) che non aspettano l'architettura.
