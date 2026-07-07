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
- [ ] 💡 **Canale bidirezionale** — oggi lo stream è solo server→client (SSE). Per
      lo stato autorevole serve anche client→server strutturato (WebSocket, o SSE +
      POST) con una **riconciliazione** deterministica dello store.
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
- [ ] 💡 ⬅️ **Ruoli/permessi sul workspace** — chi assegna task, chi solo osserva.
      Estende l'auth opzionale già esistente (`SAMS_TOKEN`) a ruoli (owner/editor/
      viewer), con la dashboard pubblica come "viewer" degenere già pronto.
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
- [ ] 💡 ⬅️ **Tema chiaro/scuro** rifinito su tutti i pannelli (alcuni colori sono
      ancora hardcoded); centralizzare i token di colore.
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
- [ ] 💡 **Protocolli di collaborazione** — oltre a relay/reazioni a catena, un
      "tavolo" dove più agenti contribuiscono allo stesso obiettivo con hand-off
      espliciti e stato condiviso.
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
