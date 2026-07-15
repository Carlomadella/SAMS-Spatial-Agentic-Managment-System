// Estratto delle voci recenti del CHANGELOG, curato a mano per la sezione "Novità" della
// home (sotto la hero — scelta di Roadmap 5). La storia completa vive in CHANGELOG.md.

export interface ChangelogEntry {
  date: string; // AAAA-MM-GG
  title: string;
  summary: string;
  tag: "Added" | "Changed" | "Fixed";
}

export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    date: "2026-07-15",
    title: "Password dimenticata? Ora si rientra",
    summary:
      "Link di reset monouso via email, verifica dell'indirizzo, e — se non hai un server di posta — il link lo emette il proprietario.",
    tag: "Added",
  },
  {
    date: "2026-07-13",
    title: "Hitbox degli agenti riviste",
    summary: "Chi cammina si attraversa liberamente; da fermi non si sovrappongono più — niente più 'cerchio'.",
    tag: "Fixed",
  },
  {
    date: "2026-07-12",
    title: "File veri del repo nella sidebar",
    summary: "La sidebar mostra i file reali del repo via GitHub e ne apre il contenuto in un visualizzatore.",
    tag: "Added",
  },
  {
    date: "2026-07-11",
    title: "Bisogni condivisi tra le viste",
    summary: "Energia e fame viaggiano nel mondo condiviso: i follower li adottano dal driver.",
    tag: "Added",
  },
  {
    date: "2026-07-10",
    title: "Movimento condiviso in tempo reale",
    summary: "Il driver anima gli agenti e le altre viste seguono, interpolando le posizioni.",
    tag: "Added",
  },
];
