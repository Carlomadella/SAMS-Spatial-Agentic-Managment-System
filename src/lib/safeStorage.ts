// Accesso a localStorage che non lancia mai. In navigazione privata su alcuni browser,
// con i cookie bloccati o in un iframe sandboxed, `localStorage` esiste ma ogni accesso
// lancia un SecurityError: senza guardia, una semplice preferenza (suoni, suggerimenti,
// tema) basta a far crashare la workspace al primo render. Qui si degrada in silenzio:
// la preferenza semplicemente non resta salvata.

export function storageGet(key: string): string | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function storageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage non disponibile: la preferenza non persiste */
  }
}

export function storageRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* storage non disponibile */
  }
}
