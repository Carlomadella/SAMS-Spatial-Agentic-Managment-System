// Inviti via email — decisione D3-B della 1.0.
//
// Senza inviti chi entra in un team si registra, nasce *viewer* e aspetta che l'owner lo
// promuova a mano. Con un invito l'owner sceglie email e ruolo, e la persona entra già col
// ruolo giusto. Il token segue le regole di `tokens.ts`: 256 bit casuali, a riposo solo
// l'hash sha256, monouso arbitrato dal DB.
//
// Due limiti voluti:
//  - **mai come owner**: un link può essere inoltrato o finire nel posto sbagliato, e non
//    deve regalare il massimo dei permessi. Chi deve diventare owner entra e viene promosso.
//  - **legato all'indirizzo**: l'invito vale solo per l'email a cui è stato mandato, così
//    chi lo intercetta non può usarlo per un account suo.

import type { Role } from "./roles";

/** Durata di un invito: abbastanza per chi legge la posta una volta a settimana. */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type InvitableRole = Exclude<Role, "owner">;

/** Riga di un invito come vive nel DB. */
export interface InviteRecord {
  id: string;
  tokenHash: string;
  email: string;
  role: InvitableRole;
  invitedBy: string;
  createdAt: number;
  expiresAt: number;
  usedAt: number | null;
}

/** Invito in attesa come lo vede l'owner (niente hash). */
export interface PendingInvite {
  id: string;
  email: string;
  role: InvitableRole;
  createdAt: number;
  expiresAt: number;
}

export function isInvitableRole(role: unknown): role is InvitableRole {
  return role === "editor" || role === "viewer";
}

/** Perché un invito non vale per questa registrazione (null = vale). Scadenza esclusiva. */
export function inviteRejection(
  rec: InviteRecord | null | undefined,
  email: string,
  now = Date.now(),
): "unknown" | "used" | "expired" | "email_mismatch" | null {
  if (!rec) return "unknown";
  if (rec.usedAt !== null) return "used";
  if (now >= rec.expiresAt) return "expired";
  if (rec.email !== email) return "email_mismatch";
  return null;
}
