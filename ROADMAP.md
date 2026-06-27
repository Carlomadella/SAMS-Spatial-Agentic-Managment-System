# 🗺️ SAMS — Roadmap & Brainstorming

Idee per far crescere **SAMS** (Spatial Agentic Management System): stanza 3D
isometrica + agenti AI autonomi (Gemini Flash) con strumenti GitHub/Notion, il
**Commit Garden** in 3D e il runtime Express.

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
- [ ] 💡 **Piano visibile prima di agire** — l'agente elenca i passi e tu approvi.
- [ ] 💡 **Auto-verifica qualità** — dopo aver scritto codice lancia test/lint del repo e ritenta in loop se falliscono.
- [x] ✅ **Memoria di progetto** — l'agente legge un file di linee guida dal repo (`AGENTS.md` / `CONVENTIONS.md` / `.sams/guide.md` / `SAMS_GUIDE.md`) e lo include nel prompt.
- [x] ✅ **Ruoli specializzati** — selettore di ruolo nell'inspector (Generalist / Revisore / Tester / Documentatore / Architetto); ogni ruolo inietta istruzioni aggiuntive nel prompt di sistema.
- [ ] 💡 **Coda di task per agente** — gli agenti pescano i task in coda autonomamente.
- [ ] 💡 **Collaborazione tra agenti** — handoff (red scrive → blue revisiona → green scrive i test).

## 🔌 Più strumenti per gli agenti
- [ ] 💡 **Web search / fetch** — ricerca prima di scrivere.
- [ ] 💡 **GitHub esteso** — creare issue, commentare PR, leggere log CI.
- [ ] 🏗️ **Notion completo** — ✅ lettura pagina per titolo (`notion_read`, l'agente legge prima di scrivere); restano update/sostituzione blocchi, creazione pagine e database.
- [ ] 💡 **Notifiche a fine task** — Slack / Discord / email (in-app i toast ci sono già).
- [ ] 💡 **Sfruttare gli MCP disponibili** — report su Google Drive, eventi su Calendar, grafiche su Canva.

## 🎮 Mondo 3D (feel "The Sims")
- [x] ✅ **Cammino mirato** — all'assegnazione del task l'agente cammina verso la zona pertinente (docs→Reading Nook, codice→Work Desk).
- [ ] 💡 **Animazioni di lavoro** — digita alla scrivania, disegna sul muro.
- [x] ✅ **Fumetti di stato** — sopra ogni agente compare l'ultima azione (dagli eventi SSE), per qualche secondo.
- [ ] 💡 **Mobili vivi** — il monitor mostra il diff reale, la media wall i task reali.
- [ ] 💡 **Ciclo giorno/notte** + suoni ambientali.
- [ ] 💡 **Mood/energia** degli agenti (pausa caffè quando idle).
- [ ] 💡 **Camera cinematografica** che segue l'agente selezionato.
- [ ] 💡 **Pathfinding** attorno ai mobili (ora è in linea retta).

## 🖱️ UX / UI
- [ ] 💡 **Anteprima & approvazione del diff** nel pannello destro prima del push.
- [x] ✅ **Libreria di istruzioni pronte** — 12 template categorizzati (Notion / Codice / Documentazione / Contenuti / Manutenzione) nell'inspector; riempiono titolo+branch e selezionano il primo segnaposto da editare.
- [ ] 💡 **Onboarding guidato** al primo avvio (repo + key + spawn agenti).
- [x] ✅ **Meter di utilizzo/token** — token Gemini per task (TasksPanel) + totale cumulativo nella StatusBar.
- [x] ✅ **Output in streaming** nell'event log — l'agente emette il testo di ragionamento del modello (💭) prima di ogni chiamata a strumento.
- [ ] 💡 **Layout responsive/mobile** e accessibilità (keyboard nav, label sul 3D).

## 🌿 Commit Garden
- [ ] 💡 **Specie/biomi diversi** per linguaggio o repo.
- [ ] 💡 **Stagioni/meteo** legati alla frequenza di commit.
- [ ] 💡 **Achievement/badge** (primo PR, streak 7 giorni) e **decorazioni sbloccabili**.
- [ ] 💡 **Immagine OG condivisibile** per i social.
- [ ] 💡 **Giardini di team** (tutta l'organizzazione).
- [ ] ❄️ **Auto-innaffiatura via webhook** — opzionale (per ora refresh manuale, scelta voluta).

## 🛠️ Solidità (engineering)
- [x] ✅ **Persistenza** — agenti/task/eventi/layout sopravvivono al refresh (Zustand `persist` su localStorage; flag transitori esclusi).
- [ ] 💡 **CI su PR** — lint + typecheck + test + build.
- [ ] 💡 **Test frontend / e2e** (Playwright) — finora solo unit test del runtime.
- [ ] 💡 **Dockerizzare il runtime** + deploy in un comando.
- [ ] 💡 **Gestione rate-limit/retry** centralizzata (oltre al backoff Gemini esistente).
- [ ] 💡 **Più provider gratuiti** — Groq, OpenRouter, Ollama locale; **modello per-agente**.

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

### 2026-06-27 — implementazione (giro 7)
- ✅ **Output in streaming**: il loop dell'agente usa ora `generateContentStream` invece di
  `generateContent`. Il testo che il modello emette _prima_ di chiamare uno strumento (il suo
  ragionamento: "Leggo il file per capire la struttura…") viene mostrato nell'event log con il
  prefisso 💭. Estratta la funzione pura `collectStream` (prende un `AsyncGenerator` e lo drena
  in `{text, functionCalls, tokens}`), testabile senza mock del client. 5 nuovi test
  (ora **23 test** lato server).

### 2026-06-27 — implementazione (giro 6)
- ✅ **Ruoli specializzati**: ogni agente ora ha un **selettore di ruolo** nell'inspector
  (Generalist · Revisore · Tester · Documentatore · Architetto). Il ruolo viene trasmesso
  al runtime (`AssignBody.role`) e `composeSystem` inietta istruzioni extra specifiche
  nel prompt di sistema (es. Revisore → "leggi e documenta, non modificare file di codice",
  Tester → "scrivi test seguendo le convenzioni del repo"). Generalist e ruoli sconosciuti
  lasciano il prompt invariato. Aggiunti 6 nuovi test (ora **18 test** lato server).
