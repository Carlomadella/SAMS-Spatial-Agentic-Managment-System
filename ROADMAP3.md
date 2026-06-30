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
| 1   | **Mondo reattivo** — webhook in ingresso + MCP come strumenti       | Gli agenti reagiscono al mondo reale (push/PR/CI, Drive/Calendar) senza che tu lo dica | 🟡     | 🏗️    |
| 2   | **Mondo raccontabile** — replay, immagine OG, giardini di team      | Trasforma il lavoro in qualcosa da _condividere_, non solo da guardare              | 🟡     | 💡    |
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
- [ ] 💡 ⬅️ **Sfruttare gli MCP** — esporre agli agenti, come strumenti, le
      integrazioni già disponibili: report su **Google Drive**, eventi su **Calendar**,
      grafiche su **Canva**. Un tool generico `mcp_call(server, tool, args)` con
      allow-list configurabile.
- [ ] 💡 **Trigger temporali / routine** — task ricorrenti (es. "ogni mattina:
      riepilogo PR aperte su Notion"). Cron lato runtime con persistenza SQLite.
- [ ] 💡 **Reazioni a catena** — il completamento di un task può emettere un evento
      che ne innesca un altro (pipeline dichiarative, oltre al `relay_task` puntuale).

## 🎬 Mondo raccontabile (frontiera #2)

- [ ] 💡 ⬅️ **Replay cinematografico** di un task completato — ricostruisce il percorso
      dell'agente + le azioni chiave come una breve clip navigabile (timeline scrubbabile).
      Ottimo per demo e condivisione.
- [ ] 💡 ⬅️ **Immagine OG condivisibile** — esporta il Commit Garden (o un agente, o un
      riepilogo task) come **PNG** via canvas/meta OG, pronto per i social.
- [ ] 💡 ⬅️ **Giardini di team / organizzazione** — vista aggregata di tutti i
      contributor (un prato con molte piante), con classifica e totali.
- [ ] 💡 **Dashboard pubblica read-only** — un link condivisibile che mostra lo stato
      del mondo (agenti, metriche, storico) **senza** poter assegnare task. Riusa
      `publicStatus` + un token di sola lettura.
- [ ] 💡 **Diario del mondo** — un feed narrativo (anche TTS, riusa `narration.ts`)
      che racconta la giornata: "Stamattina blue ha aperto 2 PR, purple è andato in pausa…".

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
