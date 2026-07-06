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
- [ ] 💡 ⬅️ **Presence in tempo reale (agenti live)** — più utenti vedono gli stessi
      agenti muoversi e gli stessi eventi, live. Estende il conteggio osservatori
      (sopra) con lo stato condiviso: si appoggia al canale bidirezionale e allo
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
      _Manca ancora: umano→agente._
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

- [ ] 💡 **Multi-repo per-task** ⬅️ — oltre al retarget del meta-agente, poter
      scegliere il repo bersaglio per singolo task/agente dalla UI.
- [ ] 💡 **Preset ruolo/modello per-agente** ⬅️ — profili salvati (ruolo + modello +
      istruzioni) applicabili in un click; si appoggia al marketplace di template.
- [ ] 💡 **Protocolli di collaborazione** — oltre a relay/reazioni a catena, un
      "tavolo" dove più agenti contribuiscono allo stesso obiettivo con hand-off
      espliciti e stato condiviso.
- [ ] 💡 **Qualità dell'output** — un passo di valutazione (lint/test/CI o un
      agente revisore) che dà un voto al risultato prima della PR, riusando il gate
      CI già presente.

## 🎮 Mondo 3D & feel (trasversale)

- [ ] 💡 ⬅️ **Stagioni/meteo nella casa** — il ciclo giorno/notte c'è; aggiungere
      pioggia sui vetri, luce stagionale, festoni (riusa `seasonalEvents.ts`).
- [ ] 💡 ⬅️ **Oggetti interagibili** — clic su lavagna/monitor/caffè per
      micro-interazioni dell'utente, non solo degli agenti.
- [ ] 💡 ⬅️ **Personalizzazione dell'ufficio** — spostare i mobili, scegliere il
      tema della stanza; layout persistito (naturale una volta che lo stato è
      autorevole sul server).

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
