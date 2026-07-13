// Auth reale (Roadmap 4, frontiera #3) — account utente veri al posto del login mock
// del sito. Qui vive il nucleo puro/deterministico: hashing password (scrypt di
// `node:crypto`, nessuna dipendenza nativa), verifica a tempo costante, generazione
// del token di sessione, e la validazione/normalizzazione degli input. Le tabelle
// (users/auth_sessions) stanno in `db.ts`, gli endpoint in `server.ts`.
//
// Trasporto della sessione: un **bearer token** opaco (Authorization: Bearer …), non
// un cookie — così funziona identico in dev (client e server su porte diverse) e in
// prod (stessa origine) senza CORS-credentials, e si innesta sul meccanismo a token
// già esistente per i ruoli (`roles.ts`).

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { Role } from "./roles";

/** Utente come vive nel DB (l'hash non esce mai verso il client → `PublicUser`). */
export interface User {
  id: string;
  email: string;
  name: string;
  passHash: string;
  role: Role;
  createdAt: number;
}

/** Vista pubblica dell'utente (mai include l'hash della password). */
export interface PublicUser {
  email: string;
  name: string;
  role: Role;
}

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 giorni
const SCRYPT_KEYLEN = 64;
const MIN_PASSWORD = 8;

/**
 * Hash della password: `salt:hash` esadecimale. Ogni chiamata usa un salt casuale,
 * quindi due hash della stessa password differiscono (verifica via `verifyPassword`).
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  return `${salt}:${hash}`;
}

/** Verifica a tempo costante che `password` corrisponda a `stored` (`salt:hash`). */
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = (stored ?? "").split(":");
  if (!salt || !hash) return false;
  const known = Buffer.from(hash, "hex");
  const test = scryptSync(password, salt, SCRYPT_KEYLEN);
  return known.length === test.length && timingSafeEqual(known, test);
}

/** Token di sessione opaco e imprevedibile (256 bit). */
export function newSessionToken(): string {
  return randomBytes(32).toString("hex");
}

/** Normalizza un'email: trim + minuscolo (l'unicità è case-insensitive). */
export function normalizeEmail(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

/** Validazione essenziale del formato email (non un parser RFC completo). */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

/** Regola sulle password: lunghezza minima. Ritorna un messaggio se non valida. */
export function validatePassword(password: unknown): { ok: boolean; error?: string } {
  if (typeof password !== "string" || password.length < MIN_PASSWORD) {
    return { ok: false, error: `La password deve avere almeno ${MIN_PASSWORD} caratteri` };
  }
  if (password.length > 200) return { ok: false, error: "Password troppo lunga" };
  return { ok: true };
}

/** Nome visualizzato: via i caratteri di controllo, spazi compressi, cap 40. Fallback dall'email. */
export function sanitizeName(raw: unknown, email = ""): string {
  const stripped = (typeof raw === "string" ? raw : "")
    .split("")
    .filter((ch) => ch.charCodeAt(0) >= 32)
    .join("");
  const cleaned = stripped.replace(/\s+/g, " ").trim().slice(0, 40);
  if (cleaned) return cleaned;
  const local = email.split("@")[0] || "utente";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

/** Proietta un `User` nella sua vista pubblica (senza hash). */
export function publicUser(u: Pick<User, "email" | "name" | "role">): PublicUser {
  return { email: u.email, name: u.name, role: u.role };
}
