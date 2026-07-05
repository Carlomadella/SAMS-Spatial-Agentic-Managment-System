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
quarto capitolo scioglie proprio questo: rendere il mondo **condiviso** e SAMS
**distribuibile**.

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
persone ci lavorano insieme e quando chiunque può ospitarlo per il proprio team.
Finora la verità del mondo vive nel browser (Zustand-persist) di un solo utente;
il salto del capitolo 4 è spostarla sul server e aprire le porte agli altri —
prima come architettura, poi come prodotto rifinito e installabile.

## 🎯 Le 3 frontiere (in ordine di esecuzione)

| #   | Frontiera                                                                | Perché                                                                             | Effort | Stato |
| --- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | ------ | ----- |
| 1   | **Stato autorevole sul server** — la verità del mondo migra su SQLite    | Prerequisito di tutto il resto: senza, presence e multiplayer non stanno in piedi | 🔴     | 💡    |
| 2   | **Mondo condiviso** — presence realtime + ruoli/permessi + multiplayer   | Da demo personale a strumento di squadra: più persone, stesso ufficio, live       | 🔴     | 💡    |
| 3   | **Prodotto & distribuzione** — deploy, onboarding, mobile, temi          | Chiunque può ospitare e usare SAMS; la PWA è il primo tassello, non l'ultimo      | 🟡     | 💡    |

> Sequenza voluta: prima l'**architettura** (lo stato autorevole è la fondazione),
> poi le **persone** (presence e multiplayer ci si appoggiano sopra), infine la
> **distribuzione** (ha senso rifinire il prodotto quando c'è qualcosa da
> condividere). La #3 può però avanzare in parallelo per i pezzi indipendenti
> (mobile, temi, onboarding) senza aspettare le altre.

---

## 🧱 Stato autorevole sul server (frontiera #1)

- [ ] 💡 ⬅️ **Migrare la verità di agenti/task da Zustand-persist a SQLite** — il
      client diventa una _vista_; il server è l'unica sorgente di verità. Grande,
      ma abilita presence e multiplayer. Serve uno schema (agenti, task, eventi) e
      un'API di lettura/scrittura autorevole accanto al runtime già esistente.
- [ ] 💡 **Canale bidirezionale** — oggi lo stream è solo server→client (SSE). Per
      lo stato autorevole serve anche client→server strutturato (WebSocket, o SSE +
      POST) con una **riconciliazione** deterministica dello store.
- [ ] 💡 **Migrazione morbida** — un import dallo stato locale (localStorage) alla
      prima connessione, così nessuno perde il proprio ufficio nel passaggio.
- [ ] 💡 **Ottimismo + conferma** — la UI applica subito le azioni e le riconcilia
      con l'eco autorevole del server (come già fa `applyRemote` per i task).

## 🤝 Mondo condiviso (frontiera #2)

- [ ] 💡 ⬅️ **Presence in tempo reale** — più utenti vedono gli stessi agenti
      muoversi e gli stessi eventi, live. Si appoggia al canale bidirezionale e allo
      stato autorevole della frontiera #1.
- [ ] 💡 ⬅️ **Ruoli/permessi sul workspace** — chi assegna task, chi solo osserva.
      Estende l'auth opzionale già esistente (`SAMS_TOKEN`) a ruoli (owner/editor/
      viewer), con la dashboard pubblica come "viewer" degenere già pronto.
- [ ] 💡 ⬅️ **Ufficio multiplayer** — più _umani_ nello stesso workspace con
      cursori/avatar e cronologia condivisa. Il salto architetturale del capitolo.
- [ ] 💡 ⬅️ **Chat di workspace** — un canale umano-umano e umano→agente accanto
      alla scena, separato dall'event log.
- [ ] 💡 **Rate-limit & quota per-utente** ⬅️ — quando il workspace è condiviso,
      evitare che un utente saturi il runtime (per-utente, non solo per-agente).

## 📦 Prodotto & distribuzione (frontiera #3)

- [x] ✅ **PWA installabile + offline** — manifest, service worker (senza toccare
      `/api` né l'SSE), icone generate da `favicon.svg`. Primo tassello della
      distribuzione: SAMS si installa e parte standalone.
- [ ] 💡 **Deploy con un click** — un percorso documentato (Docker già c'è) verso
      un host gestito (Fly/Render/Railway) con env chiare; "porta il tuo repo e le
      tue chiavi" in pochi minuti.
- [ ] 💡 ⬅️ **Mobile davvero usabile** — sotto i 768px i pannelli collassano ma
      scena+inspector non sono usabili; ripensare il layout touch (la PWA ora si
      installa su telefono, quindi il layout mobile conta di più).
- [ ] 💡 ⬅️ **Tema chiaro/scuro** rifinito su tutti i pannelli (alcuni colori sono
      ancora hardcoded); centralizzare i token di colore.
- [ ] 💡 ⬅️ **Tour interattivo** post-onboarding (evidenzia inspector, scena,
      garden): l'onboarding spiega i _concetti_, il tour mostra l'_UI_.
- [ ] 💡 ⬅️ **Palette comandi estesa** — azioni rapide per ogni feature nuova
      (applica template, esporta, avvia replay, crea routine/reazione…).
- [ ] 💡 **Notifica "nuova versione"** — il service worker già supporta
      `skip-waiting`; manca il prompt in-app quando è pronta una nuova build.

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
- [ ] 💡 **E2E cross-platform** — la config Playwright ha un `executablePath`
      Chromium hardcoded per la CI Linux; renderla portabile per girare anche in
      locale (usa il Chromium gestito da Playwright fuori dalla CI).
- [ ] 💡 **Osservabilità del runtime** — metriche/log strutturati sufficienti a
      diagnosticare un workspace condiviso (chi ha fatto cosa, quando).

---

## 🗒️ Log dei brainstorming (Roadmap 4)

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
ruoli/permessi, ufficio multiplayer, chat, che si appoggiano alla #1; (3)
**prodotto & distribuzione** — la PWA è il primo tassello, seguono deploy con un
click, mobile usabile, temi, tour, palette estesa. Come temi trasversali
proseguono la **profondità agentica** (multi-repo, preset, collaborazione,
qualità dell'output) e il **mondo 3D & feel**.

Prossimo passo operativo da decidere con l'utente: probabilmente lo **stato
autorevole sul server** (sblocca tutto il resto ma è il pezzo più grosso) oppure,
sul fronte prodotto e a basso rischio, i pezzi indipendenti della #3 (**mobile
usabile**, **temi**, **tour**) che non aspettano l'architettura.
