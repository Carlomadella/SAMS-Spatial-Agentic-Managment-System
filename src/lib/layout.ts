// Layout responsive — soglia mobile condivisa (Roadmap 3/4, "mobile usabile").
//
// Sotto questa larghezza il workspace passa a un layout touch: i pannelli laterali
// diventano drawer in overlay (non più colonne che schiacciano la scena) e compare
// una barra azioni in basso per raggiungerli. Soglia pura e testabile qui; il
// rendering vive in `MobileBar.tsx` e in `App.tsx`.

/** Larghezza (px) sotto la quale si attiva il layout mobile. Allineata a `md` di Tailwind. */
export const MOBILE_BREAKPOINT = 768;

/** Vero quando la viewport è in fascia mobile (touch), a soglia inclusiva-sotto. */
export function isMobileWidth(width: number): boolean {
  return Number.isFinite(width) && width < MOBILE_BREAKPOINT;
}
