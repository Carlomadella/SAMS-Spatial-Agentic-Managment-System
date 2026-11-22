# Visuale: movimento e segui — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Spostarsi liberamente nella casa e nel giardino (mouse stile mappe + tastiera) e far sì che la telecamera che segue un agente si sganci al primo movimento manuale.

**Architecture:** Funzioni pure in `src/scene/cameraNav.ts` (confini, stanze → tasti, tasti → azioni). Un componente R3F condiviso `CameraNav` (dentro il `<Canvas>`) gestisce tastiera, volo verso un punto, clamp ai confini e segnala i movimenti manuali. Lo stato del «segui» sta nello store (`cameraFollow`), così `CameraFollow`, il tasto F e il pulsante «Segui» in `Workspace.tsx` lo condividono.

**Tech Stack:** React 18, @react-three/fiber 8, drei 9 (`OrbitControls`), three 0.169, zustand, vitest.

**Spec:** `docs/superpowers/specs/2026-11-22-visuale-zoom-movimento-design.md`

## Global Constraints

- Limiti di zoom/inclinazione invariati: casa `minDistance 9`, `maxDistance 34 + extra*0.8`, polar 0.25–1.35; giardino 6–28, polar 0.15–1.45.
- Tasti: WASD/frecce sposta, Q/E ruota, +/− zoom, 1–9 stanze da sinistra a destra, H vista intera, F riaggancia il segui. Non toccare Ctrl+K, Tab, Esc.
- Nessuna scorciatoia mentre il focus è in INPUT/TEXTAREA/SELECT/contentEditable, né con Ctrl/Meta/Alt premuti.
- UI solo rosso/nero/bianco (classi esistenti `brand`, `ink-*`, `line`); scena 3D intoccata nell'aspetto.
- Testi in italiano. Mai `git add -A` (ArtCraft lascia file non tracciati nella cartella).

## Review Focus

- Tasti premuti mentre è aperta una finestra modale (Command palette, Impostazioni): la telecamera non deve muoversi se il focus è in un campo → coperto da `isTypingTarget` (Task 1).
- Agente selezionato che viene eliminato: `CameraFollow` non deve restare agganciato a un id inesistente (oggi fa `return`, resta così) — verificare a vista nel Task 3.
- Casa che perde un'ala mentre la visuale è sull'ultima: il clamp deve riportare il centro dentro i nuovi confini → test `clampTarget` con punto fuori (Task 1).
- Trascinamento di un mobile in modalità riordino con il sinistro (che ora sposta): `MoveHandle` disattiva i controlli al pointer-down, verificare a vista che non si sposti anche la visuale (Task 3).
- Tasto premuto a lungo (auto-repeat): il movimento deve essere continuo e legato al tempo, non a scatti per evento → set di tasti premuti letto in `useFrame` (Task 3).

---

### Task 1: Funzioni pure di navigazione

**Files:**
- Create: `src/scene/cameraNav.ts`
- Test: `src/scene/cameraNav.test.ts`

**Interfaces:**
- Consumes: `Rect` da `src/lib/pathfind.ts`, `HouseLayout` da `src/data/world.ts`.
- Produces:
  - `clampTarget(x: number, z: number, bounds: Rect): [number, number]`
  - `roomShortcuts(layout: HouseLayout): { id: string; x: number; z: number }[]` — centri delle stanze di `layout.rooms`, ordinati per centro x crescente, a parità di x (±0.5) per z crescente (dietro prima), massimo 9.
  - `type NavAction = { kind: "move"; dir: "forward" | "back" | "left" | "right" } | { kind: "rotate"; dir: -1 | 1 } | { kind: "zoom"; dir: -1 | 1 } | { kind: "room"; index: number } | { kind: "home" } | { kind: "follow" }`
  - `keyToAction(key: string): NavAction | null` — usa `KeyboardEvent.key` (case-insensitive per le lettere): w/ArrowUp forward, s/ArrowDown back, a/ArrowLeft left, d/ArrowRight right, q rotate -1, e rotate 1, "+"/"=" zoom in (dir -1 = più vicino), "-"/"_" zoom out (dir 1), "1".."9" room index 0..8, h home, f follow.
  - `isTypingTarget(el: EventTarget | null): boolean`

- [ ] **Step 1: Write the failing tests** in `src/scene/cameraNav.test.ts`:
  - `clampTarget(-50, 3, {minX:-10,maxX:10,minZ:-8,maxZ:8})` → `[-10, 3]`; `clampTarget(2, 20, …)` → `[2, 8]`; punto interno invariato.
  - `roomShortcuts(buildLayout(0))` → id in ordine `["revisioni","studio","salotto","cucina","camera"]`; centro di `studio` = `[-6.6, -4.6]` (toBeCloseTo).
  - `roomShortcuts(buildLayout(MAX_WINGS)).length` ≤ 9.
  - `keyToAction("W")` → move forward; `keyToAction("ArrowLeft")` → move left; `keyToAction("3")` → `{kind:"room", index:2}`; `keyToAction("0")` → null; `keyToAction("x")` → null; `keyToAction("f")` → follow.
  - `isTypingTarget` true per `document.createElement("input")`, `"textarea"`, `"select"`, un div con `contentEditable="true"` (jsdom è già l'ambiente di vitest; se non calcola `isContentEditable`, controllare anche l'attributo); false per un `div` e per `null`.

- [ ] **Step 2: Run** `npx vitest run src/scene/cameraNav.test.ts` — Expected: FAIL (modulo mancante).
- [ ] **Step 3: Implement** le quattro funzioni in `src/scene/cameraNav.ts`.
- [ ] **Step 4: Run** `npx vitest run src/scene/cameraNav.test.ts` — Expected: PASS.
- [ ] **Step 5: Commit** `git add src/scene/cameraNav.ts src/scene/cameraNav.test.ts` → `feat(visuale): funzioni pure di navigazione della telecamera`.

### Task 2: Stato del segui nello store

**Files:**
- Modify: `src/store/useStore.ts` (interfaccia ~riga 78 e 192, implementazione ~riga 582)
- Test: `src/store/useStore.test.ts`

**Interfaces:**
- Produces: `cameraFollow: boolean` (iniziale `true`), `setCameraFollow: (v: boolean) => void`. `selectAgent(id)` imposta anche `cameraFollow: id !== null`.

- [ ] **Step 1: Write the failing tests:** dopo `selectAgent("a1")` → `cameraFollow === true`; `setCameraFollow(false)` → false; poi `selectAgent("a2")` → di nuovo true. Aggiungere `cameraFollow: true` allo stato di reset del file di test (riga ~26).
- [ ] **Step 2: Run** `npx vitest run src/store/useStore.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** in `useStore.ts` (non persistito).
- [ ] **Step 4: Run** `npx vitest run src/store/useStore.test.ts` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(visuale): stato del segui della telecamera nello store`.

### Task 3: CameraNav nella casa + segui che si sgancia

**Files:**
- Create: `src/scene/CameraNav.tsx`
- Modify: `src/scene/OfficeScene.tsx:1153-1242` (`CameraFollow`, `OfficeScene`)

**Interfaces:**
- Consumes: Task 1 (tutte), Task 2 (`cameraFollow`, `setCameraFollow`).
- Produces: componente
  ```ts
  function CameraNav(props: {
    controlsRef: React.RefObject<any>;   // OrbitControls
    bounds: Rect;                         // clamp del target
    home: { x: number; z: number; y: number; distance: number };
    rooms?: { id: string; x: number; z: number }[]; // assente nel giardino
    onManual?: () => void;                // chiamato a ogni movimento dell'utente
  }): null
  ```
  e la costante `NAV_MOUSE_PROPS` da spalmare su `<OrbitControls>`:
  `mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }}`, `touches={{ ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE }}`, `screenSpacePanning={false}`, `enablePan` true.

Comportamento di `CameraNav` (scelte del piano):
- `keydown`/`keyup` su `window` → set di tasti premuti; ignora se `isTypingTarget(e.target)` o con Ctrl/Meta/Alt. `preventDefault` solo per le frecce e i tasti gestiti.
- In `useFrame(delta)`: move = sposta target e camera insieme sul piano XZ nella direzione della camera proiettata, velocità `12 unità/s` × (distanza/20); rotate = `1.6 rad/s` attorno al target; zoom = scala la distanza di `(1 ± 1.2·delta)` rispettando min/max dei controlli. Ogni frame con tasto attivo chiama `onManual`.
- room/home: volo morbido del target (lerp `0.12`/frame, fine a < 0.05) verso il centro stanza (y 0.8) con distanza `14` per le stanze e `home.distance` per H; chiama `onManual` all'avvio. Un `start` dei controlli interrompe il volo.
- `controls.addEventListener("start", onManual)` per mouse/touch/rotella.
- Dopo `controls.update()` a ogni frame: se il target esce da `bounds`, sposta target e camera dello stesso delta (`clampTarget`).
- Tasto F: `setCameraFollow(true)` solo se c'è un agente selezionato (CameraNav lo fa direttamente leggendo lo store; nel giardino non c'è selezione quindi non succede nulla).

Modifiche in `OfficeScene.tsx`:
- `CameraFollow`: il tracciamento dell'agente (lerp del target e dolly) avviene solo se `cameraFollow` è true; quando `cameraFollow` passa da false a true riparte la transizione (`transition.current = 1`). Il ritorno al centro alla deselezione resta.
- `<OrbitControls>`: aggiungere `NAV_MOUSE_PROPS`, togliere `enablePan={false}`; resto invariato.
- Montare `<CameraNav controlsRef={controlsRef} bounds={layout.bounds} home={{ x: layout.centerX, y: 0.8, z: 0, distance: 21.4 }} rooms={roomShortcuts(layout)} onManual={() => useStore.getState().setCameraFollow(false)} />` (21.4 ≈ distanza iniziale da `[13,11,14]` a `[0,0.8,0]`; ricalcolarla, non inventarla).

- [ ] **Step 1: Implement** `CameraNav.tsx` e le modifiche a `OfficeScene.tsx`.
- [ ] **Step 2: Run** `npm run typecheck && npm run lint && npm test` — Expected: nessun errore, tutti i test verdi.
- [ ] **Step 3: Verifica a vista in Chrome** (`npm run dev`, Claude in Chrome): sinistro sposta, destro ruota, rotella zooma; WASD/frecce, Q/E, +/−, 1–5, H; selezione agente → segue; trascinamento → smette di seguire con agente ancora selezionato; F → riaggancia; centro non esce dalla casa; trascinamento mobili in riordino non sposta la visuale; digitare nel terminale non muove la camera. Tarare velocità se serve.
- [ ] **Step 4: Commit** `git add src/scene/CameraNav.tsx src/scene/OfficeScene.tsx` → `feat(visuale): spostamento libero, tastiera e segui che si sgancia nella casa`.

### Task 4: Pulsante «Segui» e giardino

**Files:**
- Modify: `src/Workspace.tsx` (~riga 1164, dentro il `div data-tour="scene"`)
- Modify: `src/scene/GardenScene.tsx:747-757`

**Interfaces:**
- Consumes: Task 2 (`selectedAgentId`, `cameraFollow`, `setCameraFollow`), Task 3 (`CameraNav`, `NAV_MOUSE_PROPS`).

- [ ] **Step 1: Pulsante** in `Workspace.tsx`: visibile solo se `selectedAgentId && !cameraFollow`; posizione `absolute top-3 right-3` (verificare che non copra altri controlli della scena, altrimenti spostarlo); testo «Segui», icona `LocateFixed` di lucide-react, `title="Torna a seguire l'agente (F)"`; stile come il pulsante «Log eventi» (bordo `border-line`, `bg-ink-800/90`, accento `text-brand-soft`); click → `setCameraFollow(true)`.
- [ ] **Step 2: Giardino:** `<OrbitControls ref={...} {...NAV_MOUSE_PROPS}>` senza `enablePan={false}` + `<CameraNav controlsRef={...} bounds={{minX:-12,maxX:12,minZ:-12,maxZ:12}} home={{ x: 0, y: 1.4, z: 0, distance: <distanza iniziale della camera del giardino, ricavata dal suo prop camera> }} />` (niente `rooms`, niente `onManual`). Il giardino si apre in un overlay sopra la casa: i tasti non devono muovere anche la casa → in `CameraNav` della casa ignorare i tasti quando la vista giardino è aperta (verificare come `GardenView` espone `open`; se è solo stato locale, alzarlo nello store o passare un flag `enabled` a `CameraNav`).
- [ ] **Step 3: Run** `npm run typecheck && npm run lint && npm test` — Expected: verde.
- [ ] **Step 4: Verifica a vista in Chrome:** pulsante appare solo da sganciato e riaggancia; nel giardino mouse e tastiera funzionano e la casa sotto non si muove; H torna alla vista iniziale del giardino.
- [ ] **Step 5: Commit** `git add src/Workspace.tsx src/scene/GardenScene.tsx src/scene/CameraNav.tsx` → `feat(visuale): pulsante Segui e nuovi controlli nel giardino`.

### Task 5: Chiusura

- [ ] **Step 1:** Spuntare le due voci in `docs/roadmap/ROADMAP5.md` («Zoom e movimento della visuale») annotando cosa è stato fatto (lo zoom resta come prima, fluidità non toccata).
- [ ] **Step 2: Commit** `git add docs/roadmap/ROADMAP5.md` → `docs(roadmap): movimento e segui della visuale fatti`.
