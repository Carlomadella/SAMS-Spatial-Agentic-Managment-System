// Dati delle pagine Privacy e Termini (ROADMAP5, 20/11/2026). Titolare, contatto e
// licenza non sono ancora decisi: restano segnaposto ben visibili da compilare prima
// della 1.0 (scelta dell'utente). Quando ci sono, basta sostituire `null` qui.

export const LEGAL_LAST_UPDATED = "2026-11-20";

/** Nome (o ragione sociale, sede e P. IVA) di chi pubblica la demo di SAMS. */
export const LEGAL_OWNER: string | null = null;

/** Email per le richieste sulla privacy e sui termini. */
export const LEGAL_CONTACT: string | null = null;

/** Licenza del codice (oggi la repo pubblica non ne ha una). */
export const LEGAL_LICENSE: string | null = null;

export const OWNER_PLACEHOLDER = "[NOME DEL TITOLARE]";
export const CONTACT_PLACEHOLDER = "[EMAIL DI CONTATTO]";
export const LICENSE_PLACEHOLDER = "[LICENZA]";

/** Vero finché almeno un dato legale è ancora un segnaposto. */
export const LEGAL_INCOMPLETE = LEGAL_OWNER === null || LEGAL_CONTACT === null || LEGAL_LICENSE === null;
