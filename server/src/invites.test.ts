import { describe, expect, it } from "vitest";
import { INVITE_TTL_MS, inviteRejection, isInvitableRole, registrationRole, type InviteRecord } from "./invites";

const rec = (over: Partial<InviteRecord> = {}): InviteRecord => ({
  id: "i1",
  tokenHash: "h1",
  email: "ada@example.test",
  role: "editor",
  invitedBy: "owner-id",
  createdAt: 1_000,
  expiresAt: 1_000 + INVITE_TTL_MS,
  usedAt: null,
  ...over,
});

describe("isInvitableRole (D3-B)", () => {
  it("si invita come editor o viewer", () => {
    expect(isInvitableRole("editor")).toBe(true);
    expect(isInvitableRole("viewer")).toBe(true);
  });
  it("mai come owner, né con valori inventati", () => {
    expect(isInvitableRole("owner")).toBe(false);
    expect(isInvitableRole("admin")).toBe(false);
    expect(isInvitableRole(undefined)).toBe(false);
  });
});

describe("INVITE_TTL_MS", () => {
  it("un invito dura una settimana", () => {
    expect(INVITE_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe("inviteRejection", () => {
  it("un invito valido per la sua email passa", () => {
    expect(inviteRejection(rec(), "ada@example.test", 2_000)).toBeNull();
  });
  it("sconosciuto, già usato, scaduto", () => {
    expect(inviteRejection(null, "ada@example.test", 2_000)).toBe("unknown");
    expect(inviteRejection(rec({ usedAt: 1_500 }), "ada@example.test", 2_000)).toBe("used");
    expect(inviteRejection(rec(), "ada@example.test", 1_000 + INVITE_TTL_MS)).toBe("expired");
  });
  it("l'invito vale solo per l'indirizzo a cui è stato mandato", () => {
    expect(inviteRejection(rec(), "altro@example.test", 2_000)).toBe("email_mismatch");
  });
});

// Ultrareview 2026-11-11: con l'owner che usa solo SAMS_TOKEN (nessun account), il primo a
// registrarsi con un invito da viewer diventava owner.
describe("registrationRole", () => {
  it("con un invito vale il ruolo dell'invito, anche se è il primo account", () => {
    expect(registrationRole(true, "viewer")).toBe("viewer");
    expect(registrationRole(true, "editor")).toBe("editor");
  });

  it("senza invito il primo account è owner, gli altri viewer", () => {
    expect(registrationRole(true, null)).toBe("owner");
    expect(registrationRole(false, null)).toBe("viewer");
  });

  it("un invito non promuove mai a owner", () => {
    expect(registrationRole(false, "editor")).toBe("editor");
  });
});
