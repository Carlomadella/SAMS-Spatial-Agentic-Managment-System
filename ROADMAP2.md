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

| # | Scommessa | Perché | Effort |
|---|-----------|--------|--------|
| 1 | **Fondamenta dati + sicurezza** — SQLite + test sullo store | Abilitatore nascosto (storico, metriche, multi-utente) e rete di sicurezza sulla logica più delicata | 🟡 |
| 2 | **Fiducia** — diff preview in-app + `run_tests` reali + gate CI | Senza fiducia resta una demo; con essa diventa usabile su repo veri | 🟡 |
| 3 | **Autonomia** — Live simulation mode | Trasforma il prodotto dal claim alla realtà; richiede #1 e #2 come base | 🔴 |

> Sequenza voluta: prima le fondamenta (#1), poi la fiducia (#2), infine
> l'autonomia (#3) che ha bisogno di entrambe.

---

## 🧠 Intelligenza & autonomia degli agenti
- [ ] 💡 **Live simulation mode** (scommessa #3) — gli agenti pescano task da soli da
      una coda (GitHub issues con label `sams`), lavorano, aprono PR, tornano idle e ne
      prendono un altro. Da "tu comandi" a "tu supervisioni".
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
- [ ] 🔜 **Diff preview in-app** — mostrare il diff colorato dei file staged (con
      `requireApproval`) prima di approvare/rifiutare, non solo la lista dei path.
      Ultimo grande tassello rimasto dalla Roadmap 1.
- [ ] 💡 **`run_tests` in sandbox** — strumento che lancia davvero la suite e fa
      autocorreggere l'agente sui fallimenti reali (oggi l'auto-verifica è solo
      "mentale" via prompt: l'agente *dice* di aver controllato i test).
- [ ] 💡 **Gate su CI** — non aprire/mergiare finché GitHub Actions non è verde (i tool
      `gh_list_ci` ci sono già; manca il loop che li usa per decidere).
- [ ] 💡 **Segnalare il troncamento del loop** — quando l'agente esaurisce i `MAX_STEPS`
      senza chiamare `done`, dirlo all'utente invece di concludere in silenzio.

## 🔌 Strumenti & integrazioni
- [ ] 🔜 **Retry/backoff centralizzato** in `http.ts` (onorando `Retry-After`) per i loop
      di scrittura/lettura Notion e le chiamate GitHub rate-limited.
- [ ] 💡 **Commit multi-file atomico** via Git Data API (tree+commit) invece di N PUT
      sequenziali sull'endpoint Contents (evita commit parziali e conflitti di `sha`).
- [ ] 💡 **GitHub: merge / è-mergeabile / stato check** come strumenti agente.
- [ ] 💡 **Notion: database** (creare/aggiornare righe), non solo pagine.
- [ ] 💡 **Webhook in ingresso** — eventi GitHub (push/PR/CI) che svegliano gli agenti.
- [ ] 💡 **Sfruttare gli MCP** — report su Google Drive, eventi su Calendar, grafiche su
      Canva come strumenti agente.

## 📊 Osservabilità
- [ ] 💡 **Storico & costo nel tempo** — "cosa ha fatto l'agente Blu questa settimana?
      quanti token? quante PR mergiate?". Oggi il meter token è solo *istantaneo*.
      Richiede #1 (SQLite).
- [ ] 💡 **Pagina `/api/metrics`** — token usati, task completati, errori, durata media.
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
- [ ] 🏗️ **Test frontend** (scommessa #1) — Vitest + @testing-library/react su store
      (`applyRemote`, coda, relay) e sui bridge. Oggi il frontend ha solo gli smoke e2e.
- [ ] 🔜 **Persistenza su SQLite** (scommessa #1) — settings, stato garden ed eventi su
      DB locale (better-sqlite3) invece di JSON + Map in memoria; sopravvive ai restart.
- [ ] 💡 **Auth opzionale sul runtime** — header con token locale per le route mutanti;
      bind `127.0.0.1` in dev, `0.0.0.0` solo in container.
- [ ] 💡 **Pre-commit hook** (husky + lint-staged) — lint+typecheck prima del commit.
- [ ] 💡 **Coverage in CI** — soglia minima su `agentTools`, `http`, `garden/model`.
- [ ] 💡 **i18n** — oggi i messaggi mescolano IT/EN; estrarre le stringhe e scegliere una
      lingua di default.

## ♿ UX / Accessibilità
- [ ] 💡 **Navigazione da tastiera nel 3D** — selezione/azione agenti senza mouse, label
      ARIA sugli elementi interattivi.
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
