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
- [ ] 💡 **Trigger temporali / routine** — task ricorrenti (es. "ogni mattina:
      riepilogo PR aperte su Notion"). Cron lato runtime con persistenza SQLite.
- [ ] 💡 **Reazioni a catena** — il completamento di un task può emettere un evento
      che ne innesca un altro (pipeline dichiarative, oltre al `relay_task` puntuale).

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

- [ ] 💡 ⬅️ **Presence in tempo reale** — più utenti vedono gli stessi agenti muoversi
      e gli stessi eventi, live. Richiede un canale bidirezionale (WebSocket o SSE +
      POST) e una riconciliazione dello store autorevole lato server.
- [ ] 💡 ⬅️ **Ruoli/permessi sul workspace** — chi assegna task, chi solo osserva.
      Si appoggia all'auth opzionale già esistente (`SAMS_TOKEN`) estesa a ruoli.
- [ ] 💡 ⬅️ **Ufficio multiplayer** — più _umani_ nello stesso workspace in tempo
      reale, con cursori/avatar e cronologia condivisa. Il salto architetturale del
      capitolo: stato del mondo autorevole sul server, client come viste.
- [ ] 💡 **Chat di workspace** — un canale umano-umano e umano→agente accanto alla
      scena, separato dall'event log.

## 🧠 Profondità simulativa (trasversale)

- [ ] 💡 **Relazioni fra agenti** — la collaborazione ripetuta (`relay_task`, chiacchiere)
      costruisce affinità; agenti "amici" si aiutano più spesso, formano coppie di lavoro.
- [ ] 💡 **Obiettivi a lungo termine** — un agente può avere un _progetto_ (più task
      collegati, una milestone) e una barra di avanzamento che persiste fra le sessioni.
- [ ] 💡 **Economia del token come risorsa di gioco** — il budget token diventa una
      "valuta": gli agenti che lavorano meglio (PR mergiate) ne guadagnano di più.
- [ ] 💡 **Meta-agente proattivo** — il meta-agente (già esistente) propone migliorie a
      SAMS _da solo_ quando è idle, non solo su comando. Estende la Live Sim al repo SAMS.

## 🎮 Mondo 3D & feel

- [ ] 💡 **Stagioni/meteo nella casa** — il ciclo giorno/notte c'è; aggiungere pioggia
      sui vetri, luce stagionale, festoni negli eventi (riusa `seasonalEvents.ts`).
- [ ] 💡 **Oggetti interagibili** — clic su lavagna/monitor/caffè per micro-interazioni
      dell'utente, non solo degli agenti.
- [ ] 💡 **Personalizzazione dell'ufficio** — spostare i mobili, scegliere il tema della
      stanza; layout persistito.

## ♿ UX / Accessibilità & prodotto

- [ ] 💡 ⬅️ **Tema chiaro/scuro** rifinito su tutti i pannelli (alcuni colori sono
      ancora hardcoded); centralizzare i token di colore.
- [ ] 💡 ⬅️ **Tour interattivo** post-onboarding (evidenzia inspector, scena, garden):
      l'onboarding spiega i _concetti_, il tour mostra l'_UI_.
- [ ] 💡 ⬅️ **Mobile usabile** — sotto i 768px i pannelli collassano ma scena+inspector
      non sono davvero usabili; ripensare il layout touch.
- [ ] 💡 **Import di un template agente** dalla UI — completa il marketplace: incolla un
      JSON (`parseTemplate` esiste già) per creare/configurare un agente.
- [ ] 💡 **Palette comandi estesa** — azioni rapide per ogni feature nuova (applica
      template, esporta, avvia replay…).

## 🛠️ Solidità & produzione (engineering)

- [ ] 💡 **Stato del mondo autorevole sul server** — prerequisito del multiplayer:
      migrare la verità di agenti/task da Zustand-persist (client) a SQLite (server),
      con il client come vista. Grande, ma abilita le frontiere #1 e #3.
- [ ] 💡 **Test di rendering dei componenti** — la logica pura è ben coperta; manca il
      rendering (React Testing Library) dei pannelli critici.
- [ ] 💡 **Rate-limit & quota per-utente** — quando il workspace è condiviso, evitare
      che un utente saturi il runtime.
- [ ] ❄️ ⬅️ **Auto-innaffiatura via webhook** — diventa naturale con la frontiera #1
      (eventi GitHub → giardino). Oggi refresh manuale, scelta voluta.

---

## 🗒️ Log dei brainstorming (Roadmap 3)

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
