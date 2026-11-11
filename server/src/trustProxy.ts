import { isIP } from "node:net";

// `trust proxy` di Express da `SAMS_TRUST_PROXY` (ROADMAP5, trovato il 2026-11-11).
//
// Dietro un proxy (Render) `req.ip` è l'indirizzo del proxy per tutti: i limiti per IP
// (login, registrazione, presenza, biglietti) diventano un solo limite condiviso. Con
// `trust proxy` Express prende l'IP del client da `X-Forwarded-For`.
//
// Il rischio opposto: quell'header lo può scrivere anche il client. Il proxy di Render
// **aggiunge** il suo hop in fondo e non toglie quello che arriva da fuori, quindi:
// - `true` (fidati di tutto) è vietato: prenderebbe la voce più a sinistra, falsificabile;
// - un numero N vuol dire "fidati degli ultimi N hop": va messo pari ai proxy davanti,
//   **mai di più** (uno in più e il client sceglie il proprio IP). Su Render: 1.
// - in alternativa, un elenco di IP/CIDR o dei nomi di Express (loopback, linklocal,
//   uniquelocal) dei proxy fidati.
// Non impostata (sviluppo locale, nessun proxy) = nessuna fiducia, come prima.

export type TrustProxySetting = false | number | string;

export interface TrustProxyResult {
  value: TrustProxySetting;
  /** messaggio da loggare se il valore è stato rifiutato */
  warning?: string;
}

const MAX_HOPS = 10;
const PRESETS = new Set(["loopback", "linklocal", "uniquelocal"]);

function isAddressOrCidr(entry: string): boolean {
  if (PRESETS.has(entry)) return true;
  const [addr, bits, ...rest] = entry.split("/");
  if (rest.length > 0) return false;
  const kind = isIP(addr);
  if (kind === 0) return false;
  if (bits === undefined) return true;
  if (!/^\d{1,3}$/.test(bits)) return false;
  return Number(bits) <= (kind === 4 ? 32 : 128);
}

export function parseTrustProxy(raw: string | undefined): TrustProxyResult {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "" || v === "false" || v === "0") return { value: false };
  if (v === "true") {
    return {
      value: false,
      warning: "SAMS_TRUST_PROXY=true ignorato: permetterebbe a chiunque di falsificare il proprio IP. Usa il numero di proxy davanti (su Render: 1).",
    };
  }
  if (/^\d+$/.test(v)) {
    const n = Number(v);
    if (n >= 1 && n <= MAX_HOPS) return { value: n };
    return { value: false, warning: `SAMS_TRUST_PROXY=${v} ignorato: il numero di proxy va da 1 a ${MAX_HOPS}.` };
  }
  const entries = v.split(",").map((e) => e.trim()).filter(Boolean);
  if (entries.length > 0 && entries.every(isAddressOrCidr)) return { value: entries.join(", ") };
  return {
    value: false,
    warning: `SAMS_TRUST_PROXY="${raw}" ignorato: usa un numero di proxy (1-${MAX_HOPS}) o un elenco di IP/CIDR.`,
  };
}
