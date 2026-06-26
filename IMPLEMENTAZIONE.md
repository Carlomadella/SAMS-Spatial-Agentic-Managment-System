# 🛠️ Implementazione post-brainstorming

Questo documento riassume **tutto ciò che è stato implementato dopo la sessione di
brainstorming** (vedi [`ROADMAP.md`](./ROADMAP.md)). Le feature sono state spedite
in ordine di priorità, scegliendo per prime quelle ad alto impatto **e** verificabili
con build/test (dato che in questo ambiente non sono disponibili browser né chiave
Gemini per provare il flusso live).

> Branch di sviluppo: `claude/epic-goodall-y8kej4`
> Stato qualità: build ✓ · server typecheck ✓ · 12 test ✓

---

## 1. 💾 Persistenza dello stato — *commit `16c5e32`*

**Cosa fa.** Lo stato del workspace **sopravvive al refresh** della pagina. Prima,
ricaricando si perdevano agenti, task ed eventi.

**Dettagli tecnici.**
- Lo store Zustand è ora avvolto nel middleware `persist` (storage: `localStorage`,
  chiave `sams.store`, `version: 1`).
- Vengono persistite **solo le fette durevoli**: `agents`, `tasks`, `events`,
  `environment`, `selectedAgentId`, `tokensUsed`, `theme` e il layout dei pannelli
  (`leftOpen/rightOpen/bottomOpen`, `leftWidth/rightWidth/bottomHeight`, `activity`,
  `bottomTab`).
- Sono **esclusi** i flag transitori: command palette, modali, garden, toast,
  `backendOnline`, `runtimeReady`.
- Al rehydrate i `target` di camminata degli agenti vengono **azzerati**, così non
  riprendono percorsi obsoleti dopo un reload.

**File toccati.** `src/store/useStore.ts`

---

## 2. 📋 Libreria di istruzioni pronte — *commit `99d0e82`*

**Cosa fa.** Nell'inspector dell'agente, al posto delle 4 “chip” placeholder, c'è un
**menù di 12 template** categorizzati per dare un comando in pochi clic.

**Come si usa.**
1. Seleziona un agente → pannello **AgentInspector**.
2. Nel riquadro *Assign a task*, apri **“Parti da un template…”**.
3. Scegli un template: il **titolo** e il **branch** suggerito vengono compilati e il
   primo **`{segnaposto}`** viene selezionato, pronto da sostituire (es. `{argomento}`,
   `{pagina}`, `{file}`).
4. Rifinisci e premi **Assign task**.

**Categorie e template.**
- **Notion** — Guida completa · 5 esercizi + soluzioni · Cheatsheet
- **Codice** — Implementa feature · Aggiungi test · Refactor
- **Documentazione** — Aggiorna README · Documenta un file
- **Contenuti** — Lezione completa · Glossario
- **Manutenzione** — Correggi un bug · Controlla dipendenze

**File toccati.** `src/data/taskTemplates.ts` (nuovo), `src/components/AgentInspector.tsx`

---

## 3. 🤖 Agenti più vivi — *commit `10347a4`*

**Cosa fa.** Gli agenti “recitano” il lavoro nella scena 3D.

- **Fumetti col passo corrente.** Sopra ogni agente compare un fumetto con la sua
  **ultima azione**, presa dallo stream di eventi SSE (`read X`, `write Y`,
  `Notion ← "…"`, ecc.). Il fumetto svanisce dopo qualche secondo. Mostra solo eventi
  freschi (< 8s) e tronca i messaggi lunghi.
- **Cammino mirato.** Quando assegni un task, l'agente **cammina verso la zona giusta**
  in base a parole chiave nel titolo: documentazione/Notion → *Reading Nook*,
  codice/test/bug → *Work Desk*.

**Dettagli tecnici.**
- `zoneForTitle(title)` mappa il titolo del task a una zona (fallback: Work Desk).
- `assignTask` chiama `moveAgent` verso quella zona.
- In `Agent3D` un selettore prende l'ultimo evento dell'agente; un piccolo timer
  gestisce la comparsa/scomparsa del fumetto.

**File toccati.** `src/data/world.ts`, `src/store/useStore.ts`, `src/scene/Agent3D.tsx`

---

## 4. ⚡ Meter dei token Gemini — *questo giro*

**Cosa fa.** Rende **trasparente il consumo**: quanti token Gemini costa ogni task.

- **Per task** — nel **TasksPanel**, accanto al branch, compare `· N tok`.
- **Totale cumulativo** — nella **StatusBar** in basso, un indicatore `⚡ N tok`
  (persistito tra i refresh; formattato es. `12.3k`).

**Dettagli tecnici.**
- `usageTokens(resp)` legge `usageMetadata.totalTokenCount` (0 se non riportato).
- Il loop dell'agente accumula i token di ogni chiamata e invia il **totale** nell'evento
  finale (`WireEvent.tokens`).
- `applyRemote` somma i token al totale di sessione (`tokensUsed`) e li salva sul record
  del task.
- **Test**: `server/src/gemini.test.ts` copre `usageTokens` (presente / mancante).

**File toccati.** `server/src/gemini.ts`, `server/src/agent.ts`, `server/src/types.ts`,
`server/src/gemini.test.ts` (nuovo), `src/lib/backend.ts`, `src/types.ts`,
`src/store/useStore.ts`, `src/components/StatusBar.tsx`, `src/components/TasksPanel.tsx`

---

## 5. 🧠 Memoria di progetto — *commit `composeSystem`*

**Cosa fa.** Prima di iniziare, l'agente **legge le linee guida del repository** (se
presenti) e le include nel suo prompt, così rispetta stile, struttura e regole del
progetto.

**Come si usa.** Crea nel repo collegato (sul base branch) **uno** di questi file:
`AGENTS.md`, `CONVENTIONS.md`, `.sams/guide.md` o `SAMS_GUIDE.md`. Verrà letto in
quest'ordine; il primo trovato (fino a ~2000 caratteri) viene aggiunto al prompt.
Se nessuno esiste, è un no-op: l'agente lavora come prima.

**Dettagli tecnici.**
- `loadProjectGuide(baseBranch)` prova i file in ordine e ritorna il primo non vuoto.
- `composeSystem({ agentName, notionEnabled, repoEnabled, guide })` è una funzione **pura**
  che costruisce il prompt di sistema, con la sezione *“Linee guida del progetto”* solo
  se la guida è presente.
- Quando una guida viene caricata, l'agente emette un evento INFO “Linee guida del
  progetto caricate”.
- **Test**: `server/src/agent.test.ts` copre `composeSystem` (nomi, strumenti, guida).

**File toccati.** `server/src/agent.ts`, `server/src/agent.test.ts` (nuovo)

---

## ✅ Come verificare

```bash
# build + typecheck del frontend
npm run build

# typecheck e test del runtime
npm --prefix server run typecheck
npm --prefix server test      # 12 test attesi

# avvio completo (web + runtime) e apertura su http://localhost:5173
npm start
```

Prove manuali consigliate:
- **Persistenza**: assegna un task, ricarica la pagina → agenti/task/eventi ci sono ancora.
- **Template**: inspector → “Parti da un template…”, scegli, edita il `{segnaposto}`.
- **Agenti vivi**: assegna un task → l'agente cammina e mostra il fumetto.
- **Token**: con runtime attivo e chiave Gemini, dopo un task vedi i token nel TasksPanel
  e nella StatusBar.
- **Memoria di progetto**: aggiungi un `AGENTS.md` al repo collegato → l'agente emette
  “Linee guida del progetto caricate” e ne segue le regole.

---

## 🔜 Cosa manca (prossimi passi)

Tracciati in [`ROADMAP.md`](./ROADMAP.md). In cima:
- **Anteprima + approvazione del diff** prima del push (richiede modifiche a runtime +
  frontend e una verifica live).
- **Output in streaming** dei token/passi nell'event log.
- **Auto-verifica** (test/lint con autocorrezione) e **più provider gratuiti**.

> Nota: gli agenti già lavorano su un **branch dedicato + PR**, quindi nulla finisce su
> `main` senza review su GitHub — per questo il gate di approvazione in-app, pur in cima,
> è stato sequenziato dopo le feature a verifica sicura.
