# 🗺️ SAMS — Roadmap 3 (il mondo condiviso)

La **Roadmap 1** (`ROADMAP.md`) ha fatto _funzionare le cose_: stanza 3D viva,
agenti autonomi multi-provider, Commit Garden, runtime Express con SSE. La
**Roadmap 2** (`ROADMAP2.md`) ha aggiunto _profondità, fiducia e scala_: SQLite e
metriche durevoli, diff preview + gate CI, Live Simulation, meta-agente che
migliora SAMS stesso, casa 2×2 con pathfinding e camera cinematografica, bisogni
(energia/fame), suoni, narrazione vocale, skill tree e marketplace di template.

Oggi SAMS è un mondo vivo — ma **osservato da una sola persona** e **svegliato
solo da te**. Il terzo capitolo parte da qui: rendere quel mondo **condiviso,
reattivo e raccontabile**, e rifinirlo come prodotto.

> **Come si mantiene questo file**
> Stesse regole delle Roadmap 1–2: nuove idee in cima alle sezioni, stati
> aggiornati, **Log datato** in fondo. Gli item ⬅️ sono _ereditati_ dalla
> Roadmap 2 (ancora aperti) e continuano qui.
>
> **Legenda stato:** 💡 idea · 🔜 prossimo · 🏗️ in corso · ✅ fatto · ❄️ in pausa
> **Impatto/Effort:** 🟢 basso · 🟡 medio · 🔴 alto

> ### ✅ Chiusura (2026-07-08)
> Tutti gli item ancora `[ ]` in questo file sono stati **risolti nella Roadmap 4**
> (dove figurano ✅) o sono **volutamente in pausa** — le caselle qui restano non
> spuntate solo per la convenzione ⬅️ "l'item continua nel capitolo successivo".
> - **Fatti in R4:** presence realtime + ufficio multiplayer (roster avatar), ruoli/
>   permessi + sola-lettura coerente, chat di workspace, tema chiaro/scuro rifinito,
>   tour interattivo, mobile usabile, palette comandi estesa, test di rendering,
>   rate-limit & quota per-utente, stagioni/meteo, oggetti interagibili,
>   personalizzazione ufficio (tema stanza + disposizioni salotto).
> - **Parziali (frontiera #1 di R4, richiedono decisione di design):** stato del mondo
>   autorevole sul server (lettura + CAS + adozione fatti; manca lo schema completo di
>   scrittura) e il **drag libero dei mobili** (dipende dallo stato autorevole).
> - **Camera cinematografica / pathfinding:** già fatti in R2 (`CameraFollow`, casa 2×2).

---

## 🧭 La tensione di fondo: _simulazione_ → _mondo condiviso_

I Sims sono belli da soli, ma diventano memorabili quando **li guardi insieme**
e quando il mondo **reagisce** a ciò che succede fuori. SAMS ha tutti i mattoncini
di un mondo vivo (agenti, bisogni, relazioni, giardino), ma vive in una sola
scheda del browser, mosso solo dai tuoi click. Le tre frontiere del capitolo 3
sciolgono ciascuna un pezzo di questo isolamento.

## 🎯 Le 3 frontiere (in ordine di esecuzione)

| #   | Frontiera                                                            | Perché                                                                              | Effort | Stato |
| --- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------ | ----- |
| 1   | **Mondo reattivo** — webhook in ingresso + MCP come strumenti       | Gli agenti reagiscono al mondo reale (push/PR/CI, Drive/Calendar) senza che tu lo dica | 🟡     | ✅    |
| 2   | **Mondo raccontabile** — replay, immagine OG, giardini di team      | Trasforma il lavoro in qualcosa da _condividere_, non solo da guardare              | 🟡     | ✅    |
| 3   | **Mondo condiviso** — presence realtime + ruoli/permessi + multiplayer | Più persone nello stesso ufficio: da demo personale a strumento di squadra          | 🔴     | 💡    |

> Sequenza voluta: prima la **reattività** (autonomia che si auto-alimenta), poi
> la **condivisibilità** (valore verso l'esterno), infine il **multiplayer** (il
> salto architetturale più grande, che ha senso solo quando c'è qualcosa da
> condividere).

---

## 🌐 Mondo reattivo (frontiera #1)

- [x] ✅ **Webhook in ingresso** — `/api/webhook/github` verifica la **firma HMAC-SHA256**
      (`verifyGithubSignature`, raw body catturato in `express.json`), traduce l'evento con
      `parseGithubEvent` puro (push / PR / workflow_run) e allega un `wake` (task contestuale)
      su due trigger: **CI fallita** (fix sul branch) e **review_requested** (rivedi la PR).
      Il `wake` viaggia sulla `WireEvent` → `pendingWakes` → `WakeBridge` che lo assegna a un
      agente libero (`pickFreeAgent`: il più riposato, o il meno carico). **Opt-in**: toggle
      "Rispondi ai webhook GitHub" nel pannello Live Sim (spento di default → l'evento resta
      solo nel log). Segreto in `GITHUB_WEBHOOK_SECRET`; setup documentato nel README. 14 test
      (11 server + 3 `pickFreeAgent`).
- [x] ✅ **Sfruttare gli MCP** — tool generico `mcp_call(server, tool, args)` con
      **allow-list** (`SAMS_MCP_SERVERS` JSON: `name`/`url`/`token?`/`tools?`). Se non
      è configurato nulla il tool non viene offerto. Modulo puro `server/src/mcp.ts`
      (`parseMcpServers`, `findMcpServer`, `isMcpToolAllowed`, `extractMcpText`,
      `parseJsonRpcResponse` — gestisce risposte JSON o SSE), transport HTTP JSON-RPC
      `tools/call`. Esposto agli agenti Gemini e Groq, gated da `mcpEnabled`. 15 test.
      Setup documentato nel README.
- [x] ✅ **Trigger temporali / routine** — modulo puro `server/src/routines.ts`: una `Routine`
      (`interval` ogni N min · `daily` a HH:MM locale) con `sanitizeRoutine`, `isDue`, `nextRun`,
      `dueRoutines`, `describeSchedule`. Persistenza SQLite (tabella `routines` + CRUD in `db.ts`);
      endpoint `GET/POST/DELETE /api/routines` + `/toggle`; uno **scheduler** (tick 30s, solo se il
      runtime è pronto e c'è una UI connessa) emette un `wake` con `source: "routine"` che il
      `WakeBridge` assegna **sempre** a un agente libero (la routine stessa è l'opt-in, bypassa il
      toggle dei webhook). UI `Routines` nel pannello Live Sim. 14 test (11 routines + 3 db).
- [x] ✅ **Reazioni a catena** — modulo puro `src/lib/chains.ts`: una `ChainRule`
      (`when`/`fromRole`/`target`/`title`/`branch`/`enabled`) rende automatica la staffetta;
      `ruleMatches` (filtro sottostringa + ruolo, guardia anti-loop diretto), `matchingChains`,
      `chainTitle` (segnaposto `{task}`), `chainSummary`. Lo store tiene/persiste le regole
      (`addChain`/`updateChain`/`removeChain`/`toggleChain`); il `ChainBridge` le fa scattare al
      passaggio in "done" (assegna o accoda al target, arco di handoff + affinità come un relay,
      cooldown per-regola anti-cascata). UI `ChainRules` nel pannello Live Sim. 10 test.

## 🎬 Mondo raccontabile (frontiera #2)

- [x] ✅ ⬅️ **Replay cinematografico** — modulo puro `src/lib/replay.ts`: `agentReplays`
      raggruppa gli eventi per agente in una clip ciascuno; `buildReplay` ordina e calcola gli
      offset relativi; `frameIndexAt` è il playhead; `frameEmoji`/`formatOffset` rifiniscono.
      Tab "Replay" nel BottomPanel (`ReplayPanel`) con **timeline scrubbabile** + play/pausa che
      rivede la sequenza di azioni. 8 test.
- [x] ✅ ⬅️ **Immagine OG condivisibile** — modulo puro `src/lib/ogImage.ts`: modello card
      testabile (`buildGardenOgCard`, `buildWorkspaceOgCard`, `shade`, `ogFileName`) +
      `renderOgCard` che disegna su `<canvas>` una card 1200×630 (kicker, titolo, emoji, badge,
      3 statistiche, footer) e `downloadOgCard` che esporta il **PNG**. Bottone "Immagine" nel
      Commit Garden. Pronto per i social. 7 test.
- [x] ✅ ⬅️ **Giardini di team / organizzazione** — modulo puro `src/lib/teamGarden.ts`:
      `buildTeamGarden` aggrega la leaderboard in totali (innaffiature, crescita media, streak
      record), uno "stadio di squadra" (`teamStageFromGrowth`) e una classifica (`memberScore`).
      Card "Giardino di team" in `GardenView` con classifica cliccabile + export immagine. 6 test.
- [x] ✅ **Dashboard pubblica read-only** — modulo puro `server/src/publicView.ts`:
      `buildPublicSnapshot` (runtime + metriche + top giardini, nessun segreto) e
      `readonlyAuthorized` (token a tempo costante, aperto se non configurato). Route
      `GET /api/public` gated da `SAMS_READONLY_TOKEN`. Lato client `PublicDashboard` mostrata su
      `?public` (con `&token=…`), polling 10s, sola lettura. 5 test.
- [x] ✅ **Diario del mondo** — modulo puro `src/lib/worldDiary.ts`: `classifyEvent`
      (PR / completati / bloccati / review / errori / pausa), `buildWorldDiary` (aggrega gli
      eventi della giornata locale per-agente), `tallyLine`/`headline` in italiano con fascia
      oraria ("Stamattina blue ha aperto 2 PR…"). Nuovo tab "Diario" nel BottomPanel
      (`WorldDiaryPanel`) con lettura vocale (riusa il `narrator` TTS). 12 test.

## 🤝 Mondo condiviso (frontiera #3)

- [x] ✅ ⬅️ **Presence in tempo reale** — più utenti vedono gli stessi agenti muoversi
      e gli stessi eventi, live. (fatto in Roadmap 4, frontiera #2)
- [x] ✅ ⬅️ **Ruoli/permessi sul workspace** — chi assegna task, chi solo osserva.
      (fatto in Roadmap 4: `roles.ts`, viewer<editor<owner)
- [x] ✅ ⬅️ **Ufficio multiplayer** — più _umani_ nello stesso workspace in tempo
      reale, con cursori/avatar e cronologia condivisa. (mondo condiviso + cursori live, Roadmap 4)
- [x] ✅ **Chat di workspace** — un canale umano-umano e umano→agente accanto alla
      scena, separato dall'event log. (`chat.ts` + `/api/chat` + SSE)

## 🧠 Profondità simulativa (trasversale)

- [x] ✅ **Relazioni fra agenti** — modulo puro `src/lib/relationships.ts`: `AffinityMap` per
      coppia (`pairKey` ordine-indipendente), `bumpAffinity`, `affinityTier` (sconosciuti →
      inseparabili), `bestFriend`, `topPairs`. Lo store tiene e persiste l'affinità; i bridge la
      incrementano su ogni handoff `relay_task` (+2) e chiacchierata (+1). Il `TalkBridge` è
      **biasato verso gli amici** (l'affinità "avvicina" nel pairing → gli amici parlano più
      spesso). L'inspector mostra il "Legame" più forte (miglior amico + tier). 8 test.
- [x] ✅ **Obiettivi a lungo termine** — modulo puro `src/lib/goals.ts`: un `Goal` è un
      _progetto_ (milestone di N task) con `goalProgress`, `activeGoal`, `advanceGoal`,
      `isGoalComplete`. Lo store tiene e persiste i goal; il `ProgressionBridge` avanza
      l'obiettivo attivo a ogni task completato e festeggia (log + toast) alla milestone.
      L'`AgentInspector` ha una sezione "Progetto" con barra di avanzamento e form di creazione. 8 test.
- [x] ✅ **Economia del token come risorsa di gioco** — modulo puro `src/lib/economy.ts`:
      ogni agente ha un portafoglio di "gettoni" (`Wallets`); `coinsForCompletion` paga una base
      per task + un bonus se produce un risultato (PR/Notion/URL), `earnCoins`, `balanceOf`,
      `wealthRanking`, `formatCoins`. Lo store tiene e persiste i saldi; il `ProgressionBridge`
      accredita i gettoni al completamento. L'`AgentInspector` mostra il saldo 🪙. 6 test.
- [x] ✅ **Meta-agente proattivo** — helper puri in `src/lib/metaAgent.ts` (`shouldProposeMeta`
      — meta + idle + libero + cooldown; `pickMetaIdea` in rotazione deterministica). Nuovo flag
      opt-in `metaProactive` (persistito, toggle nel pannello Live Sim). Il `MetaProactiveBridge`
      fa proporre a un meta-agente idle 🤯 una miglioria a SAMS da solo (PR sul repo del progetto),
      con cooldown per-agente e pausa notturna. 4 test.

## 🎮 Mondo 3D & feel

- [x] ✅ **Garden come mini bosco** — gli alberi dei contributor (leaderboard, fino a 12) sono
      sparsi su anelli concentrici attorno alla pianta principale invece che in fila; modulo puro
      `src/lib/forest.ts` (`forestSlots`, deterministico, lascia libero un cono frontale verso la
      camera) + alberi d'ambiente non etichettati che infoltiscono la scena. 5 test.
- [x] ✅ **Stagioni/meteo nella casa** — il ciclo giorno/notte c'è; aggiungere pioggia
      sui vetri, luce stagionale, festoni negli eventi. (`lib/weather.ts` + `WeatherCurtain`/`Weather()` in OfficeScene, tint stagionale)
- [x] ✅ **Oggetti interagibili** — clic su lavagna/monitor/caffè per micro-interazioni
      dell'utente, non solo degli agenti. (`Hotspot` in OfficeScene: CoffeeTable→pausa caffè, WallClock→ora, Lavagna→tab Task)
- [x] ✅ **Personalizzazione dell'ufficio** — spostare i mobili, scegliere il tema della
      stanza; layout persistito. (drag libero dei mobili + `RoomEditBanner`, layout locale)

## ♿ UX / Accessibilità & prodotto

- [x] ✅ ⬅️ **Tema chiaro/scuro** rifinito su tutti i pannelli; token di colore
      centralizzati come CSS var in `index.css` (dark/light).
- [x] ✅ ⬅️ **Tour interattivo** post-onboarding (evidenzia inspector, scena, garden):
      l'onboarding spiega i _concetti_, il tour mostra l'_UI_. (`Tour.tsx`)
- [x] ✅ ⬅️ **Mobile usabile** — sotto i 768px i pannelli collassano ma scena+inspector
      non sono davvero usabili; ripensare il layout touch. (`MobileBar` + layout touch)
- [x] ✅ **Import di un template agente** dalla UI — sezione "Importa template" nell'`AgentInspector`:
      incolla un JSON (riusa il puro `parseTemplate`, già testato) e scegli **Applica a questo** o
      **Crea nuovo agente**; JSON non valido → errore inline. Completa il marketplace (export ↔ import).
- [x] ✅ **Palette comandi estesa** — azioni rapide per ogni feature nuova (replay,
      chat, tour, temi stanza, caffè, meta-agente, webhook…). (`CommandPalette.tsx`)

## 🛠️ Solidità & produzione (engineering)

- [x] ✅ **Stato del mondo autorevole sul server** — prerequisito del multiplayer:
      migrare la verità di agenti/task da Zustand-persist (client) a SQLite (server),
      con il client come vista. (fatto in Roadmap 4: tabella `world_agents`; resta solo il game-loop server-side B1, parcheggiato)
- [x] ✅ **Test di rendering dei componenti** — la logica pura è ben coperta; manca il
      rendering (React Testing Library) dei pannelli critici. (ScmView/MobileBar/PresenceRoster/SystemOverview/RoomEditBanner + auth)
- [x] ✅ **Rate-limit & quota per-utente** — quando il workspace è condiviso, evitare
      che un utente saturi il runtime. (`rateLimit.ts` + `identityKey`, assignQuota/chatLimiter)
- [x] ✅ ⬅️ **Auto-innaffiatura via webhook** — un evento `push` innaffia in tempo reale il
      giardino di chi ha spinto. `parsePushWatering` (puro) estrae autore (`sender.login`) e
      commit; l'endpoint webhook aggiorna lo store e imposta `lastSeen` all'head commit così il
      polling non riconta. 5 test.

---

## 🗒️ Log dei brainstorming (Roadmap 3)

### 2026-07-05 — trigger temporali/routine: frontiera #1 completa ✅
Chiuso l'ultimo item aperto del **mondo reattivo**: le **routine** (cron lato runtime).
- **`server/src/routines.ts`** (puro): una `Routine` ha due modalità amichevoli invece di un
  cron completo — `interval` (ogni N minuti) e `daily` (ogni giorno alle HH:MM locali).
  `sanitizeRoutine` valida/normalizza l'input, `isDue`/`nextRun`/`dueRoutines` calcolano le
  scadenze (daily = una sola volta dopo l'orario del giorno), `describeSchedule` per la UI/log.
- **Persistenza SQLite**: nuova tabella `routines` + helper CRUD in `db.ts`
  (`listRoutines`/`insertRoutine`/`deleteRoutine`/`setRoutineEnabled`/`markRoutineRun`).
- **Server**: endpoint `GET/POST/DELETE /api/routines` + `/toggle`; uno **scheduler**
  (`routineTick`, ogni 30s) che scatta solo se il runtime è pronto e c'è almeno una UI connessa
  (così `lastRun` non avanza a vuoto), emettendo un `wake` con `source: "routine"`.
- **Riuso del percorso wake**: il `WakeBridge` ora assegna **sempre** un wake `source: "routine"`
  (la routine abilitata è già l'opt-in), mentre i wake `source: "webhook"` restano gated dal
  toggle esistente. `WireEvent.wake`/`RemoteUpdate.wake` estesi con `source`.
- **UI**: `Routines` nel pannello Live Sim — elenco con toggle/rimozione e form (nome, task,
  modalità giorno/intervallo con orario o minuti, branch). Helper fetch in `backend.ts`.
- Test: +14 server (11 routines + 3 db routines). **Server 149 → 163**, client invariato 236.
  Typecheck (client+server), lint, build: verdi. Con questo la **frontiera #1 è di nuovo
  completa** (webhook + MCP + reazioni a catena + routine).

### 2026-07-05 — reazioni a catena (frontiera #1): pipeline dichiarative
Ripreso uno dei due item ancora aperti del **mondo reattivo**: le **reazioni a catena**,
l'automazione della staffetta oltre al `relay_task` puntuale che un agente emette a mano.
- **`src/lib/chains.ts`** (puro): una `ChainRule` dice "quando un task che contiene `<when>`
  viene completato (facoltativamente da un `<fromRole>`), assegna un follow-up a `<target>`".
  `chainTitle` espande il segnaposto `{task}` col titolo completato; `ruleMatches` applica i
  filtri con una **guardia anti-loop diretto** (non re-innesca se il follow-up è identico al
  task appena finito); `matchingChains` e `chainSummary` completano il modulo.
- **Store**: nuovo slice `chains` persistito + `addChain`/`updateChain`/`removeChain`/`toggleChain`
  (migrazione back-fill in `onRehydrateStorage`).
- **`ChainBridge`** (App.tsx): al passaggio di un agente in "done" combacia il task completato
  con le regole e per ciascuna assegna (o accoda, se il target è occupato) il follow-up, riusando
  lo stesso percorso locale+backend di relay/wake. Disegna l'arco di handoff, dà +1 affinità e
  un whoosh, con un **cooldown per-regola** (15s) come rete anti-cascata sopra la guardia pura.
- **UI**: `ChainRules` nel pannello Live Sim — elenco regole con toggle/rimozione e un form
  compatto (`when`/`fromRole`/`target`/`title`/`branch`).
- Test: +10 client (chains). **Client 226 → 236**. Typecheck, lint, build: verdi. Resta aperto in
  frontiera #1 il solo item dei **trigger temporali/routine** (cron lato runtime + SQLite).

### 2026-07-03 — profondità simulativa completa (sezione #4 ✅): obiettivi, economia, meta proattivo
Chiusi gli ultimi tre item della profondità simulativa (la #3 resta per ultima, come deciso).
- **Obiettivi a lungo termine** 🎯 — `src/lib/goals.ts` (puro): un `Goal` è un progetto =
  milestone di N task. Lo store tiene/persiste i goal; il nuovo `ProgressionBridge` avanza
  l'obiettivo attivo a ogni task completato (transizione a "done") e festeggia alla milestone.
  Sezione "Progetto" nell'`AgentInspector` con barra + form.
- **Economia del token** 🪙 — `src/lib/economy.ts` (puro): portafoglio di gettoni per agente;
  `coinsForCompletion` paga una base + bonus se il task produce una PR/risultato. Il
  `ProgressionBridge` accredita al completamento; saldo mostrato nell'inspector.
- **Meta-agente proattivo** 🤯 — helper puri in `metaAgent.ts` (`shouldProposeMeta`,
  `pickMetaIdea`) + flag opt-in `metaProactive` (toggle nel Live Sim). Il `MetaProactiveBridge`
  fa proporre a un meta-agente idle una miglioria a SAMS da solo, con cooldown e pausa notturna.
- Test: +18 client (8 goals, 6 economy, +4 metaAgent). **Client 208 → 226**. Un solo
  `ProgressionBridge` centralizza gli effetti del completamento (obiettivi + gettoni).
  Typecheck, lint, build: verdi. Con questo la **profondità simulativa (#4) è completa**.

### 2026-07-03 — profondità simulativa (avvio) + auto-innaffiatura + garden a mini bosco
Deciso di rimandare la frontiera #3 (mondo condiviso) e passare alla **profondità
simulativa** (trasversale), con due richieste concrete sul giardino.
- **Relazioni fra agenti** 💚 — `src/lib/relationships.ts` (puro): affinità per coppia
  (`AffinityMap`, `pairKey`, `bumpAffinity`, `affinityTier`, `bestFriend`, `topPairs`). Lo store
  la tiene e la persiste; `RelayBridge` la incrementa a ogni handoff (+2) e `TalkBridge` a ogni
  chiacchierata (+1). Il pairing delle chiacchiere è ora **biasato dall'affinità** (gli amici si
  cercano più spesso). L'`AgentInspector` mostra il "Legame" più forte con tier.
- **Auto-innaffiatura via webhook** 🌱 — un `push` innaffia in tempo reale il giardino di chi ha
  spinto (`parsePushWatering`, puro); l'endpoint aggiorna lo store e sposta `lastSeen` all'head
  commit così il polling non riconta. (Chiude un item ❄️ ereditato dalla Roadmap 2.)
- **Garden come mini bosco** 🌳 — gli alberi dei contributor (fino a 12) sono sparsi su anelli
  concentrici attorno alla pianta principale (`src/lib/forest.ts`, `forestSlots`, deterministico,
  cono frontale libero) + alberi d'ambiente che infoltiscono la scena.
- Test: +13 client (8 relationships, 5 forest) e +5 server (parsePushWatering).
  **Client 195 → 208**, **server 144 → 149**. Typecheck (client+server), lint, build: verdi.
- Rimangono aperti in profondità simulativa: obiettivi a lungo termine, economia del token,
  meta-agente proattivo.

### 2026-07-02 — mondo raccontabile completo (frontiera #2 ✅): replay, team, dashboard
Chiusi gli ultimi tre pezzi della frontiera #2.
- **Replay cinematografico** 🎬 — `src/lib/replay.ts` (puro): `agentReplays` raggruppa gli
  eventi per agente, `buildReplay` li ordina in fotogrammi con offset relativo, `frameIndexAt`
  è il playhead, `frameEmoji`/`formatOffset` rifiniscono. Nuovo tab **"Replay"** (`ReplayPanel`)
  con timeline scrubbabile + play/pausa: rivedi la sequenza di azioni di un agente come una clip.
- **Giardino di team** 🌳 — `src/lib/teamGarden.ts` (puro): `buildTeamGarden` aggrega la
  leaderboard in totali (innaffiature, crescita media, streak record, assetati), uno stadio di
  squadra (`teamStageFromGrowth`) e una classifica (`memberScore`). Card espandibile in
  `GardenView` con classifica cliccabile ed export immagine (riusa `buildWorkspaceOgCard`).
- **Dashboard pubblica read-only** 📊 — `server/src/publicView.ts` (puro): `buildPublicSnapshot`
  (runtime + metriche + top giardini, zero segreti) e `readonlyAuthorized` (token a tempo
  costante; aperto se non configurato). Route `GET /api/public` gated da `SAMS_READONLY_TOKEN`
  (nuovo campo in `Settings`/`publicStatus`). Lato client `PublicDashboard` mostrata su `?public`
  (con `&token=…`), che fa polling ogni 10s. README: sezione "Public dashboard".
- Test: +14 client (6 teamGarden, 8 replay) e +5 server (publicView). **Client 181 → 195**,
  **server 139 → 144**. Typecheck (client+server), lint, build: verdi.

### 2026-07-02 — mondo raccontabile: immagine OG + diario del mondo (frontiera #2, primi pezzi)
- **Immagine OG condivisibile** 🖼️ — nuovo modulo puro `src/lib/ogImage.ts`. Il modello della
  card è separato dal disegno: `buildGardenOgCard` (dallo stato del Commit Garden: stadio →
  emoji/accent, innaffiature/streak/crescita) e `buildWorkspaceOgCard` (riepilogo workspace),
  più `shade` (gradienti), `ogFileName` (slug). `renderOgCard` disegna la card 1200×630 su un
  contesto 2D (kicker, titolo troncato a larghezza, emoji grande, badge pillola, 3 statistiche,
  footer); `downloadOgCard` renderizza su canvas fuori schermo ed esporta il **PNG**. Bottone
  "Immagine" accanto a "Pagina" nel `GardenView`.
- **Diario del mondo** 📖 — nuovo modulo puro `src/lib/worldDiary.ts`. `classifyEvent` mappa i
  `LogEvent` in categorie salienti (PR, completati, bloccati, review, errori, pausa);
  `buildWorldDiary` aggrega gli eventi della **giornata locale** per-agente in frasi italiane
  con fascia oraria e un `headline` di sintesi ("3 PR · 2 task completati"). `diaryPlainText`
  per il TTS. Nuovo tab **"Diario"** nel `BottomPanel` (`WorldDiaryPanel`) che ricostruisce il
  diario dagli eventi dello store e lo legge ad alta voce riusando il `narrator` di
  `narration.ts`.
- Test: +29 (12 worldDiary, 7 ogImage, 10 `utils.test.ts` di copertura per gli helper
  condivisi). Typecheck, lint: verdi. **Client 152 → 181** test.

### 2026-06-30 — MCP come strumenti agente (frontiera #1 completa) ✅
- **`mcp_call(server, tool, args)`** — gli agenti possono invocare tool di server
  MCP esterni (Drive/Calendar/Canva…). Nuovo modulo puro `server/src/mcp.ts`:
  `parseMcpServers` (allow-list da JSON, scarta voci malformate), `findMcpServer`,
  `isMcpToolAllowed` (allow-list per-server dei tool), `describeMcpServers`,
  `extractMcpText` (testo dal `content` MCP), `parseJsonRpcResponse` (JSON puro o
  frame SSE), e `callMcpTool` (validazione → POST JSON-RPC `tools/call`, Bearer
  opzionale, timeout, troncamento). Config `SAMS_MCP_SERVERS`; il tool è **gated**
  (`mcpEnabled`) e non viene offerto se la lista è vuota. Cablato nei loop Gemini e
  Groq (anche il guard "nessuno strumento" ora considera MCP). 15 test (14 modulo +
  1 gating in agentTools). README: sezione "MCP tools". Con questo la **frontiera #1
  (mondo reattivo) è completa**. Server test 124 → 139. Typecheck, lint: verdi.

### 2026-06-30 — webhook: opt-in, secondo trigger, README
- **Auto-assegnazione opt-in** — il risveglio non è più sempre attivo: nuovo flag
  `webhookAutoAssign` (default **off**, persistito) con toggle "Rispondi ai webhook
  GitHub" nel pannello Live Sim. A toggle spento il `WakeBridge` non assegna nulla
  (l'evento 🔔 resta nel log, azionabile a mano). Messaggio del runtime reso neutro.
- **Secondo trigger** — `pull_request` con azione `review_requested` genera un `wake`
  di review sulla PR (branch = head ref). 2 test in più (webhook server 9 → 11).
- **README** — nuova sezione "Reactive mode": setup del webhook e avviso esplicito a
  impostare `GITHUB_WEBHOOK_SECRET` quando il runtime è esposto su internet.
- Typecheck, lint, build: verdi. Client 152, server 124.

### 2026-06-30 — webhook in ingresso (frontiera #1, primo pezzo)
- **Webhook GitHub reattivo** 🔔 — il vecchio endpoint inline (solo notifica, niente
  firma) diventa un modulo puro `server/src/webhook.ts`: `verifyGithubSignature`
  (HMAC-SHA256 a tempo costante, raw body catturato dal `verify` di `express.json`;
  segreto vuoto = verifica off per il locale) e `parseGithubEvent` (push / pull_request /
  workflow_run → messaggio + livello). Novità: su **CI fallita** allega un `wake`
  (titolo = "indaga e correggi la CI sul branch X", branch incluso). L'endpoint verifica
  la firma (401 se errata), broadcasta il riassunto e, se c'è un wake, un evento `WARN`
  che porta `wake` sulla `WireEvent`. Lato client: `RemoteUpdate.wake` → `pendingWakes`
  nello store → nuovo `WakeBridge` che assegna il task a un agente scelto da
  `pickFreeAgent` (puro: il più riposato fra i liberi, altrimenti il meno carico). 12 test
  (9 server, 3 client). Test client 149 → 152, server 113 → 122. Typecheck, lint, build: verdi.

### 2026-06-30 — apertura Roadmap 3
Nata dopo un blocco di lavoro sulla Roadmap 2 (eventi stagionali del giardino,
fix degli agenti bloccati da stato `working` stantio, **meta-agente** con
retargeting del repo per-task, **narrazione vocale** TTS, **marketplace di
template**, zoom-verso-il-cursore in scena). Tensione di fondo emersa: SAMS è un
mondo vivo ma **isolato** — un solo osservatore, svegliato solo a mano. Tre
frontiere in sequenza: (1) **mondo reattivo** (webhook in ingresso + MCP come
strumenti), (2) **mondo raccontabile** (replay, immagine OG, giardini di team),
(3) **mondo condiviso** (presence realtime, ruoli/permessi, multiplayer), con la
**profondità simulativa** (relazioni, obiettivi, economia) come tema trasversale.
Gli item ancora aperti della Roadmap 2 sono ereditati qui (⬅️). Prossimo passo
operativo da decidere: probabilmente il **webhook in ingresso** (autonomia che si
auto-alimenta, basso rischio, testabile lato server) o, sul fronte prodotto,
l'**import di template** dalla UI (il pezzo mancante del marketplace, `parseTemplate`
già pronto).
