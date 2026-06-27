# 🗺️ SAMS — Roadmap 2 (il capitolo successivo)

La **Roadmap 1** (`ROADMAP.md`) è stata portata a termine: stanza 3D viva, agenti
autonomi multi-provider (Gemini / Groq / Claude), Commit Garden con stagioni e
biomi, runtime Express con SSE, onboarding, test e2e. A seguire è arrivato un
**pass di qualità** che ha consolidato le fondamenta:

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

## ⭐ Shortlist consigliata (massimo impatto sul prossimo ciclo)

| # | Idea | Stato | Impatto | Effort |
|---|------|-------|---------|--------|
| 1 | **Anteprima & approvazione del diff in-app** prima del push | 🔜 | 🔴 | 🟡 |
| 2 | **Persistenza su SQLite** (al posto del JSON) per settings/garden/eventi | 🔜 | 🔴 | 🟡 |
| 3 | **Test frontend** (Vitest + Testing Library) sullo store e sui bridge | 🔜 | 🟡 | 🟢 |
| 4 | **Retry/backoff centralizzato** per GitHub/Notion (oltre al timeout) | 💡 | 🟡 | 🟢 |
| 5 | **Auth opzionale sul runtime** (token locale) + bind 127.0.0.1 in dev | 💡 | 🔴 | 🟡 |

---

## 🧠 Intelligenza & autonomia degli agenti
- [ ] 💡 **Anteprima & approvazione del diff in-app** — mostrare nel pannello destro il
      diff dei file staged (con `requireApproval`) prima di approvare/rifiutare, invece
      della sola lista dei path. È l'ultimo grande tassello della Roadmap 1.
- [ ] 💡 **Piano rivedibile** — l'utente può modificare/riordinare i passi di
      `announce_plan` prima che l'agente proceda.
- [ ] 💡 **Memoria di progetto persistente** — oltre alle linee guida del repo, una
      memoria per-agente che sopravvive tra i task (cosa ha già fatto, decisioni prese).
- [ ] 💡 **Auto-verifica eseguita davvero** — strumento `run_tests` che lancia la suite
      in una sandbox e fa autocorreggere l'agente sui fallimenti reali (oggi la verifica
      è solo "mentale" via prompt).
- [ ] 💡 **Sub-agenti paralleli / orchestrazione** — un agente "lead" che spezza un task
      e delega in parallelo (estende `relay_task` da 1:1 a 1:N con join dei risultati).
- [ ] 💡 **Sfruttare gli MCP disponibili** — report su Google Drive, eventi su Calendar,
      grafiche su Canva come strumenti agente.

## 🔌 Strumenti & integrazioni
- [ ] 💡 **Retry/backoff centralizzato** in `http.ts` (onorando `Retry-After`) per i loop
      di scrittura/lettura Notion e le chiamate GitHub rate-limited.
- [ ] 💡 **Commit multi-file atomico** via Git Data API (tree+commit) invece di N PUT
      sequenziali sull'endpoint Contents (evita commit parziali e conflitti di `sha`).
- [ ] 💡 **GitHub: merge/è-mergeabile, stato check per PR** come strumenti agente.
- [ ] 💡 **Notion: database** (creare/aggiornare righe), non solo pagine.
- [ ] 💡 **Webhook in ingresso** — eventi GitHub (push/PR/CI) che svegliano gli agenti.

## 🎮 Mondo 3D (feel "The Sims")
- [ ] 💡 **Pathfinding attorno ai mobili** (oggi i percorsi sono in linea retta).
- [ ] 💡 **Camera cinematografica** che segue dolcemente l'agente selezionato (estende
      l'attuale `CameraFollow` con inquadrature e transizioni).
- [ ] 💡 **Mood/energia** degli agenti — pausa caffè quando idle a lungo, stanchezza dopo
      task lunghi, espressioni legate all'esito (successo/errore).
- [ ] 💡 **Animazioni extra** — disegnare sulla lavagna, prendere un caffè, stretching.
- [ ] 💡 **Suoni ambientali** legati al ciclo giorno/notte già esistente.
- [ ] 💡 **Mobili davvero vivi** — il monitor mostra il diff reale del file in scrittura,
      la media-wall i task in coda (oggi mostra solo titolo + progresso).

## 🌿 Commit Garden
- [ ] 💡 **Immagine OG condivisibile** — esporta il giardino come PNG (canvas/OG meta) per
      i social. (Rimasto dalla Roadmap 1.)
- [ ] 💡 **Giardini di team / organizzazione** — vista aggregata di tutti i contributor.
- [ ] 💡 **Eventi stagionali** — fioriture speciali, decorazioni a tema (festività).
- [ ] ❄️ **Auto-innaffiatura via webhook** — opzionale (oggi refresh manuale, scelta voluta).

## 🤝 Collaborazione & multi-utente
- [ ] 💡 **Presence in tempo reale** — più utenti vedono gli stessi agenti muoversi.
- [ ] 💡 **Visualizzazione degli handoff** — una "linea" 3D quando un agente fa `relay_task`
      verso un altro.
- [ ] 💡 **Ruoli/permessi** sul workspace (chi può assegnare task, chi solo osservare).

## 🛠️ Solidità & produzione (engineering)
- [ ] 🔜 **Persistenza su SQLite** — settings, stato garden ed eventi su un DB locale
      (better-sqlite3) invece di JSON + Map in memoria; sopravvive ai restart, niente più
      `pendingBuffer` volatile.
- [ ] 🔜 **Test frontend** — Vitest + @testing-library/react su store (`applyRemote`,
      coda, relay) e sui bridge (Queue/Relay/Idle/Notification/Responsive). Oggi il
      frontend ha solo gli smoke e2e.
- [ ] 💡 **Auth opzionale sul runtime** — header con token locale condiviso per le route
      mutanti; bind `127.0.0.1` in dev, `0.0.0.0` solo in container.
- [ ] 💡 **Pre-commit hook** (husky + lint-staged) — lint+typecheck prima del commit.
- [ ] 💡 **Coverage in CI** — soglia minima su `agentTools`, `http`, `garden/model`.
- [ ] 💡 **Logging strutturato** lato runtime (livelli, niente segreti) e una pagina
      `/api/metrics` con token usati, task completati, errori.
- [ ] 💡 **i18n** — oggi i messaggi mescolano IT/EN; estrarre le stringhe e scegliere una
      lingua di default configurabile.

## ♿ UX / Accessibilità
- [ ] 💡 **Navigazione da tastiera nel 3D** — selezione/azione agenti senza mouse, label
      ARIA sugli elementi interattivi.
- [ ] 💡 **Tour interattivo** post-onboarding (evidenzia inspector, scena, garden).
- [ ] 💡 **Tema chiaro/scuro** rifinito su tutti i pannelli (alcuni colori sono hardcoded).

---

## 🗒️ Log dei brainstorming (Roadmap 2)

### 2026-06-27 — apertura Roadmap 2
Nata dopo il completamento della Roadmap 1 e un **pass di qualità** dedicato:
de-duplicazione del runtime (`agentTools.ts`), `http.ts` condiviso con timeout e
parse difensivo, validazione repo/path GitHub, segreti a `0600`, SSE senza leak,
middleware errori, `pendingBuffer` con TTL, **ESLint** reale in CI e suite test
salita a 50.

Focus del prossimo ciclo (shortlist): **anteprima/approvazione diff in-app**,
**persistenza su SQLite**, **test frontend**, **retry/backoff centralizzato**,
**auth opzionale**. Direzione generale: dalla "messa in funzione" alla
**profondità, fiducia e scala**. Come per la Roadmap 1, si accumulano qui le idee
e si procede in ordine di priorità, verificando con build/lint/test ad ogni giro.
