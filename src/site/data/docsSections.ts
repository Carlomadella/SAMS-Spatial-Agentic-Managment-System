// Contenuti della documentazione, scritti a mano (scelta di Roadmap 5: niente
// generazione da MDX/Changelog). Ogni sezione descrive un pezzo dell'app — ciò che si
// vede a schermo e i concetti dietro. Espandibile: aggiungere una voce qui la fa
// comparire nell'indice e nella pagina /docs senza altro codice.

export interface DocItem {
  term: string;
  desc: string;
}

export interface DocSection {
  id: string;
  title: string;
  intro: string;
  items?: DocItem[];
}

export const DOCS_SECTIONS: DocSection[] = [
  {
    id: "panoramica",
    title: "Panoramica",
    intro:
      "SAMS (Spatial Agentic Management System) è una workspace 3D dove i tuoi agenti AI vivono in una stanza: ricevono task, lavorano, collaborano e producono risultati concreti (Pull Request su GitHub, note su Notion). È insieme un cruscotto operativo per orchestrare il lavoro e un mondo simulato in stile Sims, dove ogni agente ha una sua vita.",
    items: [
      { term: "La stanza", desc: "La scena 3D centrale: una casa a quattro stanze (studio, cucina, salotto, camera) dove gli agenti camminano, lavorano alle scrivanie, chiacchierano e di notte dormono." },
      { term: "Guscio IDE", desc: "Attorno alla scena, un'interfaccia da editor di codice: barra del titolo, barra attività, pannelli laterali e inferiore, barra di stato." },
      { term: "Runtime opzionale", desc: "Un backend (managed-agents runtime) fa lavorare davvero gli agenti su GitHub. Senza runtime la stanza gira comunque in locale come simulazione." },
      { term: "Mondo condiviso", desc: "Più persone possono guardare e comandare la stessa stanza in tempo reale, con presenza, cursori e movimento sincronizzato." },
    ],
  },
  {
    id: "interfaccia",
    title: "L'interfaccia",
    intro: "Il guscio attorno alla scena è organizzato come un IDE. Ogni elemento è collassabile per lasciare spazio alla stanza.",
    items: [
      { term: "Barra del titolo", desc: "In alto: nome del workspace, stato del runtime e i controlli principali della finestra." },
      { term: "Barra attività", desc: "La colonna di icone a sinistra: cambia cosa mostra il pannello sinistro (file, ricerca, controllo versione, agenti…)." },
      { term: "Barra di stato", desc: "In basso: informazioni sintetiche sullo stato del sistema, della connessione e della selezione corrente." },
      { term: "Banner runtime", desc: "Compare quando il runtime è offline o in errore, per distinguere la simulazione locale dal lavoro reale." },
      { term: "Layout responsive", desc: "Sotto i 768px i pannelli si collassano automaticamente in drawer, con una barra mobile dedicata, così la scena resta visibile." },
    ],
  },
  {
    id: "stanza-3d",
    title: "La stanza 3D",
    intro: "La scena è interattiva e vive di un ciclo giorno/notte: di giorno gli agenti lavorano e vagano, di notte dormono.",
    items: [
      { term: "Telecamera", desc: "Trascina per orbitare, scorri per lo zoom. Una vignettatura scurisce gli angoli e mette a fuoco il diorama al centro." },
      { term: "Le stanze", desc: "Studio (scrivanie), cucina (bancone e isola), salotto (divano) e camera (sei letti), collegate da porte e da un atrio centrale." },
      { term: "Zone", desc: "Punti di interesse dove mandare un agente: scrivania, angolo lettura, cucina, salotto, camera. Un task sceglie da solo la zona adatta dal titolo." },
      { term: "Giorno e notte", desc: "Dalle 23:00 alle 07:00 è notte: gli agenti liberi vanno a letto e dormono; l'ambiente sonoro si fa più caldo." },
      { term: "Micro-attività", desc: "Un agente libero prende un caffè in cucina, schizza idee all'angolo lettura o fa stretching altrove — puramente visivo." },
    ],
  },
  {
    id: "agenti",
    title: "Gli agenti",
    intro: "Ogni agente ha un'identità (nome, colore, avatar robot), uno stato di lavoro, un ruolo e dei bisogni che ne guidano l'umore.",
    items: [
      { term: "Stati", desc: "Idle (libero), working (al lavoro), review (in revisione), awaiting_approval (attende un ok), done (appena completato). Lo stato è mostrato dalla spia sul petto e sull'antenna." },
      { term: "Ruoli", desc: "Ogni agente ha un ruolo (es. sviluppatore, revisore, meta-agente) che indirizza a chi assegnare i task e verso chi fare gli handoff." },
      { term: "Livello e XP", desc: "Completare task fa guadagnare esperienza e salire di livello: la stellina ⭐ accanto al nome mostra il livello raggiunto." },
      { term: "Energia e fame", desc: "Due bisogni scorrono lentamente nel tempo. Assegnare un task 'nutre' l'agente; un agente affamato mostra un'icona dedicata e cambia umore." },
      { term: "Umore", desc: "Derivato dai bisogni: un agente sazio e riposato è sereno, uno affamato o scarico lo segnala con indicatore e postura." },
      { term: "Istruzioni", desc: "A ogni agente puoi dare istruzioni persistenti (una 'persona') che accompagnano ogni task che riceve." },
    ],
  },
  {
    id: "selezione",
    title: "Selezionare e comandare",
    intro: "La stanza si comanda direttamente col mouse, oltre che dai pannelli.",
    items: [
      { term: "Seleziona", desc: "Clic sinistro su un agente per selezionarlo: appare l'anello di selezione e un menu radiale di azioni rapide sopra di lui." },
      { term: "Menu radiale", desc: "Attorno all'agente selezionato: metti al lavoro, invia in revisione, segna completato, manda nel salotto, rimuovi." },
      { term: "Cammina", desc: "Clic sul pavimento per dare una destinazione: l'agente calcola un percorso che evita mobili e muri e attraversa le porte." },
      { term: "Hitbox", desc: "Gli agenti in movimento si passano vicino e si attraversano liberamente; da fermi mantengono una distanza minima e non occupano mai la stessa posizione." },
      { term: "Scorciatoie", desc: "Tab / Shift+Tab per scorrere gli agenti, Esc per deselezionare, Cmd/Ctrl+K per la command palette." },
    ],
  },
  {
    id: "pannello-sinistro",
    title: "Pannello sinistro",
    intro: "Cambia contenuto in base alla barra attività: esplorazione, ricerca e controllo versione del repo di lavoro.",
    items: [
      { term: "File", desc: "Mostra i file reali del repository (via GitHub) sul branch corrente. Cliccando un file si apre un visualizzatore con il contenuto reale e i numeri di riga." },
      { term: "Ricerca", desc: "Cerca tra i contenuti del progetto dall'interno della workspace." },
      { term: "Controllo versione (SCM)", desc: "Mostra le modifiche della workspace e il grafo dei commit/branch prodotti dagli agenti." },
      { term: "Visualizzatore file", desc: "Una modale che legge il contenuto reale dal repo sul branch corrente; gestisce file binari, mancanti e troppo lunghi (troncati), si chiude con Esc." },
    ],
  },
  {
    id: "pannello-destro",
    title: "Pannello destro — Inspector",
    intro: "L'inspector dell'agente selezionato: tutto ciò che riguarda chi è e cosa sta facendo.",
    items: [
      { term: "Task corrente", desc: "Titolo, branch e barra di avanzamento del task in corso." },
      { term: "Ruolo e istruzioni", desc: "Modifica il ruolo e le istruzioni persistenti dell'agente." },
      { term: "Cronologia", desc: "Lo storico dei task e degli eventi dell'agente selezionato." },
      { term: "Azioni", desc: "Assegna un task, mettilo in coda, invialo in revisione o rimuovilo dalla workspace." },
    ],
  },
  {
    id: "pannello-inferiore",
    title: "Pannello inferiore",
    intro: "L'area a schede sotto la scena, nascondibile e riapribile con un pulsante flottante.",
    items: [
      { term: "Log eventi", desc: "Il flusso in tempo reale di tutto ciò che accade: assegnazioni, completamenti, handoff, errori, chiacchiere degli agenti." },
      { term: "Terminale", desc: "L'output testuale delle operazioni del runtime." },
      { term: "Output", desc: "Il risultato prodotto da un task (es. il link alla Pull Request o alla nota Notion)." },
    ],
  },
  {
    id: "task",
    title: "Task, code e assegnazioni",
    intro: "Il cuore operativo: assegnare lavoro agli agenti e seguirlo fino al risultato.",
    items: [
      { term: "Assegna un task", desc: "Dai un titolo e un branch; l'agente passa in working, cammina verso la zona adatta e la barra mostra l'avanzamento." },
      { term: "Coda", desc: "Se un agente è occupato, i task successivi si accodano e partono da soli non appena si libera (auto-start)." },
      { term: "Revisione e approvazione", desc: "Un task può passare in review e, se richiesto, attendere un'approvazione esplicita prima di procedere." },
      { term: "Risultato", desc: "Un task completato può produrre un link (PR GitHub / nota Notion): quel risultato paga un bonus di monete oltre all'XP." },
      { term: "Template di task", desc: "Punti di partenza pronti per i tipi di lavoro più comuni." },
    ],
  },
  {
    id: "collaborazione",
    title: "Collaborazione",
    intro: "Gli agenti non lavorano da soli: si passano il lavoro con diversi protocolli, disegnati in 3D come archi di handoff con un suono dedicato.",
    items: [
      { term: "Relay", desc: "Passaggio punto-a-punto di un task a un altro agente, scelto per nome o per ruolo. Se il destinatario è occupato, il task si accoda." },
      { term: "Reazioni a catena", desc: "Regole dichiarative: al completamento di un task che soddisfa una regola, ne parte automaticamente un altro verso un agente target. Un cooldown evita cascate infinite." },
      { term: "Playbook / tavoli", desc: "Pipeline ordinate a stadi, ognuno con un ruolo: il lavoro passa di stadio in stadio fino alla fine, con una retrospettiva (durata e contributori) al termine." },
      { term: "Affinità", desc: "Collaborare ripetutamente costruisce affinità tra due agenti: gli amici si cercano, chiacchierano più spesso e tendono a lavorare insieme." },
    ],
  },
  {
    id: "mondo-condiviso",
    title: "Mondo condiviso",
    intro: "Quando più viste sono connesse al runtime, la stanza diventa un mondo condiviso in tempo reale (via Server-Sent Events).",
    items: [
      { term: "Presenza", desc: "Il roster mostra chi sta guardando adesso e quanti sono." },
      { term: "Cursori", desc: "I cursori delle altre viste sono visibili nella scena, come in un editor collaborativo." },
      { term: "Presenza di selezione", desc: "Quando un'altra vista seleziona un agente, lo vedi evidenziato da un'aura con il nome di chi lo sta guardando." },
      { term: "Driver", desc: "Una sola vista tiene il 'lease' di simulatore e anima il mondo (movimento, bisogni, socialità); le altre seguono, adottano e interpolano le posizioni. Se il driver sparisce, un'altra vista subentra senza scatti." },
      { term: "Stato autorevole", desc: "Uno snapshot compatto del mondo viene salvato lato server, così una vista appena connessa riflette la verità del server e non solo il proprio localStorage." },
    ],
  },
  {
    id: "automazione",
    title: "Automazione",
    intro: "SAMS può reagire e agire da solo, oltre che su comando.",
    items: [
      { term: "Routines", desc: "Task ricorrenti pianificati: abilitare una routine è l'opt-in perché venga assegnata automaticamente quando scatta." },
      { term: "Webhook / wake", desc: "Un evento esterno (es. un fallimento CI) può 'svegliare' la workspace e proporre un task; con l'auto-assegnazione attiva viene affidato a un agente libero." },
      { term: "Meta-agente proattivo", desc: "Opzionale: ogni tanto un meta-agente libero propone da solo un miglioramento di SAMS, con un cooldown per non esagerare e saltando la notte." },
    ],
  },
  {
    id: "economia",
    title: "Economia, obiettivi e giardino",
    intro: "Il lavoro degli agenti si trasforma in progressione visibile.",
    items: [
      { term: "Monete", desc: "Ogni task completato paga monete; produrre un risultato concreto (una PR / nota) paga un bonus." },
      { term: "Obiettivi", desc: "Ogni agente avanza verso obiettivi con traguardi (numero di task): al raggiungimento parte una celebrazione." },
      { term: "Giardino", desc: "Una vista dedicata dove la produttività fa crescere qualcosa di vivo: un giardino/foresta di team che riflette il lavoro svolto." },
    ],
  },
  {
    id: "strumenti",
    title: "Strumenti",
    intro: "Le funzioni trasversali a disposizione dell'utente.",
    items: [
      { term: "Command palette", desc: "Cmd/Ctrl+K apre la palette per lanciare qualunque azione rapida da tastiera." },
      { term: "Impostazioni", desc: "Tema chiaro/scuro, notifiche desktop, narrazione vocale, audio ambientale e altre preferenze." },
      { term: "Replay", desc: "Riavvolgi la cronologia degli eventi del mondo per rivedere cosa è successo e quando." },
      { term: "Diario del mondo", desc: "Un racconto sintetico degli eventi salienti della stanza." },
      { term: "Notifiche desktop", desc: "Con la scheda in secondo piano, gli eventi importanti (completamenti, errori, richieste di approvazione) sollevano una notifica di sistema." },
      { term: "Audio e narrazione", desc: "Un ambiente sonoro sintetizzato (tono di stanza, tasti, chime) e una narrazione vocale che legge gli eventi salienti. Entrambi attivabili dai toggle flottanti." },
      { term: "Onboarding e tour", desc: "Un wizard iniziale spiega i concetti e un tour guidato mostra gli elementi reali dell'interfaccia." },
      { term: "Dashboard pubblica", desc: "Una vista di sola lettura e condivisibile, raggiungibile con ?public: mostra lo stato senza montare la workspace (niente controlli, niente SSE)." },
    ],
  },
  {
    id: "provider",
    title: "Provider AI e modelli",
    intro: "Il runtime può parlare con diversi provider di modelli; ne basta uno configurato con la relativa chiave. La scelta si fa via variabili d'ambiente lato server.",
    items: [
      { term: "OpenRouter", desc: "Provider attivo di default: dà accesso a molti modelli, sia gratuiti (varianti :free) sia a pagamento, con un'unica chiave." },
      { term: "Gemini", desc: "I modelli Google Gemini, con il loro piano gratuito." },
      { term: "Anthropic", desc: "I modelli Claude di Anthropic." },
      { term: "Groq", desc: "Inference molto veloce su modelli aperti." },
      { term: "Configurazione", desc: "Si imposta il provider e la chiave nel file .env del server (o nelle variabili d'ambiente del deploy). Basta almeno una chiave valida." },
    ],
  },
];
