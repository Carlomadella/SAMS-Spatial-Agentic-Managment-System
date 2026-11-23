# Stanze iconiche — progetto

Data: 23/11/2026 · Branch: `feat/stanze-iconiche`

## Perché

Le parole dell'utente: la casa «sembra vuota e finta» e «non si capisce a cosa serve ogni stanza per il lavoro degli agenti». Oggi la casa è uno sfondo con qualche fermata. Un agente con un task va in una stanza scelta da alcune parole del titolo (`zoneForTitle`), e nessuna stanza mostra cosa sta succedendo davvero. L'utente vuole che **ogni stanza sia iconica per l'azione che l'agente sta compiendo**: guardando la casa si deve capire chi legge, chi scrive, chi fa girare i test e cosa aspetta una conferma.

Altre scelte dell'utente:
- **Una sola camera da letto.** Gli utenti useranno 6 agenti o meno. Se un giorno ce ne saranno di più ci penseremo, e intanto i letti si condividono.
- **Niente ali che crescono** con il numero degli agenti.
- **Il Reparto revisioni prende il posto della seconda camera**, al centro della fila davanti. L'ala fissa a sinistra sparisce.
- Approccio scelto: **A — una stanza per fase** (sotto).

Pioggia e chiacchiere sono già state sistemate a parte (PR #43 e #44).

## Obiettivi

1. **Pianta fissa di 6 stanze** (3 colonne × 2 file):

   ```
   ┌────────────┬────────────┬────────────┐
   │ BIBLIOTECA │  OFFICINA  │ LABORATORIO│   dietro
   │ legge file │ scrive     │ test e CI  │
   │ e ricerca  │ codice     │            │
   ├────────────┼────────────┼────────────┤
   │  SALOTTO   │  REPARTO   │   CAMERA   │   davanti
   │ libero,    │ REVISIONI  │ notte      │
   │ pausa      │ conferme   │ (6 letti)  │
   └────────────┴────────────┴────────────┘
   ```

2. **Un agente al lavoro sta nella stanza dell'azione che sta facendo davvero**, e la cambia solo quando cambia fase.
3. **Ogni stanza ha un oggetto simbolo** che si riconosce da lontano e che **reagisce** quando qualcuno ci lavora.
4. **Ogni stanza ha un cartello con il nome**, leggibile alla distanza normale della visuale.

## Non obiettivi

- Più di 6 letti, ali o stanze aggiuntive (rimandati: «ci pensiamo»).
- Cambiare il giardino, il ciclo giorno/notte, la neve e i petali.
- Cambiare i fumetti (già fatto in #44).
- Mostrare nella stanza il contenuto completo del lavoro (diff, log dei test): per quello ci sono l'Inspector e il Log eventi.

## Da evitare (sarebbe un fallimento anche se funziona)

- **Agenti che corrono avanti e indietro** tra Biblioteca e Officina a ogni passo: è il «parlano troppo» in versione camminata.
- **Stanze ancora spoglie:** ogni stanza deve sembrare abitata anche quando è vuota.
- **Scena più pesante** al punto da scattare su un portatile normale o sul telefono: geometrie semplici, come i mobili di oggi.
- **Testo che copre la stanza:** i cartelli sono brevi e non si sovrappongono ai fumetti.

## Approcci considerati

| | Come | Pro | Contro |
|---|---|---|---|
| **A — stanza per fase** ✅ scelto | Il server allega a ogni passo il tipo di azione. L'agente cambia stanza solo quando cambia fase, e ci resta almeno 20 s. | Rispecchia il lavoro vero ed è calmo da guardare. | Serve una piccola aggiunta al server. |
| B — stanza per passo | Segue ogni strumento all'istante. | Fedeltà massima. | Avanti e indietro continuo: letture e scritture si alternano. |
| C — stanza dal titolo | Come oggi, con le stanze nuove. | Nessuna modifica al server. | Non mostra cosa fa davvero l'agente, cioè il difetto di partenza. |

## Come funziona

### 1. Il tipo di azione (server)

Tutti i provider (Gemini in `agent.ts`, OpenRouter, Groq, OpenAI) chiamano `executeTool` in `server/src/agentTools.ts`. Lì, **prima** di eseguire lo strumento, si manda un evento con il nuovo campo `activity` in `WireEvent`:

| `activity` | Strumenti |
|---|---|
| `read` | `gh_list_files`, `gh_read_file`, `gh_read_files`, `gh_list_issues`, `gh_list_prs`, `gh_read_pr`, `gh_pr_status`, `notion_read`, `recall`, `web_fetch`, `announce_plan` |
| `write` | `gh_write_file`, `gh_write_files`, `gh_create_issue`, `gh_comment_pr`, `notion_write`, `notion_create_page`, `notion_replace_page`, `notion_add_row`, `notion_update_row`, `remember` |
| `test` | `gh_list_ci`, `gh_ci_jobs`, `gh_trigger_workflow` |
| nessuno | `relay_task`, `done`, `gh_merge_pr`, `mcp_call` (la fase resta quella di prima) |

- La tabella sta in una funzione pura `activityForTool(name)`, testata. Uno strumento sconosciuto non ha fase.
- L'evento con `activity` **non** ha `message`, così non finisce nel Log eventi.
- Esito dei test: quando `gh_list_ci` o `gh_ci_jobs` restituiscono una conclusione riconoscibile (`success` o `failure`), il server manda anche `ci: "success" | "failure"`. Se non la riconosce, non manda niente.

### 2. La stanza giusta (pagina)

Lo store tiene per ogni agente `activity` e il momento dell'ultimo cambio di stanza. Una funzione pura `roomFor(agent, now)` decide la stanza:

| Stato dell'agente | Stanza |
|---|---|
| `awaiting_approval`, qualunque attesa: file, merge, workflow, push sul principale | **Reparto revisioni**, subito |
| `working`, fase `read` oppure ancora nessuna fase (appena partito) | **Biblioteca** |
| `working`, fase `write` | **Officina** |
| `working`, fase `test` | **Laboratorio** |
| `blocked` | resta dov'è (il segnale rosso c'è già) |
| libero di giorno (`idle`, `done`, `review`) | **Salotto** |
| libero di notte (23–7) | **Camera**, al suo letto |

- **Tenuta minima:** un agente al lavoro cambia stanza solo se è lì da almeno **20 s**. Se nel frattempo la fase cambia di nuovo, conta l'ultima. Fa eccezione l'attesa di approvazione, che sposta subito.
- **Posti dentro la stanza:** ogni stanza di lavoro ha **almeno 4 posti** fissi (per esempio un posto per scrivania), assegnati al primo libero, così due agenti non si sovrappongono.
- **Chi muove:** lo stesso meccanismo di oggi. Muove solo la vista che guida il mondo (`iAmSimulator`, opzione B3), e le altre seguono. Gli eventi `activity` arrivano a tutte le viste via SSE, quindi chi prende la guida sa già le fasi.
- `zoneForTitle` sparisce, e anche lo spostamento all'assegnazione in `useStore.ts` (riga ~724): ora decide `roomFor`.

### 3. La pianta (`src/data/world.ts`)

- **Tre colonne larghe come le stanze di oggi** (13), due file profonde 9, muri interni con porte larghe come quelle attuali (~2,6) tra ogni coppia di stanze vicine. La casa resta centrata sulla visuale.
- **Tolti:** ali che crescono (`Wing`, `WING_CATALOG`, `buildLayout(n)`, `wingsNeeded`, `nextWingCount`, `AGENTS_PER_WING`, `SHRINK_MARGIN`, `MAX_WINGS`, `houseWings` nello store), ala sinistra `REVIEW_WING`, Cucina, Terrazza, Sala riunioni, Angolo lettura.
- `house()` restituisce un'unica pianta fissa. Restano le stesse informazioni di oggi (muri come unica fonte per disegno e ostacoli, stanze, zone, letti, ostacoli), con le stanze nuove.
- **Letti:** 6, nella Camera. Oltre il sesto agente i letti si condividono (`idx % 6`, come oggi).
- **Zone** (menu «Vai in…» e palette dei comandi): una per stanza, con i nomi nuovi.
- **Porte esterne:** la porta del giardino sulla parete di fondo della Biblioteca, la porta d'ingresso sulla parete davanti del Salotto.

### 4. Le stanze e i loro simboli (`OfficeScene.tsx`, `Furniture.tsx`)

| Stanza | Arredo | Oggetto simbolo | Reazione |
|---|---|---|---|
| **Biblioteca** | parete di scaffali alti pieni di libri colorati, tavolo da lettura lungo con sedie, lampade da tavolo | gli scaffali | le lampade del tavolo si accendono quando qualcuno legge |
| **Officina** | 4 scrivanie con monitor e sedia, una lavagna Kanban sulla parete | i monitor | il monitor del posto occupato si accende, con il nome breve dell'ultimo file scritto (preso dal messaggio dell'evento; se non c'è, solo acceso) |
| **Laboratorio** | due banconi con strumenti e provette, un rack di server | una **grande lampada-semaforo** sopra i banconi | grigia se vuoto, ambra mentre qualcuno lavora, verde o rossa per ~60 s dopo un esito `ci` |
| **Reparto revisioni** | tappeto rosso (c'è già), banco con lo schermo grande (c'è già, cliccabile → apre le revisioni), panche | lo schermo | mostra quante cose aspettano una conferma («2 in attesa») e si illumina quando sono più di zero |
| **Salotto** | divano, poltrone, tavolino, TV, piante, una macchinetta del caffè | il divano con la TV | nessuna: è il posto della pausa (l'animazione «caffè» si sposta qui) |
| **Camera** | 6 letti, comodini, lampade | i letti | luce calda di notte |

- **Cartelli:** un cartello per stanza con un'icona e il nome (per esempio «📚 Biblioteca»), sulla parete di fondo o a terra vicino alla porta. Sostituisce l'etichetta di zona attuale e resta visibile anche quando la stanza è vuota.
- **Colori:** ogni stanza ha il suo pavimento o tappeto, così si distinguono dall'alto. I colori restano sobri e coerenti con il resto. L'interfaccia è rossonera, ma la stanza 3D non va resa rossonera.

### 5. Il resto da aggiornare

- `Agent3D.tsx`: animazioni minime per stanza (`coffee` vicino alla macchinetta del Salotto, `sketch` rimosso).
- `Workspace.tsx` (`LifeBridge`): chi è libero di giorno sta nel Salotto (con piccoli spostamenti dentro la stanza), di notte va in Camera. Chi è al lavoro va dove dice `roomFor`.
- **Mobili spostabili** (`Movable`): restano spostabili solo i mobili di Salotto e Camera. Le posizioni salvate di mobili che non esistono più si ignorano.
- **Documentazione:** `src/site/data/docsSections.ts` («casa a quattro stanze…»), la nota in ROADMAP5 su «la casa cresce» e la nota Obsidian.

## Test

- `activityForTool`: ogni strumento della tabella dà la fase giusta, e uno sconosciuto non ne dà.
- `roomFor`: ogni riga della tabella, la tenuta minima di 20 s, l'eccezione dell'attesa approvazione, la notte.
- Pianta: nessun muro dentro un posto di lavoro o un letto, ogni stanza raggiungibile da ogni altra con il pathfinder, 6 letti.
- Server: `executeTool` emette `activity` prima di eseguire, senza `message`.
- Prova a vista in Chrome prima del merge (vedi memoria `use-chrome-browser`).

## Scelte lasciate a chi costruisce

Le misure esatte dei mobili e la posizione delle porte, i colori dei pavimenti, la forma precisa dei cartelli, quante e quali decorazioni in più. Vincolo: geometrie semplici, nessuna libreria nuova.
