# Stanze iconiche — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** una casa fissa di 6 stanze in cui l'agente sta nella stanza dell'azione che sta facendo davvero, e ogni stanza ha un oggetto simbolo che reagisce.

**Architecture:** il server allega `activity` (read/write/test) a ogni passo in `executeTool`. La pagina tiene la fase per agente nello store, e una funzione pura `roomFor` + `nextRoom` (con tenuta di 20 s) decide la stanza. `LifeBridge` sposta l'agente su un posto libero di quella stanza. La pianta in `world.ts` diventa fissa (niente ali). La scena disegna le 6 stanze da un nuovo file `Rooms.tsx`.

**Tech Stack:** React + three.js (@react-three/fiber, drei), Zustand, Express (server), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-23-stanze-iconiche-design.md`

## Global Constraints

- Pianta 3×2: dietro **Biblioteca | Officina | Laboratorio**, davanti **Salotto | Reparto revisioni | Camera**.
- Colonne larghe 13, file profonde 9: casa da x −19,5 a 19,5 e da z −9 a 9, `wallHeight` 3,2. Porte larghe ~2,6.
- Tenuta minima in una stanza di lavoro: **20 s** (`ROOM_HOLD_MS = 20_000`). L'attesa di approvazione sposta subito.
- Almeno **4 posti** per ciascuna stanza di lavoro e per il Reparto revisioni. **6 letti** in Camera, condivisi oltre il sesto agente (`idx % 6`).
- Notte: 23–7 (`isNightNow` esistente).
- Esito del Laboratorio visibile per **~60 s** (`LAB_RESULT_MS = 60_000`).
- Nessuna libreria nuova. Geometrie semplici come quelle di `Furniture.tsx`. La stanza 3D non diventa rossonera.
- Testi visibili in italiano. Nomi di stanze e zone: `biblioteca`, `officina`, `laboratorio`, `salotto`, `revisioni`, `camera`.

## Review Focus

- **Mondo salvato con posizioni della casa vecchia** (agenti a x = 30 in un'ala che non c'è più, o a x = −17 nel vecchio reparto): devono finire dentro la casa nuova, non fuori dai muri. Test in Task 4.
- **Più agenti che vogliono la stessa stanza** (per esempio 6 agenti che leggono): ognuno prende un posto diverso finché ce ne sono, e oltre si condivide senza errori. Test in Task 3.
- **Evento `activity` per un agente che non c'è** (cancellato, o di un'altra workspace): ignorato senza creare un agente fantasma né una riga nel Log. Test in Task 2.
- **Fase vecchia rimasta dopo la fine del task**: un agente tornato `idle` va in Salotto anche se l'ultima `activity` era `write`. Test in Task 3.
- **Posizioni salvate di mobili che non esistono più** (`kitchen-island`, `bookshelf`…): ignorate senza errori. Test in Task 6.

---

### Task 1: il server dice che azione sta facendo l'agente

**Files:**
- Create: `server/src/activity.ts`, `server/src/activity.test.ts`
- Modify: `server/src/types.ts` (`WireEvent`), `server/src/agentTools.ts` (`executeTool`, rami `gh_list_ci` e `gh_ci_jobs`)
- Test: `server/src/agentTools.execute.test.ts`

**Interfaces:**
- Produces: `export type Activity = "read" | "write" | "test"`. `activityForTool(name: string): Activity | null`. `ciOutcome(result: string): "success" | "failure" | null`. In `WireEvent`: `activity?: Activity`, `ci?: "success" | "failure"`.

- [ ] **Step 1:** test `activityForTool` con la tabella dello spec (§1). Per ogni strumento si verifica la fase: per esempio `gh_read_files` → `"read"`, `notion_add_row` → `"write"`, `gh_trigger_workflow` → `"test"`, mentre `relay_task`, `done`, `gh_merge_pr`, `mcp_call` e `"sconosciuto"` → `null`. Test `ciOutcome`: un testo che contiene `conclusion: success` (oppure `"conclusion":"success"`) → `"success"`, uno con `failure` → `"failure"`, un testo neutro → `null`. Per i casi usa il formato reale restituito dai rami `gh_list_ci` e `gh_ci_jobs`.
- [ ] **Step 2:** `cd server && npx vitest run src/activity.test.ts` → FAIL (modulo mancante).
- [ ] **Step 3:** implementa `activity.ts` con una mappa costante. In `executeTool`, subito dopo il controllo dell'ultimo passo: `const activity = activityForTool(name); if (activity) emit({ agentId, agentName, activity });`, senza `message`. Nei rami `gh_list_ci` e `gh_ci_jobs`, dopo il risultato: `const ci = ciOutcome(result); if (ci) emit({ agentId, agentName, ci });`.
- [ ] **Step 4:** in `agentTools.execute.test.ts` aggiungi: `gh_read_file` emette prima un evento `{ activity: "read" }` senza `message`, e `done` non emette `activity`.
- [ ] **Step 5:** `cd server && npm test` → tutto verde. `npx tsc --noEmit -p .` → pulito.
- [ ] **Step 6:** commit `feat(agenti): il server dice che azione sta facendo l'agente`.

### Task 2: la pagina ricorda la fase di ogni agente

**Files:**
- Modify: `src/store/useStore.ts` (stato + `applyRemote`), `src/lib/backend.ts` (tipo dell'evento, se ripete i campi)
- Test: `src/store/useStore.test.ts`

**Interfaces:**
- Consumes: i campi `activity` e `ci` del Task 1.
- Produces: nello store `activity: Record<string, { kind: "read" | "write" | "test"; at: number }>`, `lastWrite: Record<string, string>` (nome breve dell'ultimo file scritto), `labResult: { result: "success" | "failure"; at: number } | null`. Tipo esportato `ActivityKind`.

- [ ] **Step 1:** test:
  - `applyRemote({ agentId: id, activity: "write" })` imposta `activity[id].kind === "write"` e **non** aggiunge eventi.
  - `applyRemote({ agentId: "inesistente", activity: "read" })` non crea agenti né eventi.
  - `applyRemote({ agentId: id, ci: "failure" })` imposta `labResult.result === "failure"`.
  - Un evento `{ agentId: id, message: "wrote src/app.ts" }` aggiorna `lastWrite[id] === "app.ts"`. Prima di scrivere l'asserzione, controlla in `agentTools.ts` il prefisso reale del messaggio di scrittura (`wrote`, `staged`…).
- [ ] **Step 2:** `npx vitest run src/store/useStore.test.ts` → FAIL.
- [ ] **Step 3:** in `applyRemote`, prima del blocco generale: se `e.activity || e.ci`, aggiorna solo questi campi (`activity` solo se l'agente esiste) e `return`. `lastWrite` si ricava dai messaggi di scrittura nel blocco generale (basename del percorso).
- [ ] **Step 4:** stesso comando → PASS.
- [ ] **Step 5:** commit `feat(stanze): la pagina ricorda la fase di ogni agente`.

### Task 3: quale stanza per ogni agente

**Files:**
- Create: `src/lib/roomFor.ts`, `src/lib/roomFor.test.ts`

**Interfaces:**
- Consumes: `ActivityKind` (Task 2), `AgentStatus` (`src/types.ts`).
- Produces:
  - `export type RoomId = "biblioteca" | "officina" | "laboratorio" | "salotto" | "revisioni" | "camera"`.
  - `roomFor(a: { status: AgentStatus; activity?: ActivityKind }, night: boolean): RoomId | null`, dove `null` vuol dire «resta dov'è» (bloccato).
  - `nextRoom(current: RoomId | null, wanted: RoomId | null, since: number, now: number, urgent: boolean): RoomId | null`.
  - `pickSeat(seats: Vec2[], taken: Vec2[]): Vec2`.
  - `export const ROOM_HOLD_MS = 20_000`.

- [ ] **Step 1:** test di `roomFor`, una riga per riga della tabella dello spec §2:
  - `awaiting_approval` → `"revisioni"`, anche di notte;
  - `working` + `read` → `"biblioteca"`, `working` senza fase → `"biblioteca"`, `working` + `write` → `"officina"`, `working` + `test` → `"laboratorio"`;
  - `blocked` → `null`;
  - `idle` / `done` / `review` di giorno → `"salotto"`, di notte → `"camera"`;
  - `idle` con `activity: "write"` → `"salotto"` (fase vecchia ignorata).

  Test di `nextRoom`:
  - con `current = "biblioteca"`, `wanted = "officina"`, `now - since = 5_000` → `"biblioteca"`; con `25_000` → `"officina"`;
  - `urgent = true` → `wanted` subito;
  - `current = null` → `wanted` subito.

  Test di `pickSeat`: restituisce il primo posto non occupato (distanza < 0,6 da uno in `taken`), e se sono tutti occupati restituisce il primo.
- [ ] **Step 2:** `npx vitest run src/lib/roomFor.test.ts` → FAIL.
- [ ] **Step 3:** implementa le tre funzioni pure. `urgent` lo passa chi chiama, ed è vero quando `wanted === "revisioni"` o quando l'agente non è più `working` (fine lavoro, nessuna tenuta).
- [ ] **Step 4:** stesso comando → PASS.
- [ ] **Step 5:** commit `feat(stanze): regole per scegliere la stanza di ogni agente`.

### Task 4: la pianta fissa di 6 stanze

**Files:**
- Modify: `src/data/world.ts` (riscrittura della parte pianta), `src/store/useStore.ts` (via `houseWings`, `nextWingCount`, `setCurrentWings`, `buildLayout`; `useHouse` restituisce `house()`), `src/scene/viewNav.test.ts`, `src/lib/reconcile.test.ts` se usa i vecchi confini
- Delete: `src/store/houseWings.test.ts`
- Test: `src/data/world.test.ts` (riscritto)

**Interfaces:**
- Consumes: `RoomId` (Task 3).
- Produces: `house(): HouseLayout` (sempre lo stesso oggetto). `HouseLayout` mantiene `bounds, width, depth, centerX, walls, rooms, zones, zoneById, beds, obstacles` e aggiunge `seats: Record<RoomId, Vec2[]>` (posti di lavoro, d'attesa o di pausa) e `furniture: Record<RoomId, Rect[]>`. `rooms` ha come chiavi i 6 `RoomId`. Una zona per stanza, con `id` uguale al `RoomId`. `ROOM` = confini dell'intera casa (`minX −19.5, maxX 19.5, minZ −9, maxZ 9, wallHeight 3.2`). Restano `clampToRoom`, `randomRoomPoint`, `SPAWN_POINT` (dentro il Salotto), `isNightNow`, `OBSTACLES`. Spariscono `Wing*`, `WING_*`, `REVIEW_*`, `reviewSeat`, `buildLayout`, `wingsNeeded`, `nextWingCount`, `setCurrentWings`, `AGENTS_PER_WING`, `SHRINK_MARGIN`, `MAX_WINGS`, `BASE_BEDS`, `zoneForTitle`, `randomWalkPoint`.

- [ ] **Step 1:** riscrivi `world.test.ts`:
  - 6 stanze con le chiavi di `RoomId`, disposte come nei Global Constraints (centro della Biblioteca con x < 0 e z < 0, centro della Camera con x > 0 e z > 0, eccetera);
  - `beds.length === 6`, tutti dentro `rooms.camera`;
  - ogni stanza tranne la Camera ha almeno 4 `seats`, tutti `isPointClear` rispetto a `obstacles`;
  - con `findPath` si arriva dal centro del Salotto a ogni posto e a ogni letto;
  - `clampToRoom([30, 0])` e `clampToRoom([-25, 0])` restano dentro `bounds`;
  - `house() === house()`.
- [ ] **Step 2:** `npx vitest run src/data/world.test.ts` → FAIL.
- [ ] **Step 3:** riscrivi la pianta:
  - muri verticali a x = ±6,5 con porte a z = ±4,5;
  - muro orizzontale a z = 0 con porte a x = −13, 0 e 13;
  - ingombri dei mobili per stanza, coerenti con la tabella dello spec §4: 4 scrivanie in Officina, due banconi e un rack in Laboratorio, scaffali e tavolo da lettura in Biblioteca, banco e panche nel Reparto revisioni, divano, tavolino e macchinetta del caffè in Salotto, 6 letti in Camera;
  - i posti stanno davanti ai mobili.

  Togli dallo store tutto ciò che riguarda le ali, aggiorna `viewNav.test.ts` (ordine delle stanze: dietro prima, da sinistra a destra, 6 voci) e cancella `houseWings.test.ts`.
- [ ] **Step 4:** `npx vitest run src/data src/scene src/lib src/store` → PASS. `npm run typecheck` mostrerà errori solo nei file dei Task 5–6: annotali, verranno chiusi lì.
- [ ] **Step 5:** commit `feat(stanze): pianta fissa di sei stanze, niente ali`.

### Task 5: gli agenti vanno nella stanza giusta

**Files:**
- Modify: `src/Workspace.tsx` (`LifeBridge`, `isFreeAgent`), `src/store/useStore.ts` (togli lo spostamento con `zoneForTitle` in fase di assegnazione, `sendToZone` invariato), `src/scene/Agent3D.tsx` (micro-attività)
- Create: `src/lib/roomMoves.ts`, `src/lib/roomMoves.test.ts`

**Interfaces:**
- Consumes: `roomFor`, `nextRoom`, `pickSeat`, `ROOM_HOLD_MS` (Task 3); `house().seats`, `house().rooms`, `house().beds` (Task 4); `activity` nello store (Task 2).
- Produces: `planMoves(agents: Agent[], activity: Record<string, { kind: ActivityKind; at: number }>, memo: Map<string, { room: RoomId; since: number }>, night: boolean, now: number): { id: string; to: Vec2 }[]`, pura. Restituisce solo gli agenti che devono muoversi e aggiorna `memo`.

- [ ] **Step 1:** test di `planMoves`:
  - un agente `working` con `read` va su un posto della Biblioteca;
  - lo stesso agente con `write` dopo 5 s resta, dopo 25 s va in Officina;
  - 5 agenti in lettura prendono 4 posti diversi, e il quinto condivide il primo;
  - `awaiting_approval` va subito in Revisioni;
  - di notte un agente libero va al letto `beds[idx % 6]`;
  - un agente già sul suo posto non viene rimosso;
  - di giorno un agente libero va su un posto del Salotto.
- [ ] **Step 2:** `npx vitest run src/lib/roomMoves.test.ts` → FAIL.
- [ ] **Step 3:** implementa `planMoves`. In `LifeBridge` sostituisci il corpo del tick: solo se `iAmSimulator`, `planMoves(...)` → `moveAgent`. Il `memo` vive in un `useRef` del componente. Togli il vagabondaggio casuale per tutta la casa: chi è libero ogni tanto cambia posto dentro il Salotto. In `Agent3D` l'attività `coffee` scatta vicino al posto della macchinetta del caffè (primo posto del Salotto) e `sketch` sparisce.
- [ ] **Step 4:** `npm test` → tutto verde. `npm run typecheck` → errori solo in `OfficeScene.tsx`, se ne restano.
- [ ] **Step 5:** commit `feat(stanze): gli agenti vanno nella stanza dell'azione che stanno facendo`.

### Task 6: le stanze disegnate, con i simboli che reagiscono

**Files:**
- Create: `src/scene/Rooms.tsx` (le 6 stanze, cartelli e reazioni), `src/scene/roomSigns.ts` + `roomSigns.test.ts` (dati puri dei cartelli e dello stato dei simboli)
- Modify: `src/scene/Furniture.tsx` (nuovi pezzi: `LabBench`, `ServerRack`, `CoffeeMachine`, `TrafficLamp`, `MonitorDesk`, `ReadingTable`), `src/scene/OfficeScene.tsx` (togli `WingRooms`, `ReviewWingRoom`, cucina, vecchie posizioni; monta `<Rooms />`; `Movable` solo per mobili di Salotto e Camera; `ZoneMarker` sostituito dai cartelli)

**Interfaces:**
- Consumes: `house()` (Task 4); `activity`, `lastWrite`, `labResult` e agenti (Task 2); `openReview` (esistente).
- Produces:
  - `ROOM_SIGNS: Record<RoomId, { icon: string; label: string }>`: 📚 Biblioteca, 🛠️ Officina, 🧪 Laboratorio, 🛋️ Salotto, 🔍 Reparto revisioni, 🛏️ Camera.
  - `labLamp(working: boolean, result: { result: "success" | "failure"; at: number } | null, now: number): "off" | "amber" | "green" | "red"`.
  - `pendingCount(agents: Agent[]): number` (agenti in `awaiting_approval`).
  - `validMovableIds: Set<string>`, usato per ignorare le posizioni salvate di mobili scomparsi.

- [ ] **Step 1:** test:
  - `labLamp`: nessuno al lavoro e nessun esito → `"off"`; qualcuno al lavoro → `"amber"`; esito `success` di 10 s fa → `"green"` anche senza nessuno al lavoro; esito di 70 s fa → torna `"off"` o `"amber"`.
  - `pendingCount`: conta solo `awaiting_approval`.
  - `ROOM_SIGNS` ha i 6 `RoomId`.
  - Con un `furnitureOffsets` salvato contenente `kitchen-island`, la scena considera solo gli id in `validMovableIds` (testa la funzione di filtro, non il render 3D).
- [ ] **Step 2:** `npx vitest run src/scene/roomSigns.test.ts` → FAIL.
- [ ] **Step 3:** implementa i dati puri, poi `Rooms.tsx`:
  - per ogni stanza: pavimento o tappeto del suo colore, l'arredo dello spec §4 e un cartello `Html` con icona e nome, sulla parete di fondo;
  - Biblioteca: luci del tavolo accese se c'è un agente in lettura;
  - Officina: monitor accesi sui posti occupati, con `lastWrite` dell'agente;
  - Laboratorio: `TrafficLamp` del colore di `labLamp`;
  - Reparto revisioni: schermo con «N in attesa» (`pendingCount`), che si illumina se N > 0, clic → `openReview(null)`;
  - Camera: 6 letti, con luce calda di notte.

  Le posizioni dei mobili vengono da `house().furniture`, così disegno e ostacoli coincidono. Porta del giardino sulla parete di fondo della Biblioteca, porta d'ingresso sulla parete davanti del Salotto.
- [ ] **Step 4:** `npm run typecheck`, `npm run lint` e `npm test` → tutto pulito e verde.
- [ ] **Step 5:** commit `feat(stanze): sei stanze iconiche con oggetti che reagiscono al lavoro`.

### Task 7: documentazione e prova a vista

**Files:**
- Modify: `src/site/data/docsSections.ts` (voce «La stanza»), `docs/roadmap/ROADMAP5.md` (nota su «la casa cresce» superata dalle stanze iconiche)

- [ ] **Step 1:** aggiorna i testi: casa di 6 stanze, l'agente va dove sta lavorando, nomi delle stanze.
- [ ] **Step 2:** `npm test` e `cd server && npm test` → verdi.
- [ ] **Step 3:** prova a vista in Chrome su `npm start`. Controlla le 6 stanze e i cartelli, che gli agenti liberi stiano in Salotto, che un clic sullo schermo del Reparto revisioni apra le revisioni, e che non ci siano errori in console.
- [ ] **Step 4:** commit `docs: casa di sei stanze iconiche`, push e PR verso `claude/epic-goodall-y8kej4` (senza merge).
