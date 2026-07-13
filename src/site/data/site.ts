// Costanti condivise del sito (link, contatti). Centralizzate così Navbar, Footer e
// pagine leggono da un'unica sorgente.

export const GITHUB_URL = "https://github.com/Carlomadella/SAMS-Spatial-Agentic-Managment-System";

// Email di contatto — segnaposto: sostituire con l'indirizzo reale del progetto.
export const CONTACT_EMAIL = "contatti@sams.app";

export const TAGLINE = "La stanza spaziale dei tuoi agenti AI.";

/** Link centrali della navbar. Le ancore (#...) scrollano nella pagina corrente. */
export interface NavLink {
  label: string;
  to: string;
  external?: boolean;
}

export const NAV_LINKS: NavLink[] = [
  { label: "Home", to: "/" },
  { label: "Funzionalità", to: "/#funzionalita" },
  { label: "Docs", to: "/docs" },
  { label: "GitHub", to: GITHUB_URL, external: true },
  { label: "Prezzi", to: "/#prezzi" },
  { label: "Contatti", to: "/#site-footer" },
];
