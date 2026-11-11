// Guardia anti-SSRF per il tool `web_fetch` degli agenti.
//
// Un agente decide da sé quali URL aprire, e in Live Sim legge il corpo delle issue
// GitHub: chiunque possa aprire un'issue può quindi suggerirgli un indirizzo. Senza
// questa guardia l'agente potrebbe interrogare il runtime stesso (localhost:8787), la
// rete interna o il servizio di metadata del cloud (169.254.169.254) e riportarne il
// contenuto nella chat. Si accettano solo host che risolvono a indirizzi pubblici, e
// lo stesso controllo si ripete su ogni redirect (vedi `fetchUrlText`).
//
// DNS rebinding (chiuso il 2026-11-10): `blockedUrlReason` risolve il nome una volta, ma
// la connessione lo risolveva di nuovo per conto suo, e un DNS ostile può rispondere
// "pubblico" al primo giro e 127.0.0.1 al secondo. Per questo la richiesta vera passa da
// `guardedFetch`, che usa `node:http`/`https` con una `lookup` propria: gli IP si
// controllano **nel momento in cui ci si connette**, e quelli sono gli IP usati davvero.
// Niente dipendenze nuove (undici non serve).

import http from "node:http";
import https from "node:https";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Readable } from "node:stream";

/** true se l'IPv4 (forma puntata) è privato, loopback, link-local o comunque non instradabile. */
function isPrivateV4(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  return (
    a === 0 || // "questa rete"
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local + metadata cloud
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && p[2] === 0) ||
    (a === 198 && (b === 18 || b === 19)) || // benchmark
    a >= 224 // multicast + riservati + broadcast
  );
}

/**
 * IPv6 → 16 byte, o null se malformato. Serve a classificare l'indirizzo per bit e non
 * per forma testuale: `new URL` normalizza `[::ffff:127.0.0.1]` in `[::ffff:7f00:1]`, e
 * un confronto su stringhe si farebbe aggirare da qualunque scrittura equivalente.
 */
function parseV6(ip: string): number[] | null {
  let s = ip.toLowerCase();
  const zone = s.indexOf("%");
  if (zone >= 0) s = s.slice(0, zone);
  // coda in forma puntata (::ffff:1.2.3.4) → due gruppi esadecimali
  const dotted = /(\d+\.\d+\.\d+\.\d+)$/.exec(s);
  if (dotted) {
    const p = dotted[1].split(".").map(Number);
    if (p.some((n) => n > 255)) return null;
    s = s.slice(0, -dotted[1].length) + ((p[0] << 8) | p[1]).toString(16) + ":" + ((p[2] << 8) | p[3]).toString(16);
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill("0"), ...tail];
  const bytes: number[] = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    const v = parseInt(g, 16);
    bytes.push(v >> 8, v & 0xff);
  }
  return bytes;
}

const v4From = (b: number[], at: number): string => b.slice(at, at + 4).join(".");

/** true se l'indirizzo IP (v4 o v6) non è un indirizzo pubblico raggiungibile in sicurezza. */
export function isPrivateAddress(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return isPrivateV4(ip);
  if (kind !== 6) return true; // non è un IP: per prudenza, no
  const b = parseV6(ip);
  if (!b) return true;
  const zeros = (from: number, to: number) => b.slice(from, to).every((x) => x === 0);
  // IPv4 incapsulato: mapped ::ffff:0:0/96, compatibile ::/96, NAT64 64:ff9b::/96,
  // 6to4 2002::/16 → si giudica la parte v4 (:: e ::1 ricadono qui come 0.0.0.x → privati).
  if (zeros(0, 10) && b[10] === 0xff && b[11] === 0xff) return isPrivateV4(v4From(b, 12));
  if (zeros(0, 12)) return isPrivateV4(v4From(b, 12));
  if (b[0] === 0x00 && b[1] === 0x64 && b[2] === 0xff && b[3] === 0x9b && zeros(4, 12)) return isPrivateV4(v4From(b, 12));
  if (b[0] === 0x20 && b[1] === 0x02) return isPrivateV4(v4From(b, 2));
  return (
    (b[0] & 0xfe) === 0xfc || // unique local fc00::/7
    (b[0] === 0xfe && (b[1] & 0xc0) === 0x80) || // link-local fe80::/10
    b[0] === 0xff // multicast
  );
}

type Resolver = (host: string) => Promise<Array<{ address: string; family?: number }>>;
const defaultResolver: Resolver = (host) => lookup(host, { all: true, verbatim: true });

/**
 * Restituisce un messaggio d'errore se l'URL punta (direttamente o via DNS) a un indirizzo
 * non pubblico, `null` se è lecito aprirlo. Ogni indirizzo risolto deve essere pubblico:
 * basta un record privato per rifiutare.
 */
export async function blockedUrlReason(raw: string, resolve: Resolver = defaultResolver): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "URL non valida";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return "URL non valida — deve iniziare con https://";
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    return "indirizzo interno non consentito";
  }
  if (isIP(host)) return isPrivateAddress(host) ? "indirizzo interno non consentito" : null;
  let addrs: Array<{ address: string }>;
  try {
    addrs = await resolve(host);
  } catch {
    return `host non risolvibile: ${host.slice(0, 60)}`;
  }
  if (addrs.length === 0) return `host non risolvibile: ${host.slice(0, 60)}`;
  return addrs.some((a) => isPrivateAddress(a.address)) ? "indirizzo interno non consentito" : null;
}

const BLOCKED = "indirizzo interno non consentito";

/** Firma della `lookup` che `net`/`http` chiamano al momento della connessione. */
type LookupCallback = (err: Error | null, address?: string | Array<{ address: string; family: number }>, family?: number) => void;

/**
 * `lookup` per `http.request`: risolve il nome e rifiuta se anche un solo indirizzo è
 * interno. Gira **alla connessione**, quindi gli IP controllati sono quelli usati davvero.
 */
export function makeGuardedLookup(resolve: Resolver = defaultResolver, isBlocked: (ip: string) => boolean = isPrivateAddress) {
  return (hostname: string, options: { all?: boolean } | number | undefined, callback: LookupCallback): void => {
    resolve(hostname)
      .then((addrs) => {
        if (addrs.length === 0) throw new Error(`host non risolvibile: ${hostname.slice(0, 60)}`);
        if (addrs.some((a) => isBlocked(a.address))) throw new Error(BLOCKED);
        const list = addrs.map((a) => ({ address: a.address, family: a.family ?? isIP(a.address) }));
        if (typeof options === "object" && options?.all) callback(null, list);
        else callback(null, list[0].address, list[0].family);
      })
      .catch((err: unknown) => callback(err instanceof Error ? err : new Error(String(err))));
  };
}

export interface GuardedFetchInit {
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

/** Dipendenze iniettabili (solo per i test). */
export interface GuardedFetchDeps {
  resolve?: Resolver;
  isBlocked?: (ip: string) => boolean;
}

/**
 * GET di un URL http(s) con il controllo degli IP alla connessione. Restituisce un
 * `Response` standard e **non segue i redirect**: chi chiama li ricontrolla uno per uno.
 * Un IP interno scritto direttamente nell'URL è rifiutato subito (per gli IP letterali
 * `net` non chiama la lookup).
 */
export function guardedFetch(raw: string, init: GuardedFetchInit = {}, deps: GuardedFetchDeps = {}): Promise<Response> {
  const isBlocked = deps.isBlocked ?? isPrivateAddress;
  return new Promise<Response>((resolvePromise, reject) => {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      reject(new Error("URL non valida"));
      return;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      reject(new Error("URL non valida — deve iniziare con https://"));
      return;
    }
    const host = url.hostname.replace(/^\[|\]$/g, "");
    if (isIP(host) && isBlocked(host)) {
      reject(new Error(BLOCKED));
      return;
    }
    const mod = url.protocol === "https:" ? https : http;
    const req = mod.request(
      url,
      {
        method: "GET",
        headers: init.headers,
        signal: init.signal,
        agent: false, // niente connessioni riusate: ogni richiesta ripassa dalla lookup
        lookup: makeGuardedLookup(deps.resolve ?? defaultResolver, isBlocked) as unknown as http.RequestOptions["lookup"],
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status < 200 || status > 599) {
          res.resume();
          reject(new Error(`risposta HTTP non valida (${status})`));
          return;
        }
        // `Headers` e `Response` lanciano su testo di stato o header che Node accetta ma il
        // fetch standard no (es. caratteri di controllo): qui siamo in un callback, e
        // un'eccezione non gestita farebbe cadere tutto il runtime (Ultrareview 2026-11-11).
        try {
          const headers = new Headers();
          for (const [k, v] of Object.entries(res.headers)) {
            if (Array.isArray(v)) for (const x of v) headers.append(k, x);
            else if (v !== undefined) headers.set(k, String(v));
          }
          const noBody = status === 204 || status === 205 || status === 304;
          const response = new Response(
            noBody ? null : (Readable.toWeb(res) as unknown as ReadableStream<Uint8Array>),
            { status, statusText: res.statusMessage, headers },
          );
          if (noBody) res.resume();
          resolvePromise(response);
        } catch (err) {
          res.destroy();
          reject(new Error(`risposta HTTP non valida (${(err as Error).message})`));
        }
      },
    );
    req.on("error", reject);
    req.end();
  });
}
