/**
 * La patch delle impostazioni senza i campi gestiti dall'ambiente del server. Quei campi
 * sono in sola lettura: mandarli (anche cambiati di riflesso, come il modello quando si
 * cambia provider) farebbe rispondere il server 409 a ogni salvataggio (Ultrareview 2026-11-11).
 */
export function withoutLocked<T extends object>(patch: T, locked: ReadonlySet<string>): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(patch) as Array<[keyof T & string, T[keyof T & string]]>) {
    if (!locked.has(k)) out[k] = v;
  }
  return out;
}
