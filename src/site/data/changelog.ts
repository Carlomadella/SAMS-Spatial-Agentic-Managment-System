// Estratto delle voci recenti del CHANGELOG, curato a mano per la sezione "Novità" della
// home (sotto la hero — scelta di Roadmap 5). La storia completa vive in CHANGELOG.md.
// La prima voce deve avere la data della sezione più recente di CHANGELOG.md (lo controlla
// changelog.test.ts): aggiungendo una sezione lì, aggiungi una voce qui.

export interface ChangelogEntry {
  date: string; // AAAA-MM-GG
  title: string;
  summary: string;
  tag: "Added" | "Changed" | "Fixed";
}

export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    date: "2026-11-11",
    title: "Ognuno col suo nome, nessuno guida senza poter salvare",
    summary:
      "Anche chi ha accesso in sola lettura si presenta col proprio nome invece di \"Ospite\"; la simulazione condivisa la guida solo chi può salvarla; da loggati non si compare più due volte tra le presenze.",
    tag: "Fixed",
  },
  {
    date: "2026-11-11",
    title: "Solo eventi veri",
    summary:
      "Il log parte vuoto invece di mostrare test e deploy inventati, un task di sola lettura riuscito conta come completato e OpenRouter ritenta solo i guasti passeggeri.",
    tag: "Fixed",
  },
  {
    date: "2026-11-10",
    title: "Inviti con ruolo",
    summary:
      "Il proprietario invita qualcuno via email come editor o viewer: il link vale una volta sola, solo per quell'indirizzo, e l'account nasce già verificato.",
    tag: "Added",
  },
  {
    date: "2026-11-10",
    title: "Con i ruoli attivi, niente accessi anonimi",
    summary:
      "Appena esiste un account i ruoli valgono sempre; chat, mondo e cronologia, stream compreso, si leggono solo con un accesso. I dati restano su un disco persistente.",
    tag: "Changed",
  },
  {
    date: "2026-11-10",
    title: "OpenRouter funziona",
    summary:
      "Le richieste non vengono più rifiutate, i modelli gratuiti proposti sono verificati, le variabili del server vincono sulle impostazioni salvate e lo stream si riconnette da solo.",
    tag: "Fixed",
  },
  {
    date: "2026-11-10",
    title: "Rossonero dappertutto",
    summary:
      "Rosso, nero e bianco per tutta l'interfaccia, workspace compresa, in tema scuro e chiaro. Le scelte sono fatte: il design lab non c'è più.",
    tag: "Changed",
  },
  {
    date: "2026-11-09",
    title: "Un sottofondo lo-fi",
    summary:
      "Il ronzio della stanza diventa un loop lo-fi generato dal browser: accordi morbidi, batteria leggera, qualche click di vinile. Di notte la batteria tace.",
    tag: "Changed",
  },
  {
    date: "2026-11-09",
    title: "Revisione completa verso la 1.0",
    summary:
      "Gli agenti non possono più aprire indirizzi interni con web_fetch, tutte le rotte hanno la loro guardia di ruolo e il salvataggio del mondo è atomico.",
    tag: "Fixed",
  },
];
