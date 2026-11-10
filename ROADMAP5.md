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

- [x] **D4-C** — guardie *viewer* sulle GET + token monouso per l'SSE (server + `connectBackend`) + test.
      **Fatto il 2026-11-10:** *viewer* su `GET` di chat, mondo, cronologia, routine, metriche, stato della sim e
      driver; `POST /api/events/ticket` emette un biglietto monouso da 30 s (`streamTickets.ts`, 6 test) e con i
      ruoli attivi `/api/events` senza biglietto valido risponde 401. Il client chiede un biglietto a ogni
      apertura dello stream; se è negato la barra di stato dice "SAMS: Accesso richiesto" con il link "Accedi" e
      riprova da sola (4 test nuovi su `connectBackend`). Restano pubblici health, status, whoami, le rotte di
      login e la dashboard `?public`. Provato dal vivo con curl e nel browser: anonimo → "Accesso richiesto";
      dopo il login la stanza si collega da sola in pochi secondi, senza ricaricare.
      ⚠️ Visto durante le prove: l'e2e `sidebars.spec.ts` "Panoramica sistema e Gate di sicurezza" è **instabile**
      (fallisce 2 volte su 5 anche sul commit precedente: il bottone "Apri pull request" non diventa cliccabile).
- [x] **D3-B** — inviti: tabella `invites` (token sha256 a riposo, scadenza, ruolo), `POST /api/auth/invites`
      (owner), registrazione da link d'invito che assegna il ruolo, UI nella `UsersAdmin`, email + test.
      **Fatto il 2026-11-10:** l'owner invita email + ruolo (*editor* o *viewer*, mai owner) dal Profilo; con un
      canale email l'invito parte, senza il link si consegna a mano (e non finisce nei log). Il link `/invito`
      vale una volta, solo per quell'indirizzo, 7 giorni; l'account nasce verificato e col ruolo dell'invito. Un
      nuovo invito alla stessa email sostituisce il precedente; quelli in attesa si revocano. Rotte:
      `POST/GET /api/auth/invites`, `DELETE /api/auth/invites/:id`, `POST /api/auth/invites/lookup` (token nel
      corpo, non nell'URL). 27 test nuovi (logica, DB, email, biglietti, pagina `/invito`, `UsersAdmin`). Provato dal vivo
      con l'API e nel browser: invito → link → registrazione → stanza da editor.
      **Seguito di sicurezza su D4-C** (revisione automatica dello stesso giorno): il biglietto dello stream ora
      ricorda la credenziale e il server la ricontrolla a ogni heartbeat, quindi logout o sessione revocata
      chiudono anche lo stream già aperto (provato: chiuso dopo 25 s); la rotta del biglietto ha un limite per
      identità e un tetto per credenziale, e a registro pieno risponde 503 invece di scartare biglietti altrui.
- [x] **Sicurezza (dopo D4-C e D3-B)** — dalla revisione automatica del 2026-11-10:
      1. **Link di reset nei log** (`mailer.ts`, driver `console`): senza canale email `/api/auth/forgot`
         non deve emettere link (solo log della richiesta); il reset passa dal link generato dall'owner.
      2. **DNS rebinding nella guardia SSRF** (`netGuard.ts`): validare l'IP a cui ci si connette davvero
         (agent undici con `connect.lookup` che applica `isPrivateAddress`).
      **Fatti il 2026-11-10.** (1) Senza canale email "password dimenticata" non emette nessun link e registra solo
      la richiesta; il driver `console` non scrive mai il corpo delle email nei log (solo destinatario e oggetto),
      quindi nessun link di reset o d'invito ci può finire. La pagina di accesso indica di chiedere il link al
      proprietario. (2) `web_fetch` passa da `guardedFetch`: `node:http`/`https` con una `lookup` propria che
      controlla gli IP **alla connessione**, cioè quelli usati davvero; niente redirect automatici e niente
      connessioni riusate. Niente `undici`, zero dipendenze nuove. 10 test nuovi, di cui 9 con un vero server
      locale che simula il rebinding (il server non viene mai contattato). Provato dal vivo: `example.com` in
      HTTP e HTTPS risponde, `localhost` e `169.254.169.254` sono rifiutati.
- [x] ~~D2-B~~ — fatto (palette Rossonero, link al lab rimosso).

### 🧪 Collaudo pre-rilascio del 2026-11-10 — cosa NON funziona

Provato tutto: typecheck, lint e build verdi; test unitari verdi (client **569**, server **354**); e2e
Playwright **19/19** verdi. Poi l'app è stata usata davvero nel browser con un runtime su un database
isolato (account owner + viewer, ruoli attivi e non, un task vero con Gemini e uno con OpenRouter).
I test automatici **non** vedono nessuno dei problemi qui sotto: vanno chiusi prima della RC (20/12).

**🔴 Bloccanti — la 1.0 non può uscire così**

- [x] **OpenRouter non funziona affatto (dal 2026-07-06).** L'header `X-Title` in `server/src/openrouter.ts`
      contiene un trattino lungo (`SAMS — Spatial…`): `fetch` lo rifiuta prima di spedire la richiesta
      (*Cannot convert argument to a ByteString… value of 8212*). Ogni task finisce in errore e l'agente resta
      **bloccato**. È il provider attivo. I test passano perché `fetch` è finto. Correzione: header solo ASCII
      + un test che costruisca davvero gli header con `new Headers(...)`.
      **Fatto il 2026-11-10:** header solo ASCII (`openrouterHeaders`, testato con `new Headers`). Dietro c'era
      un secondo guasto: i tre modelli `:free` proposti (Llama 3.3, Qwen 2.5, DeepSeek V3) **non sono più
      gratuiti** (OpenRouter risponde 404). Sostituiti con modelli verificati con una vera chiamata a tool:
      `nvidia/nemotron-3-ultra-550b-a55b:free` (predefinito), `cohere/north-mini-code:free`,
      `nvidia/nemotron-3.5-super-vl:free`, `google/gemma-4-31b-it:free`. Provato dal vivo: l'agente legge il
      README col tool e risponde. ⚠️ Il `server/.env` locale ha ancora `SAMS_MODEL` sul vecchio Llama: va
      cambiato a mano (ora l'ambiente vince sul file, vedi sotto).
- [x] **Senza `SAMS_TOKEN` un anonimo è owner, anche con gli account attivi.** `resolveRole` dà *owner* a chi
      non manda token se non è configurato nessun token statico. Risultato: un visitatore anonimo può
      cambiare le impostazioni, chiamare `provision` e avviare la Live Sim, mentre un utente *viewer* loggato
      riceve 403. In `render.yaml` `SAMS_TOKEN` è facoltativo (`sync: false`), quindi un deploy lasciato com'è
      è aperto a tutti. Deciso il comportamento, va scritto in DEPLOY.md: o i ruoli si attivano quando esiste un
      account, oppure il runtime non parte in produzione senza token.
      **Fatto il 2026-11-10 (decisione 1A):** i ruoli si attivano appena esiste un account, anche senza token
      statici (`rolesEnforced` in `roles.ts`, il server conta gli account; se il DB non risponde sceglie la via
      chiusa). Senza account e senza token resta il dev aperto. 4 test nuovi. Provato dal vivo: prima della
      registrazione anonimo owner; dopo, anonimo e token inventato 401 su settings/provision/sim, owner 200,
      viewer 403. Scritto in DEPLOY.md ("Roles and access"): su un deploy nuovo l'owner va registrato subito.
- [x] **`SAMS_TOKEN` (e ogni altra variabile d'ambiente) ignorato se esiste `.sams-runtime.json`.** In
      `config.ts` `load()` fa `{ ...env, ...file }`: il file salvato vince sull'ambiente, anche quando
      contiene `runtimeToken: ""`. Cambiare un token o una chiave su Render non ha effetto finché il file c'è.
      **Fatto il 2026-11-10:** precedenza **ambiente > file > default** (`resolveSettings`, 6 test); una variabile
      vuota non cancella il valore del file. Provato dal vivo: `SAMS_TOKEN` nell'ambiente con `runtimeToken: ""`
      nel file → ruoli attivi, anonimo 401. Documentato in DEPLOY.md.
      **Seguito (revisione di sicurezza, stesso giorno):** con l'ambiente che vince, un token "ruotato" dalla UI
      sarebbe tornato valido al riavvio. Ora i campi impostati dall'ambiente sono in **sola lettura** nella UI
      (marcati "dal server") e `POST /api/settings` risponde **409** se si prova a cambiarli; idem
      `/api/provision` se agente/ambiente vengono dall'ambiente. Rimandare lo stesso valore resta un no-op.
      L'elenco dei campi bloccati (`envManaged`, solo nomi) arriva **solo all'owner** e solo per i campi che la UI
      può modificare (mai token dei ruoli, secret dei webhook, MCP). Una seconda revisione aveva notato che anche i
      soli nomi, se pubblici, dicevano a un estraneo cosa mancava (es. il secret dei webhook). 10 test nuovi; provato
      dal vivo.
- [x] **Su Render i dati si perdono a ogni deploy.** `render.yaml` non monta nessun disco: il SQLite
      `.sams-data.db` (account, sessioni, chat, mondo, routine, cronologia) e `.sams-runtime.json` spariscono a ogni
      deploy o riavvio. Serve un `disk:` montato sulla cartella di lavoro del server (o spostare i file su un
      percorso configurabile).
      **Fatto il 2026-11-10 (decisione 2A, provvisoria — da rivedere prima della RC):** nuova variabile
      `SAMS_DATA_DIR` (`dataDir.ts`, 4 test) per database e impostazioni; `render.yaml` monta un disco da 1 GB su
      `/var/data`. Provato dal vivo: i due file nascono nella cartella indicata e l'account sopravvive al riavvio.
      Sistemato anche `docker-compose.yml`: il volume stava su `/app/server` e copriva il codice (dopo un rebuild
      girava il codice vecchio); ora lo stesso volume è su `/data`, così i dati già presenti restano visibili.
      Lì c'era anche `BASE_BRANCH` al posto di `GITHUB_BASE_BRANCH`. `.dockerignore` esclude il DB locale.
- [x] **`render.yaml` non è allineato al prodotto.** Manca `OPENROUTER_API_KEY` (il provider attivo) e
      `SAMS_PROVIDER` è fisso su `gemini`. Mancano anche `SAMS_MODEL`, `SAMS_EDITOR_TOKEN`, `SAMS_PUBLIC_URL` e
      `SMTP_*`/`RESEND_API_KEY`. Senza `SAMS_PUBLIC_URL` i link di reset e di verifica puntano a
      `http://localhost:5173`. Verificato dalla UI: il link dell'owner esce con `localhost:5173`.
      **Fatto il 2026-11-10:** `SAMS_PROVIDER=openrouter`, aggiunte `OPENROUTER_API_KEY`, `SAMS_MODEL`,
      `SAMS_PUBLIC_URL`, `SAMS_EDITOR_TOKEN`, `SAMS_MAIL_FROM`, `RESEND_API_KEY` e `SMTP_*` (tutte da compilare nel
      pannello di Render). DEPLOY.md elenca cosa riempire dopo il primo deploy. Il build Docker resta da provare.
- [x] **Lo stream degli eventi non si riconnette e la UI dice "Connesso".** Se il runtime si riavvia (o un
      proxy risponde 5xx), l'`EventSource` si chiude per sempre: il server conta **0 viste**, la barra di stato
      continua a dire "SAMS: Connesso" e i risultati dei task non arrivano più finché non si ricarica la pagina.
      Su Render capita a ogni deploy. Serve una riconnessione manuale con backoff in `connectBackend` e lo stato
      offline quando lo stream è chiuso.
      **Fatto il 2026-11-10:** il server manda un `ping` con nome ogni 25 s (prima un commento, invisibile al
      client); `connectBackend` riapre lo stream con attesa crescente (1 s → 30 s) quando il browser lo chiude, e
      un watchdog lo riapre se resta muto oltre 60 s (il caso del proxy che tiene aperta una connessione morta).
      La barra di stato dice "SAMS: Riconnessione…" invece di "Connesso" fisso. 11 test nuovi. Provato dal vivo:
      runtime spento → "Riconnessione…" in ~36 s; riacceso → di nuovo connesso in ~5 s, senza ricaricare.

**🟠 Importanti — funzionano male**

- [ ] **Ti vedi due volte nella barra presenze.** Da loggato e da solo compare "Ospite (tu), Owner":
      `PresenceRoster` passa `chatName` (vuoto) invece del nome effettivo (`chatName || accountName`). Così il
      riquadro "nel workspace" compare anche quando non c'è nessun altro.
- [ ] **I viewer restano "Ospite" per tutti.** `POST /api/presence` richiede *editor*: il viewer riceve 403 a ogni
      apertura (errore in console) e non può presentarsi col suo nome. Cursore e selezione sono già *viewer*.
- [ ] **Un viewer può diventare il driver del mondo.** `POST /api/driver` è *viewer*, ma un viewer non può
      salvare il mondo (`/api/world` è *editor*). Se un viewer apre per primo, guida lui la simulazione condivisa.
      Verificato: lease preso da "Viewer". Il lease va riservato a chi può scrivere.
- [ ] **Eventi finti all'avvio.** Log eventi e Output mostrano "Test superati: 24/24", "In attesa di revisione:
      Pull Request #128", "Distribuito in ambiente di staging" (`src/data/seed.ts`). Il Diario del mondo li racconta
      come lavoro vero ("green-agent ha completato 1 task") e il Replay li conta come azioni. Contraddice
      "niente task fittizie": con un runtime vero si vede una cronologia inventata.
- [ ] **Un task di sola lettura riuscito non risulta completato.** Viene registrato con stato `idle`
      (`agentTools.ts`, `didSomething ? "review" : "idle"`): in Cronologia appare "Inattivo" e i filtri non lo
      trovano. La dashboard pubblica e le metriche segnano **0 completati**. Verificato con Gemini.
- [ ] **Retry di OpenRouter fuorvianti.** Qualunque eccezione, anche un errore di programmazione, viene
      ritentata 4 volte con il messaggio "OpenRouter occupato" (~30 s persi) prima di mostrare l'errore vero.
      Vanno ritentati solo 429/5xx e gli errori di rete.
- [ ] **Stanza su mobile (390 px).** L'header deborda (l'icona del giardino è tagliata, la ricerca va su 3 righe),
      l'Inspector si sovrappone al pannello inferiore e la barra di stato e il riquadro dei suggerimenti escono dallo
      schermo. Il sito pubblico invece è a posto.
- [ ] **Il changelog del sito è fermo al 15/07** (`src/site/data/changelog.ts`) e la prima voce dice ancora
      "Palette Abisso/Ciano". Va allineato a `CHANGELOG.md` (Rossonero, lo-fi, ruoli, OpenRouter…).
- [ ] **Webhook GitHub aperto senza secret.** Senza `GITHUB_WEBHOOK_SECRET` le richieste non firmate sono
      accettate (verificato: 200), anche con `NODE_ENV=production`. In produzione andrebbero rifiutate.
- [ ] **Privacy e Termini non esistono.** Nel footer puntano a `/#site-footer`. Con registrazione ed email
      servono due pagine vere. Va anche controllato che `contatti@sams.app` sia nostro: il dominio `sams.app` è
      registrato e risolve.
- [ ] **Commit Garden non persistente.** `DB_HOST` è vuoto, quindi lo store è in memoria e i giardini si
      azzerano a ogni riavvio. Per la 1.0 serve MySQL configurato, oppure va spostato sul SQLite che esiste già.

**🟡 Minori**

- [ ] Tour e onboarding non si chiudono con **Esc**, anche se sono `aria-modal`.
- [ ] L'onboarding dice "Gemini è gratuito" e "`npm start`… porta 8787": non va bene per chi usa la versione
      ospitata né per un viewer, che non può aprire le impostazioni.
- [ ] Gli agenti di partenza mostrano il modello "Claude Opus" qualunque sia il provider configurato.
- [ ] `/login` mostra il form anche a chi ha già fatto l'accesso.
- [ ] Le etichette degli agenti della scena 3D (nome + stelle) restano sopra le finestre modali, per esempio sopra le
      impostazioni: vanno messe sotto l'overlay.
- [ ] La palette comandi (Ctrl+K) offre a un viewer azioni che non può fare: crea agente, impostazioni,
      reimposta area, pausa caffè per tutti. Anche il bottone "+ Agente" in alto resta visibile.
- [ ] `.dockerignore` non esclude `server/.sams-data.db`: il database locale finisce nel contesto di build.
- [ ] `/api/health` e `/api/status` sono pubblici ed espongono repo e URL della pagina Notion.
- [ ] L'SDK di Gemini scrive righe non JSON nei log ("there are non-text parts functionCall…").
- [ ] **Non verificato:** il build dell'immagine Docker, perché qui Docker non è installato. Va provato nel
      deploy di prova della RC.

**✅ Verificato funzionante** — sito pubblico (home, docs con le 16 sezioni e le ancore giuste, changelog,
404, tema chiaro/scuro). Account: registrazione (il primo account diventa owner), login, password errata,
gestione utenti e ruoli, link di reset dell'owner (monouso, rifiutato se riusato). Stanza: login → stanza,
6 agenti, i 10 tab del pannello inferiore, le 5 viste della barra sinistra, terminale (`help`, `agents`, comandi
sconosciuti), impostazioni runtime, palette comandi (50 comandi), Commit Garden, dashboard pubblica (`?public`).
Un task vero con **Gemini**: legge il repo coi tool e chiude in ~1 minuto (10,6k token). Il token GitHub ora
**legge** `Carlomadella/gioco-rap` (albero e file).

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
- [~] **Token GitHub** in `server/.env` — rigenerato dall'utente il 2026-11-10: valido (scade il 10/12/2026),
      ma **non vede il repo privato** `GITHUB_REPO` (404): va concesso l'accesso a quel repo nel token
      fine-grained (Repository access + permessi Contents/Issues/Pull requests). _Utente._
      **Aggiornamento del collaudo (2026-11-10):** ora la *lettura* funziona (albero e README di `gioco-rap`).
      Scrittura, PR e issue non sono state provate, apposta: avrebbero toccato il repo vero.
- [x] **Rossonero per tutto il progetto** (_deciso dall'utente il 2026-11-10: "deve diventare iconico"_):
      i token base di `index.css` (workspace, scuro e chiaro) sono ora quelli della palette Rossonero;
      sfumature, bagliori e `brand-soft` seguono l'accento. Un test impedisce che CSS e palette divergano.
- [x] **Stanza 3D rossonera** — _deciso dall'utente il 2026-11-10_: **la stanza resta com'è**; il resto
      della schermata usa i colori dello **stemma** (rosso, nero, bianco). Fatto: fondo nero pieno e grigi
      neutri (prima caldi, e il banner ambra faceva marrone); `slate` di Tailwind rimappato a grigio neutro
      (virava al blu, nella barra di sinistra si vedeva) e `rose` al rosso dello stemma (virava al rosa);
      `--c-accent-soft` da `255 128 128` (rosa) a `255 51 51`; ambra/azzurro/viola/fucsia tolti
      dall'interfaccia. Restano a colori, di proposito, i colori-identità degli agenti e i verdi di "ok".
- [x] **Design lab rimosso** (_deciso dall'utente il 2026-11-10_): via `/design`, `DesignContext`, le
      varianti di palette/navbar/hero/componenti e i loro test; i componenti hanno solo la forma scelta.

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

**Residui noti (non bloccanti, da valutare per la RC):** ~~finestra di DNS rebinding nella guardia SSRF~~
(chiusa il 2026-11-10 con `guardedFetch`); confronto dei token statici non a tempo costante
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
- [x] **Potare le varianti scartate** — fatto il 2026-11-10: lab e varianti non scelte rimossi.

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
