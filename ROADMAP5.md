-ricontrolla le hitbox degli agenti perchè si buggano ancora e si camminano verso creando un cerchio perchè non riescono a passare, fai in modo che gli agenti possano passarsi vicino o trapassarsi ma quando sono fermi, non possono stare nella stessa posizione

crea più alternative di un sito web responsive di benvenuto della web app (per crearlo leggi e prendi appunti anche dalla pagina changelog) con:

HOMEPAGE

HEADER
una navbar,
con un logo a sx (SAMS).
in mezzo 4 link con contatti (che rimanda al footer), documentazione, e altri due che preferisci (dammi idee).
a dx un bottone che rimanda ad una pagina di registrazione/login (se l'utente è già registrato e loggato mostra il profilo) e altro che preferisci (dammi idee).

MAIN
al centro dello scermo crea due bottoni, uno che rimanda a questa stanza/pagina e uno che rimanda alla documentazione, in basso nello schermo una sezione con un p h4 con scritto "Scopri di più" e un logo/una mini descrizione di cosa vuole far passare il sito/app.
(crea una opzione con una bacground image e una con un background video)

FOOTER
(per il link "Contatti"): logo + tagline, colonne (Prodotto/Docs/Contatti/ Legale), social/GitHub, email di contatto, © anno.

ALTRE PAGINE:

LOGIN

DOCUMENTAZIONE
inoltre nel sito web crea una documentazione a sezioni per ogni elemento presente e ogni tool a disposizione dell' utente, deve esserci tutto ciò che si vede a schermo e non

<!-- creami un documento google con un brainstorming su come renderizzare tutti i cosiddetti "componenti" se stessimo usando react, crea una sezione per ogni pagina. -->

creami un design per ogni scelta che c'è da fare, ad esempio per la navbar fammi vedere un'opzione con 5 link al centro(funzionalità, docs, github, prezzi, contatti) e 2 cta a dx, oltre a Accedi/Profilo (ThemeToggle (chiaro/scuro), profilo utente). Per le altre opzioni magari togli un link o un cta sempre diverso, per confrontare le differenze.  
Per l'Hero section crea un'opzione con la background-image (screenshot di come appare la stanza degli 11agenti), un'altra con un background-video di come appare la stanza e altre senza nessuna delle due opzioni precedenti.

Per il design creami un'opzione che richiama ai colori usati nella cartella sams insieme ad altre 4 opzioni con palette di colori diversi.

Crea diversi design per ognuno dei Componenti condivisi visibili a schermo nel browser (cartella site/): SiteLayout (Navbar + <Outlet/> + Footer), Navbar, Footer, Button/CTAButton, ThemeToggle, Logo, Container, SectionHeading, AuthContext/ProtectedRoute.

---

## 🚀 Verso il rilascio 1.0 — scadenza **31/12/2026**

> Fissata il 2026-11-09. Da oggi alla scadenza ci sono **~7 settimane**. Il prodotto è già
> ampio (R1–R5 quasi tutte chiuse): la 1.0 è soprattutto **decidere cosa resta fuori**,
> chiudere i residui di sicurezza e rendere il deploy ripetibile — non aggiungere frontiere.

### Tappe

| Entro | Tappa | Cosa vuol dire "fatto" |
| ----- | ----- | ---------------------- |
| **22/11/2026** | 🧭 **Decisioni di perimetro** ✅ | Prese il 2026-11-09, in anticipo (D1–D4 qui sotto). |
| **06/12/2026** | 🧊 **Feature freeze** | D3-B (inviti) e D4-C (niente letture anonime) completi; da qui in poi solo bug, sicurezza, docs. |
| **20/12/2026** | 🧪 **Release candidate** | e2e Playwright verdi, deploy di prova su Render da `render.yaml` partendo da zero, `docs/DEPLOY.md` riletta passo-passo, bundle e Lighthouse controllati. |
| **31/12/2026** | 🏁 **Rilascio 1.0.0** | `version` → `1.0.0` (root + server), sezione `[1.0.0]` nel CHANGELOG, tag git, deploy. |

### Decisioni di perimetro — prese il 2026-11-09 ✅

- [x] **D1 → A: il game loop autorevole resta fuori dalla 1.0.** Il mondo condiviso della 1.0 è quello
      col driver lease (B3). La versione **completa** (opzione C: simulatore sul server, niente driver) è
      il cuore della **prossima versione** dopo la 1.0. _Deciso dall'utente._
- [x] **D2 → B: il design lab resta ma non è più linkato.** Fuori dal footer, raggiungibile solo da
      `/design`. Il sito ha **un'identità sola**: i colori principali sono quelli del **Milan** — nuova
      palette **Rossonero** (neri neutri + rosso `227 6 19`, in chiaro rosso più profondo e nero come
      secondo colore), ora predefinita e anche nel CSS statico (niente lampo di colori vecchi al
      caricamento). _Deciso dall'utente; fatto il 2026-11-09._
- [x] **D3 → B: inviti via email sì, cookie httpOnly no (rimandato).** _Lasciata a Claude dall'utente._
      Motivo: oggi chi entra in un team si registra, nasce *viewer* e aspetta che l'owner lo promuova a
      mano; con gli inviti l'owner scrive un'email, sceglie il ruolo e la persona entra già col ruolo
      giusto. È il pezzo che rende la 1.0 usabile da un team, e poggia sul canale email che esiste già.
      Il cookie httpOnly è più sicurezza contro un XSS che oggi non risulta, ma cambia come si autenticano
      **tutte** le richieste del client: troppo rischio a ridosso del freeze → 1.x.
- [x] **D4 → C: niente letture anonime con i ruoli attivi, stream compreso.** Le GET di chat,
      cronologia, routine e mondo passano a *viewer*; lo stream `/api/events` richiede un **token di
      breve durata in query** (EventSource non manda header), emesso da un endpoint autenticato e
      monouso, così non resta valido nei log di un proxy. La dashboard pubblica (`/api/public`) resta
      com'è: è pubblica per scelta, col suo token di sola lettura. Senza token configurati (dev) nulla
      cambia. _Deciso dall'utente._

### Lavoro che ne segue — da chiudere entro il feature freeze (06/12/2026)

- [ ] **D4-C** — guardie *viewer* sulle GET + token monouso per l'SSE (server + `connectBackend`) + test.
- [ ] **D3-B** — inviti: tabella `invites` (token sha256 a riposo, scadenza, ruolo), `POST /api/auth/invites`
      (owner), registrazione da link d'invito che assegna il ruolo, UI nella `UsersAdmin`, email + test.
- [x] ~~D2-B~~ — fatto (palette Rossonero, link al lab rimosso).

### Non legato alle decisioni, fatto il 2026-11-09

- [x] **Sottofondo lo-fi** al posto del vecchio ronzio della stanza: loop originale **sintetizzato dal
      browser** (nessun file audio, nessun diritto di terzi) — accordi di settima su IV–iii–ii–I, basso,
      batteria boom-bap con swing, qualche click di vinile, sotto un filtro passa-basso. Di notte la batteria
      tace e il suono si scurisce. Partitura pura in `src/lib/lofi.ts` (6 test), motore in `audio.ts` con
      sequencer a lookahead (il ritmo resta preciso anche con la scena 3D che occupa il thread).

### Correzioni del 2026-11-10

- [x] **Rossonero per tutti** — la palette salvata nel browser (Abisso) vinceva sul nuovo default:
      aggiunta una *versione del design* (`DESIGN_VERSION` in `DesignContext.tsx`) che scarta le scelte
      vecchie quando cambiano i default. **Va aumentata a ogni cambio di default.**
- [x] **Niente lampo al caricamento** — tema, classe `site-scroll` e palette ora in `useLayoutEffect`:
      prima la pagina veniva dipinta coi colori della workspace e il CTA sfumava dal blu al rosso
      (a metà, testo a 2,6:1 — il test e2e di contrasto falliva circa 1 volta su 8; ora 30/30).
- [x] **Ronzio del lo-fi** — basso più corto, niente fruscio continuo, accordi abbreviati; il sequencer
      vecchio si ferma al ricaricamento a caldo. Misurato nel browser: nessuna nota sotto gli 80 Hz.
- [x] **Guardie di ruolo** — un anonimo risultava *viewer* e passava `requireRole("viewer")`: ora 401
      con i ruoli attivi (`isAnonymousWhenEnforced` in `roles.ts`, con test).
- [ ] **Token GitHub** in `server/.env` rifiutato da GitHub ("Bad credentials"): da rigenerare (utente).
- [x] **Rossonero per tutto il progetto** (_deciso dall'utente il 2026-11-10: "deve diventare iconico"_):
      i token base di `index.css` (workspace, scuro e chiaro) sono ora quelli della palette Rossonero;
      sfumature, bagliori e `brand-soft` seguono l'accento. Un test impedisce che CSS e palette divergano.
- [ ] **Stanza 3D rossonera** — più strade possibili (accenti / identità forte / "casa del club"):
      doc di decisione sul Drive "SAMS — Stanza 3D rossonera: decisione". _In attesa della scelta._

### Già fatto verso la 1.0 — revisione completa del codice (2026-11-09)

Typecheck, lint, build e tutte le suite verdi prima e dopo (server **349** test, client **605**).
Corretti:
- [x] **SSRF nel tool `web_fetch` degli agenti** — un agente (che in Live Sim legge il corpo delle
      issue, quindi è esposto a prompt injection) poteva aprire `localhost:8787`, la rete interna o il
      metadata del cloud (`169.254.169.254`), anche passando da un redirect. Nuovo `server/src/netGuard.ts`:
      solo host che risolvono a indirizzi pubblici, controllo ripetuto a **ogni redirect**, e lettura del
      corpo limitata in streaming (prima una risposta chunked senza `content-length` veniva letta tutta).
- [x] **Rotte senza guardia di ruolo** — `/api/file` e `/api/repo/tree` leggevano il repo col token
      GitHub del server senza controlli (repo privato leggibile da anonimi con i ruoli attivi); ora
      `viewer`. `/api/sim/claim|release|release-by-agent` (che toccano le label GitHub) ora `editor`,
      come l'assegnazione che le segue; `/api/sim/issues` e `GET /api/memory` ora `viewer`. Il client
      manda il token su tutte. Senza token configurati (dev) nulla cambia.
- [x] **CORS** — mancava `DELETE`: con `VITE_SAMS_BACKEND_URL` su un altro origin, eliminare routine e
      memoria falliva al preflight.
- [x] **Salvataggio del mondo non atomico** — `saveWorldAgents` ora gira in una transazione: un errore a
      metà non lascia più righe nuove sotto la versione vecchia (su cui si basa il CAS).
- [x] **Rate limiter che non dimenticava** — chiavi scelte dal client (id cursore/selezione) restavano
      in memoria per sempre; ora c'è una pulizia periodica delle finestre scadute.
- [x] **Escape HTML** nel profilo pubblico del Commit Garden (`origin` arrivava dall'header Host).
- [x] **Crash con storage bloccato** — 7 accessi a `localStorage` senza protezione (uno al caricamento
      dello store) facevano cadere la workspace in navigazione privata/cookie bloccati: nuovo
      `src/lib/safeStorage.ts`.
- [x] **Design lab: bottoni dentro bottoni** — le anteprime montavano `ThemeToggle`/`CTAButton` veri
      dentro il `<button>` di selezione (HTML non valido, warning React; l'anteprima del toggle scriveva
      pure il tema). Ora hanno una modalità `preview` inerte.
- [x] **Test instabili** — 1–8 test fallivano a caso per timeout (il primo test di un file, sotto carico
      parallelo); `testTimeout` alzato a 20 s in entrambe le suite.

**Residui noti (non bloccanti, da valutare per la RC):** finestra di DNS rebinding nella guardia SSRF
(richiederebbe un agent HTTP con lookup vincolato); confronto dei token statici non a tempo costante
(`roles.ts`); chunk `textures` da 841 kB e `index` da 518 kB nel build; la suite **e2e Playwright non è
stata eseguita** in questa revisione.

---

## 🗒️ Stato (aggiornato 2026-07-15)

**Fatto**
- [x] **Hitbox degli agenti** (in cima a questo file) — commit `4184f18`.
- [x] **Sito**: header/navbar (logo, link, CTA, Accedi/Profilo), main coi due bottoni +
      "Scopri di più", footer (logo+tagline, 4 colonne, GitHub, email, © anno), **login**
      (con auth **reale**, non più mock — portata in R4), **documentazione** a sezioni
      (`docsSections.ts`, a mano come deciso), changelog sotto la hero.
- [x] **Le varianti da confrontare** — non una galleria di mockup ma un **design lab**
      (`/design`) che applica le scelte al sito vero: la navbar in cima cambia mentre scegli.
      Le anteprime della hero usano lo **stesso componente** della home, non un'imitazione.
  - **5 palette** (`data/palettes.ts`): Ambra (attuale), **SAMS** (i blu della workspace,
    come chiesto), Foresta, Nebulosa, Abisso — ognuna in chiaro **e** scuro, ortogonali al
    ThemeToggle. Sorgente unica in TS che **genera** il CSS (`paletteCss`), così gli swatch
    possono mostrare i colori di una palette *non attiva*.
  - **4 navbar** (`data/navbarVariants.ts`): completa (5 link + 2 CTA + Accedi) e tre che
    tolgono **un pezzo diverso ciascuna** (GitHub / toggle tema / CTA stanza), così il
    confronto isola una variabile per volta. Sono dati, non quattro copie del markup.
  - **5 hero** (`data/heroVariants.ts`): screenshot, **video** della stanza (registrato dal
    canvas WebGL, 313 kB, con lo screenshot come poster), bagliori, griglia, piatta — ognuna
    col suo compromesso dichiarato.
- [x] **Contrasto** — trovato e chiuso un difetto vero mentre si provavano le palette: il
      testo dei bottoni primari era **bianco su ambra a 2.15:1**, e in tema chiaro diventava
      nero su accento scuro (Tailwind genera la variante important anche della rimappa
      `.theme-light .text-white`, che vince per specificità). Ora `--c-on-accent` è **derivato**
      dal contrasto (`onAccent`) e **tutte** le 10 combinazioni palette × tema superano 4.5:1
      (AA); l'accento di Abisso/chiaro è stato scurito perché era l'unico in cui né bianco né
      nero ci arrivavano.

- [x] **Varianti di ogni componente condiviso** (`data/componentVariants.ts`) — logo (orbitale/
      monogramma/punto), forma dei bottoni (arrotondato/pillola/squadrato), footer (completo/
      compatto), testate (eyebrow/nudo/linea), larghezza del contenuto (1024/1152/1280) e toggle
      tema (icona/etichetta). Le anteprime montano i **componenti veri** (`variant`/`shape`
      espliciti servono solo al lab, per disegnare le opzioni *non* scelte). Fuori dalla lista di
      proposito: `SiteLayout` è la somma di Navbar/Footer/Container, e `AuthContext`/
      `ProtectedRoute` sono logica di sessione — non hanno una forma da scegliere.
- [x] **Scelta fatta** (2026-07-15, dall'utente sul lab): **Abisso / Ciano** + hero **video** +
      **navbar completa**. Sono i `DEFAULT_*`; le altre restano provabili su `/design` finché
      non si decide di potarle.
- [x] **Video della hero, rifatto** — il primo era a ~4 fps (una serie di fotografie). Causa:
      `captureStream` su GPU software copia ogni frame e affossa il rendering (scena a 1.7 fps).
      Ora: screencast di Playwright (non tocca il rendering) + taglio dell'avvio con ffmpeg →
      **15s a 30 fps**, 1280x720, 603 kB. Inquadra il solo diorama (canvas a tutta finestra) e la
      camera fa una carrellata **andata e ritorno**, così il loop non stacca.

**Resta aperto**
- [ ] **Potare le varianti scartate** — quando le scelte sono definitive, il lab e i dati delle
      opzioni non scelte si possono togliere (o tenere, se serve ancora sperimentare).

---

Punti da decidere (aperti)
Dove vive il sito: route nell'app React attuale (consigliato) o sito separato?
Router interno leggero (consigliato) senza aggiungere dipendenze

Auth reale ora o mock prima (login finto) e backend dopo?
Mock prima ma mettilo nella roadmap4 da fare l'auth reale

Hero: parti con background immagine o video (o toggle per provarli entrambi)?
voglio tante varianti, non solo una con bg-image e una con bg-video

Docs: contenuti a mano nei dati docsSections.ts o generati dal Changelog/MDX?
contenuti a mano nei dati docsSections.ts, il changelog lo metteremo sotto la hero section
