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
| **22/11/2026** | 🧭 **Decisioni di perimetro** | Risposte alle domande qui sotto (D1–D4), scritte in questo file. Senza, le tappe dopo non sono pianificabili. |
| **06/12/2026** | 🧊 **Feature freeze** | Solo ciò che le decisioni hanno messo *dentro* la 1.0 è completo; da qui in poi solo bug, sicurezza, docs. |
| **20/12/2026** | 🧪 **Release candidate** | e2e Playwright verdi, deploy di prova su Render da `render.yaml` partendo da zero, `docs/DEPLOY.md` riletta passo-passo, bundle e Lighthouse controllati. |
| **31/12/2026** | 🏁 **Rilascio 1.0.0** | `version` → `1.0.0` (root + server), sezione `[1.0.0]` nel CHANGELOG, tag git, deploy. |

### Decisioni aperte (da prendere con l'utente — non scelte da Claude)

- [ ] **D1 — B1/B4, il game loop autorevole sul server** (ROADMAP4, frontiera #1): dentro o fuori
      dalla 1.0? È l'unico progetto grosso rimasto ed è gated sulle 5 domande di prodotto del §7 del
      doc di decisione. _Proposta:_ **fuori** (1.x) — in 7 settimane non ci sta insieme al resto, e il
      mondo condiviso funziona già col driver lease (B3).
- [ ] **D2 — Varianti del design lab**: potarle (sito più leggero, meno codice) o tenere `/design`
      come pagina pubblica? Le scelte sono già fatte (Abisso + video + navbar completa).
- [ ] **D3 — Inviti via email e cookie httpOnly** (residui dell'auth in ROADMAP4): dentro o fuori?
- [ ] **D4 — Letture senza autenticazione**: con i ruoli attivi, `GET /api/chat`, `/api/history`,
      `/api/routines`, `/api/world` e lo stream `/api/events` restano leggibili da chiunque raggiunga
      il runtime. Va bene per un'istanza "di squadra" su rete fidata; per un'istanza pubblica no.
      Chiuderle tocca anche l'SSE (EventSource non manda header → servirebbe un token in query).

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
