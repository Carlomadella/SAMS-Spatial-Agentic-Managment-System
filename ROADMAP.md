# 🗺️ SAMS — Roadmap & Brainstorming

Idee per far crescere **SAMS** (Spatial Agentic Management System): stanza 3D
isometrica + agenti AI autonomi (Gemini Flash) con strumenti GitHub/Notion, il
**Commit Garden** in 3D e il runtime Express.

> ✅ **Questa roadmap è stata completata.** Il capitolo successivo vive in
> [`ROADMAP2.md`](./ROADMAP2.md) (anteprima diff in-app, SQLite, test frontend,
> retry/backoff, auth opzionale, …).
>
> _Nota di chiusura (2026-07-08):_ le caselle `[ ]` qui sotto sono brainstorm
> originari confluiti nei capitoli successivi — **anteprima diff, mood/energia,
> camera cinematografica, pathfinding, immagine OG, giardini di team** sono stati
> fatti in R2–R4; **auto-innaffiatura via webhook** è ❄️ in pausa voluta;
> **web search/fetch degli agenti** e **report via MCP (Drive/Calendar/Canva)**
> restano idee non perseguite (integrazioni esterne + decisione di prodotto).

> **Come si mantiene questo file**
> A ogni sessione di brainstorming aggiungo nuove idee qui e aggiorno gli stati.
> In fondo c'è un **Log dei brainstorming** datato.
>
> **Legenda stato:** 💡 idea · 🔜 prossimo · 🏗️ in corso · ✅ fatto · ❄️ in pausa
> **Impatto/Effort:** 🟢 basso · 🟡 medio · 🔴 alto

---

## ⭐ Shortlist consigliata (alto impatto, fattibile col setup gratuito)

| # | Idea | Stato | Impatto | Effort |
|---|------|-------|---------|--------|
| 1 | Anteprima + **approvazione del diff** prima del push | 🔜 | 🔴 | 🟡 |
| 2 | **Libreria di istruzioni pronte** (task in 1 click) | ✅ | 🔴 | 🟢 |
| 3 | **Agenti più vivi**: cammino mirato + fumetto col passo corrente | ✅ | 🟡 | 🟡 |
| 4 | **Auto-verifica**: l'agente lancia test/lint e si autocorregge | 💡 | 🔴 | 🟡 |
| 5 | **Persistenza** di agenti/task/eventi al refresh | ✅ | 🟡 | 🟢 |

---

## 🧠 Intelligenza & autonomia degli agenti
- [x] ✅ **Piano visibile prima di agire** — `announce_plan` emette 4–6 passi prima di qualsiasi tool; visibili nell'AgentInspector come lista numerata.
- [x] ✅ **Auto-verifica qualità** — dopo ogni gh_write_file il prompt istruisce l'agente a leggere i test correlati e verificare mentalmente che passino; se trova discrepanze corregge prima di chiamare done.
- [x] ✅ **Memoria di progetto** — l'agente legge un file di linee guida dal repo (`AGENTS.md` / `CONVENTIONS.md` / `.sams/guide.md` / `SAMS_GUIDE.md`) e lo include nel prompt.
- [x] ✅ **Ruoli specializzati** — selettore di ruolo nell'inspector (Generalist / Revisore / Tester / Documentatore / Architetto); ogni ruolo inietta istruzioni aggiuntive nel prompt di sistema.
- [x] ✅ **Istruzioni permanenti per agente** — textarea nell'inspector, persistita nello store, iniettata nel prompt con massima priorità.
- [x] ✅ **Coda di task per agente** — l'inspector mostra una lista "In coda"; il bottone diventa "Aggiungi alla coda" quando l'agente è occupato; al completamento del task il prossimo parte automaticamente.
- [x] ✅ **Collaborazione tra agenti** — strumento `relay_task`: l'agente specifica il ruolo (Tester/Revisore/Documentatore/Architetto) o il nome del destinatario; il runtime trova l'agente e assegna il task automaticamente (o lo mette in coda se occupato).

## 🔌 Più strumenti per gli agenti
- [ ] 💡 **Web search / fetch** — ricerca prima di scrivere.
- [x] ✅ **gh_create_issue** — l'agente può aprire issue su GitHub (per segnalare bug o richiedere feature trovate durante il lavoro).
- [x] ✅ **GitHub esteso** — `gh_list_prs`, `gh_read_pr`, `gh_comment_pr`, `gh_list_ci`; gli agenti leggono PR, postano commenti e vedono lo stato CI.
- [x] ✅ **Notion completo** — `notion_read` (legge prima di scrivere), `notion_create_page` (pagina figlia con contenuto markdown), `notion_replace_page` (sostituzione blocchi).
- [x] ✅ **Notifiche a fine task** — browser Notification API; la permission viene richiesta al primo completamento e poi ogni task finito mostra una notifica nativa.
- [ ] 💡 **Sfruttare gli MCP disponibili** — report su Google Drive, eventi su Calendar, grafiche su Canva.

## 🎮 Mondo 3D (feel "The Sims")
- [x] ✅ **Cammino mirato** — all'assegnazione del task l'agente cammina verso la zona pertinente (docs→Reading Nook, codice→Work Desk).
- [x] ✅ **Animazione di digitazione** — quando l'agente è working e fermo, le braccia vanno in posizione di typing con stutter alternato; testa inclinata in avanti.
- [ ] 💡 **Animazioni extra** — disegna sul muro, coffee break idle.
- [x] ✅ **Fumetti di stato** — sopra ogni agente compare l'ultima azione (dagli eventi SSE), per qualche secondo.
- [x] ✅ **Mobili vivi** — il monitor in scena mostra l'agente attivo e la barra di progresso del task in corso.
- [x] ✅ **Ciclo giorno/notte** — `DayNightCycle` anima luci, cielo e nebbia su un periodo di 120 s.
- [ ] 💡 **Mood/energia** degli agenti (pausa caffè quando idle).
- [ ] 💡 **Camera cinematografica** che segue l'agente selezionato.
- [ ] 💡 **Pathfinding** attorno ai mobili (ora è in linea retta).

## 🖱️ UX / UI
- [ ] 💡 **Anteprima & approvazione del diff** nel pannello destro prima del push.
- [x] ✅ **Libreria di istruzioni pronte** — 12 template categorizzati (Notion / Codice / Documentazione / Contenuti / Manutenzione) nell'inspector; riempiono titolo+branch e selezionano il primo segnaposto da editare.
- [x] ✅ **Onboarding guidato** al primo avvio — wizard 2-step (dismissibile, in localStorage) che spiega SAMS e guida ai 3 passi per iniziare.
- [x] ✅ **Meter di utilizzo/token** — token Gemini per task (TasksPanel) + totale cumulativo nella StatusBar.
- [x] ✅ **Output in streaming** nell'event log — l'agente emette il testo di ragionamento del modello (💭) prima di ogni chiamata a strumento.
- [x] ✅ **Layout responsive/mobile** — `ResponsiveBridge` collassa i pannelli laterali su schermi < 768 px e si aggiorna al resize.

## 🌿 Commit Garden
- [x] ✅ **Specie/biomi diversi** — bioma (oak/pine/birch) derivato dall'username via hash; palette per tronco, foglie e foglie scure.
- [x] ✅ **Stagioni/meteo** — stagione rilevata dal mese corrente; cielo/nebbia/sole stagionali; `FallingLeaves` in autunno, `Snowflakes` in inverno; farfalle nascoste in inverno.
- [x] ✅ **Achievement/badge** — `computeBadges()` restituisce emoji+etichetta in base a innaffiature, streak, stadio e crescita; mostrati come pill nel pannello di controllo del giardino.
- [ ] 💡 **Immagine OG condivisibile** per i social.
- [ ] 💡 **Giardini di team** (tutta l'organizzazione).
- [ ] ❄️ **Auto-innaffiatura via webhook** — opzionale (per ora refresh manuale, scelta voluta).

## 🛠️ Solidità (engineering)
- [x] ✅ **Persistenza** — agenti/task/eventi/layout sopravvivono al refresh (Zustand `persist` su localStorage; flag transitori esclusi).
- [x] ✅ **CI su PR** — `.github/workflows/ci.yml`: npm build + server typecheck + server test (vitest) su ogni push/PR.
- [x] ✅ **Test frontend / e2e** (Playwright) — 5 smoke test (`e2e/smoke.spec.ts`): caricamento, onboarding wizard, impostazioni, command palette, garden view. Tutti 5 passano.
- [x] ✅ **Dockerizzare il runtime** — `Dockerfile` multi-stage (Vite build + tsx server) + `docker-compose.yml`; `docker compose up` serve frontend e API sulla porta 3000.
- [ ] 💡 **Gestione rate-limit/retry** centralizzata (oltre al backoff Gemini esistente).
- [x] ✅ **Provider Groq** — Llama 3.3 70B via API OpenAI-compatible (free tier); selezionabile in Impostazioni con chiave `gsk_…`.

## ✅ Già fatto (storico)
- [x] ✅ Stanza 3D isometrica in stile salotto (mobili, pavimento in parquet, boiserie, applique, orologio).
- [x] ✅ Personaggi agenti come robottini chibi espressivi (occhi che sbattono, ciclo di camminata, spia di stato).
- [x] ✅ Agenti autonomi via Gemini Flash (function-calling: GitHub read/write/branch, Notion write).
- [x] ✅ **Commit Garden** trasformato in scena 3D vera (prato, cielo, recinto, la tua pianta che cresce per stadi).
- [x] ✅ Integrazione runtime (SSE, settings, provisioning) + Vite proxy (no CORS).
- [x] ✅ ErrorBoundary + code-splitting delle scene 3D.
- [x] ✅ Persistenza dello stato (Zustand persist) — niente più reset al refresh.
- [x] ✅ Libreria di istruzioni pronte (template categorizzati) nell'inspector.
- [x] ✅ Agenti più vivi: fumetti con l'ultima azione + cammino verso la zona pertinente.
- [x] ✅ Meter dei token Gemini (per task + totale cumulativo).
- [x] ✅ Memoria di progetto: l'agente legge le linee guida del repo e le rispetta.
- [x] ✅ Notion `notion_read`: l'agente legge una pagina prima di scrivere (no duplicati).
- [x] ✅ Ruoli specializzati: Generalist · Revisore · Tester · Documentatore · Architetto — selettore nell'inspector, prompt role-aware nel runtime.
- [x] ✅ Output in streaming: l'agente usa `generateContentStream` e mostra il testo di ragionamento (💭) nell'event log prima di ogni chiamata a strumento.
- [x] ✅ Istruzioni permanenti per agente: textarea nell'inspector con indicatore ●, iniettata nel prompt a massima priorità; agenti seed pre-popolati con istruzioni di esempio.

---

## 🗒️ Log dei brainstorming

### 2026-06-26
Primo brainstorming completo organizzato per aree (vedi sezioni sopra).
Shortlist consigliata: anteprima/approvazione diff, libreria istruzioni pronte,
agenti più vivi, auto-verifica, persistenza. Scelta: accumulare le idee in questo
file (nessuna implementazione in questo giro).

### 2026-06-26 — implementazione (giro 1)
Iniziata l'esecuzione in ordine di priorità (più urgenti e a basso rischio prima,
verificabili con build/test, dato che non posso aprire il browser).
- ✅ **Persistenza** dello stato (Zustand `persist`): agenti, task, eventi, ambiente,
  agente selezionato e layout sopravvivono al refresh. Esclusi i flag transitori
  (command palette, modali, toast, stato runtime). I `target` di camminata vengono
  azzerati al rehydrate per non riprendere percorsi obsoleti.
- ✅ **Libreria di istruzioni pronte**: 12 template categorizzati nell'inspector;
  un clic riempie titolo + branch e seleziona il primo `{segnaposto}` da editare.
- 🔜 **Prossimo**: anteprima + approvazione del diff prima del push (più delicato:
  tocca runtime + frontend, lo affronto con cura e test lato server).

### 2026-06-26 — implementazione (giro 2)
- ✅ **Agenti più vivi**: ogni agente mostra un **fumetto** con la sua ultima azione
  (dagli eventi SSE: `read X`, `write Y`, `Notion ← …`) che svanisce dopo qualche
  secondo; all'assegnazione di un task l'agente **cammina verso la zona** pertinente
  (docs/Notion → Reading Nook, codice → Work Desk).
- 📌 **Re-sequenziamento ragionato**: l'approvazione-diff in-app è scesa di urgenza
  perché gli agenti **già** lavorano su un branch dedicato + PR (niente arriva su
  `main` senza review su GitHub). Inoltre non posso testarne il flusso live (niente
  chiave Gemini né browser qui). Resta in cima come prossimo grande blocco, da fare
  con test lato server e una verifica live da parte tua.
- 🔜 **Prossimo candidato**: meter di utilizzo/token + output in streaming, oppure
  l'approvazione-diff. Procedo col più sicuro-da-verificare salvo tue indicazioni.

### 2026-06-26 — implementazione (giro 3)
- ✅ **Meter dei token**: il runtime accumula i token Gemini (`usageMetadata`) di ogni
  task e li invia a fine lavoro; la UI mostra i token **per task** (TasksPanel) e il
  **totale cumulativo** nella StatusBar (persistito). Aggiunto un test lato server
  per `usageTokens` (ora 8 test totali).
- 📄 Creato **`IMPLEMENTAZIONE.md`**: documento con tutto ciò che è stato implementato
  dopo il brainstorming (persistenza, template, agenti vivi, meter token).

### 2026-06-26 — implementazione (giro 4)
- ✅ **Memoria di progetto**: prima di lavorare, l'agente prova a leggere dal repo
  (base branch) un file di linee guida — in ordine `AGENTS.md`, `CONVENTIONS.md`,
  `.sams/guide.md`, `SAMS_GUIDE.md` — e, se presente, lo include nel prompt di sistema
  così rispetta stile e regole del progetto. Estratta la funzione pura `composeSystem`
  con 4 test (ora **12 test** lato server).

### 2026-06-26 — implementazione (giro 5)
- ✅ **Notion `notion_read`**: nuovo strumento che legge il contenuto testuale di una
  pagina (per titolo, con paginazione dei blocchi). Il prompt ora istruisce l'agente a
  **leggere prima di scrivere** per evitare duplicati / aggiornare contenuti esistenti.
  Aggiunte `readPageByTitle` + `blockPlainText` in `notion.ts`. (12 test, typecheck ✓.)

### 2026-06-27 — implementazione (giro 9)
- Rimosso il contenuto pre-impostato dalle istruzioni permanenti degli agenti seed (ora
  tutte a `""`). La funzionalità rimane nell'inspector per chi vuole usarla.
- ✅ **Auto-clear on done**: quando l'utente marca un agente come "done" (quick-set), il
  task viene cancellato automaticamente dopo 1,5 s e l'agente torna idle. Quando il
  runtime chiude senza modifiche (`status: "idle"`), il task viene cancellato dopo 0,9 s.
- ✅ **Rename agente inline**: input "ghost" nel pannello inspector (compare il bordo al
  focus) che chiama `renameAgent` direttamente — niente bottoni extra.
- ✅ **Auto-verifica** nel prompt: dopo ogni gh_write_file, l'agente legge i test
  correlati (*.test.ts, *.spec.ts, __tests__/) e verifica mentalmente che passino; se
  trova discrepanze, corregge prima di chiamare done. 2 nuovi test (ora **28 test**).

### 2026-06-27 — implementazione (giro 8)
- ✅ **Istruzioni permanenti per agente**: nuovo campo `instructions: string` sull'`Agent`
  (persistito, con migrazione automatica al rehydrate). Nell'inspector, una sezione
  `<details>` collassabile "Istruzioni permanenti" con textarea, contatore caratteri
  (max 1200) e indicatore ● quando non vuota. Le istruzioni vengono trasmesse al runtime
  (`AssignBody.instructions`) e incluse in `composeSystem` con la massima priorità (sopra
  ruolo e guida di progetto). Aggiornati 5 agenti seed con istruzioni di esempio concrete
  (TypeScript strict, test dei casi limite, review costruttiva, architettura semplice,
  documentazione breve). 3 nuovi test su `composeSystem` (ora **26 test**).

### 2026-06-27 — implementazione (giro 7)
- ✅ **Output in streaming**: il loop dell'agente usa ora `generateContentStream` invece di
  `generateContent`. Il testo che il modello emette _prima_ di chiamare uno strumento (il suo
  ragionamento: "Leggo il file per capire la struttura…") viene mostrato nell'event log con il
  prefisso 💭. Estratta la funzione pura `collectStream` (prende un `AsyncGenerator` e lo drena
  in `{text, functionCalls, tokens}`), testabile senza mock del client. 5 nuovi test
  (ora **23 test** lato server).

### 2026-06-27 — implementazione (giro 11)
- ✅ **Coda di task per agente**: `taskQueue: QueuedTask[]` sull'`Agent`. Nell'inspector il bottone diventa "Aggiungi alla coda" quando l'agente ha già un task; la coda è mostrata con rimozione per singolo item. Il `QueueBridge` (componente invisibile in `App.tsx`) ascolta la store via `subscribe` e, quando un agente passa a idle con coda non vuota, avvia automaticamente il prossimo task (locale + backend) dopo 800ms.
- ✅ **Animazione di digitazione**: quando `status === "working"` e non in movimento, le braccia vanno in posizione di typing (forward, z-inward) con stutter alternato (`sin(t*13 + PI)`); la testa si inclina più in avanti rispetto al cammino; il bob è leggermente più rapido. Le transizioni usano `lerp` per evitare scatti.

### 2026-06-27 — implementazione (giro 10)
- ✅ **Provider Groq** (free Llama 3.3 70B): nuovo `server/src/groq.ts` con `runGroqTask`, loop identico al Gemini ma via API OpenAI-compatible di Groq. Selezionabile in Impostazioni (terza opzione). Non richiede provisioning. 2 nuovi test (ora **30 test** lato server).
- ✅ **gh_create_issue**: l'agente può aprire issue su GitHub (Gemini + Groq). Nuova funzione `createIssue` in `github.ts`, tool declaration in `agent.ts` e `groq.ts`, handler nel loop.
- ✅ **CI workflow**: `.github/workflows/ci.yml` — su ogni push/PR esegue build frontend + typecheck server + test server.

### 2026-06-27 — implementazione (giro 6)
- ✅ **Ruoli specializzati**: ogni agente ora ha un **selettore di ruolo** nell'inspector
  (Generalist · Revisore · Tester · Documentatore · Architetto). Il ruolo viene trasmesso
  al runtime (`AssignBody.role`) e `composeSystem` inietta istruzioni extra specifiche
  nel prompt di sistema (es. Revisore → "leggi e documenta, non modificare file di codice",
  Tester → "scrivi test seguendo le convenzioni del repo"). Generalist e ruoli sconosciuti
  lasciano il prompt invariato. Aggiunti 6 nuovi test (ora **18 test** lato server).

### 2026-06-27 — implementazione (giro 12)
- ✅ **Collaborazione agenti / relay_task**: strumento `relay_task` disponibile in Gemini e Groq.
  L'agente specifica `target` (ruolo o nome), `title`, `branch` e `context` opzionale;
  il `RelayBridge` (invisibile in `App.tsx`) riceve le relay dalla store e le smista
  all'agente corretto (o le mette in coda se occupato).

### 2026-06-27 — implementazione (giri 13–14)
- ✅ **Piano visibile** (`announce_plan`): il primo tool chiamato dall'agente è sempre
  `announce_plan` con 4–6 passi. Il piano arriva via SSE, è persistito nel Task e
  mostrato nell'AgentInspector come lista numerata.
- ✅ **Head look-around idle**: `headGroupRef` isola il pivot della testa (Y = 1.55);
  `idleTimer` accumula lentamente e, dopo 4 s di idle, la testa oscilla con `sin(t*0.45)`.
- ✅ **IdleBridge**: agenti idle da 15 s (senza task né coda) camminano automaticamente
  verso la lounge con un jitter deterministico per evitare sincronizzazione.
- ✅ **TV monitor live**: elemento `<Html>` sopra il monitor della scena che mostra il
  nome del task e la barra di avanzamento dell'agente attivo corrente.

### 2026-06-27 — implementazione (giro 17)
- ✅ **GitHub esteso**: `listPullRequests`, `readPullRequest`, `commentOnPullRequest`,
  `listCIRuns` in `github.ts`; tool declaration e handler in `agent.ts` e `groq.ts`.
- ✅ **Notion esteso**: `createPage` (pagina figlia con contenuto markdown, batch da 100
  blocchi), `replacePageByTitle` (delete + re-append), entrambi esposti come tool agli agenti.

### 2026-06-27 — implementazione (giro 18)
- ✅ **Garden stagioni/biomi**: `getCurrentSeason()` (mese corrente), `getBiome(username)`
  (hash → oak/pine/birch), `computePalette(season, biome)` (override colori foglie per
  autunno e inverno). `FallingLeaves` (18 piani arancione) in autunno, `Snowflakes`
  (50 sfere bianche) in inverno. Cielo/nebbia/sole da `SEASON_SKY`.
- ✅ **Achievement/badge nel giardino**: `computeBadges(garden)` restituisce fino a 8 badge
  (emoji + etichetta) mostrati come pill colorati nel pannello di controllo.

### 2026-06-27 — implementazione (giro 19)
- ✅ **Onboarding wizard**: `OnboardingWizard` a 2 step, si mostra una sola volta (trackato
  via `localStorage.sams.welcomed`); spiega SAMS, guida ai 3 passi per iniziare, si chiude
  aprendo Settings.
- ✅ **Notifiche browser**: `NotificationBridge` osserva le transizioni working → idle;
  richiede permission al primo completamento e poi mostra una Notification nativa.
- ✅ **Responsive**: `ResponsiveBridge` collassa i pannelli laterali sotto 768 px e
  reagisce al resize; aggiunti `setLeftOpen`/`setRightOpen` alla store.

### 2026-06-27 — implementazione (giro 20) — ROADMAP COMPLETATA
- ✅ **Test e2e Playwright**: `e2e/smoke.spec.ts` con 5 test (caricamento, onboarding,
  impostazioni, command palette, garden); `playwright.config.ts` con Chromium headless
  (SwiftShader per WebGL in CI); tutti 5 passano.
- ✅ **ROADMAP aggiornata**: tutti gli item implementati marcati ✅.
