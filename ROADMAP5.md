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

Punti da decidere (aperti)
Dove vive il sito: route nell'app React attuale (consigliato) o sito separato?
Router interno leggero (consigliato) senza aggiungere dipendenze

Auth reale ora o mock prima (login finto) e backend dopo?
Mock prima ma mettilo nella roadmap4 da fare l'auth reale

Hero: parti con background immagine o video (o toggle per provarli entrambi)?
voglio tante varianti, non solo una con bg-image e una con bg-video

Docs: contenuti a mano nei dati docsSections.ts o generati dal Changelog/MDX?
contenuti a mano nei dati docsSections.ts, il changelog lo metteremo sotto la hero section
