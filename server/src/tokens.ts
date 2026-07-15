// Token monouso a scadenza — la primitiva dietro al reset password e alla verifica
// email (Roadmap 4, frontiera #3; doc di decisione 2026-07-15). Logica pura e
// deterministica: `now` è iniettabile, così i test non dipendono dall'orologio.
//
// Due scelte che vale la pena rendere esplicite:
//
//  1. **A riposo si salva solo l'hash** (sha256 del token). Il token in chiaro esiste
//     solo nel link consegnato alla persona; un dump del DB non deve regalare reset
//     validi. Stesso spirito delle password (`auth.ts`), con una differenza: qui basta
//     sha256 e non serve scrypt, perché un token da 256 bit casuali non è forzabile a
//     dizionario — il costo di calcolo servirebbe solo contro segreti a bassa entropia.
//  2. **Monouso davvero**: `used_at` viene marcato al consumo, e un token già usato è
//     inservibile anche se non è ancora scaduto.

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Durata di un link di reset password: corto, è una finestra d'attacco. */
export const RESET_TTL_MS = 60 * 60 * 1000; // 1 ora
/** Durata di un link di verifica email: più lungo, non è un rientro d'emergenza. */
export const VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24 ore

/** Riga di un token monouso come vive nel DB (vale per reset e verifica). */
export interface TokenRecord {
  tokenHash: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
  usedAt: number | null;
}

/** Token opaco e imprevedibile (256 bit) da mettere nel link. */
export function newToken(): string {
  return randomBytes(32).toString("hex");
}

/** Hash del token per il salvataggio a riposo (vedi nota 1 in testa al file). */
export function hashToken(token: string): string {
  return createHash("sha256").update(String(token ?? "")).digest("hex");
}

/**
 * Confronto a tempo costante tra due hash di token. Non protegge da un attacco
 * pratico (il lookup è per chiave primaria), ma evita di introdurre un confronto
 * dipendente dal contenuto su un segreto — coerente con `verifyPassword`.
 */
export function tokenHashEquals(a: string, b: string): boolean {
  const x = Buffer.from(String(a ?? ""), "utf8");
  const y = Buffer.from(String(b ?? ""), "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Istante di scadenza a partire da adesso. */
export function tokenExpiry(ttlMs: number, now = Date.now()): number {
  return now + ttlMs;
}

/**
 * Un token è spendibile solo se esiste, non è già stato usato e non è scaduto.
 * La scadenza è **esclusiva**: a `expiresAt` esatto il token è già morto.
 */
export function isTokenUsable(rec: TokenRecord | null | undefined, now = Date.now()): boolean {
  if (!rec) return false;
  if (rec.usedAt !== null) return false;
  return now < rec.expiresAt;
}

/**
 * Motivo del rifiuto, per dare al client un messaggio onesto invece di un generico
 * "non valido". Non è una fuga d'informazione: chi ha il token in mano ha già il
 * segreto, e sapere "è scaduto" gli evita di credere che il link fosse falso.
 */
export function tokenRejection(
  rec: TokenRecord | null | undefined,
  now = Date.now(),
): "unknown" | "used" | "expired" | null {
  if (!rec) return "unknown";
  if (rec.usedAt !== null) return "used";
  if (now >= rec.expiresAt) return "expired";
  return null;
}
