import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const fetchUsers = vi.fn();
const setUserRoleRemote = vi.fn();
const issueUserResetLink = vi.fn();
const fetchInvites = vi.fn();
const createInviteRemote = vi.fn();
const revokeInviteRemote = vi.fn();
vi.mock("../../lib/backend", () => ({
  fetchUsers: () => fetchUsers(),
  fetchInvites: () => fetchInvites(),
  createInviteRemote: (email: string, role: string) => createInviteRemote(email, role),
  revokeInviteRemote: (id: string) => revokeInviteRemote(id),
  setUserRoleRemote: (email: string, role: string) => setUserRoleRemote(email, role),
  issueUserResetLink: (email: string) => issueUserResetLink(email),
}));

import { UsersAdmin } from "./UsersAdmin";

describe("<UsersAdmin />", () => {
  beforeEach(() => {
    fetchUsers.mockReset();
    setUserRoleRemote.mockReset();
    issueUserResetLink.mockReset();
    fetchInvites.mockReset();
    fetchInvites.mockResolvedValue([]);
    createInviteRemote.mockReset();
    revokeInviteRemote.mockReset();
  });

  it("non mostra nulla se non ci sono utenti (es. non owner → lista vuota)", async () => {
    fetchUsers.mockResolvedValue([]);
    const { container } = render(<UsersAdmin selfEmail="me@x.co" />);
    await waitFor(() => expect(fetchUsers).toHaveBeenCalled());
    expect(container.firstChild).toBeNull();
  });

  it("elenca gli utenti, disabilita il proprio selettore e cambia un ruolo", async () => {
    fetchUsers.mockResolvedValue([
      { email: "me@x.co", name: "Me", role: "owner", createdAt: 1 },
      { email: "bea@x.co", name: "Bea", role: "viewer", createdAt: 2 },
    ]);
    setUserRoleRemote.mockResolvedValue({ ok: true });
    render(<UsersAdmin selfEmail="me@x.co" />);
    await waitFor(() => expect(screen.getByText("Bea")).toBeTruthy());

    const selects = screen.getAllByRole("combobox") as HTMLSelectElement[];
    expect(selects[0].disabled).toBe(true); // il proprio account
    expect(selects[1].value).toBe("viewer");

    fireEvent.change(selects[1], { target: { value: "editor" } });
    await waitFor(() => expect(setUserRoleRemote).toHaveBeenCalledWith("bea@x.co", "editor"));
    await waitFor(() => expect((screen.getAllByRole("combobox")[1] as HTMLSelectElement).value).toBe("editor"));
  });

  it("mostra l'errore e non aggiorna se il server rifiuta", async () => {
    fetchUsers.mockResolvedValue([{ email: "bea@x.co", name: "Bea", role: "owner", createdAt: 1 }]);
    setUserRoleRemote.mockResolvedValue({ ok: false, error: "Non puoi declassare l'ultimo owner" });
    render(<UsersAdmin selfEmail="me@x.co" />);
    await waitFor(() => expect(screen.getByText("Bea")).toBeTruthy());
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "viewer" } });
    await waitFor(() => expect(screen.getByText(/ultimo owner/)).toBeTruthy());
  });

  // --- reset owner-issued (gestione password, 2026-07-15) -------------------

  it("segnala gli indirizzi non ancora confermati", async () => {
    fetchUsers.mockResolvedValue([
      { email: "ok@x.co", name: "Ok", role: "viewer", createdAt: 1, emailVerified: true },
      { email: "pending@x.co", name: "Pending", role: "viewer", createdAt: 2, emailVerified: false },
    ]);
    render(<UsersAdmin selfEmail="me@x.co" />);
    await waitFor(() => expect(screen.getByText("Pending")).toBeTruthy());
    expect(screen.getAllByText(/da confermare/)).toHaveLength(1);
  });

  it("un server che non manda emailVerified non fa comparire l'avviso", async () => {
    fetchUsers.mockResolvedValue([{ email: "bea@x.co", name: "Bea", role: "viewer", createdAt: 1 }]);
    render(<UsersAdmin selfEmail="me@x.co" />);
    await waitFor(() => expect(screen.getByText("Bea")).toBeTruthy());
    expect(screen.queryByText(/da confermare/)).toBeNull();
  });

  it("l'owner genera un link di reset e lo vede, pronto da consegnare", async () => {
    fetchUsers.mockResolvedValue([{ email: "bea@x.co", name: "Bea", role: "viewer", createdAt: 1 }]);
    issueUserResetLink.mockResolvedValue({ ok: true, link: "http://localhost:5180/reset?token=abc123" });
    render(<UsersAdmin selfEmail="me@x.co" />);
    await waitFor(() => expect(screen.getByText("Bea")).toBeTruthy());

    fireEvent.click(screen.getByLabelText(/Genera un link di reset per bea@x.co/));
    await waitFor(() => expect(issueUserResetLink).toHaveBeenCalledWith("bea@x.co"));
    const field = (await screen.findByLabelText("Link di reset")) as HTMLInputElement;
    expect(field.value).toBe("http://localhost:5180/reset?token=abc123");
    expect(field.readOnly).toBe(true);
  });

  it("mostra l'errore se l'emissione del link fallisce, senza mostrare campi vuoti", async () => {
    fetchUsers.mockResolvedValue([{ email: "bea@x.co", name: "Bea", role: "viewer", createdAt: 1 }]);
    issueUserResetLink.mockResolvedValue({ ok: false, error: "Utente non trovato" });
    render(<UsersAdmin selfEmail="me@x.co" />);
    await waitFor(() => expect(screen.getByText("Bea")).toBeTruthy());

    fireEvent.click(screen.getByLabelText(/Genera un link di reset/));
    await waitFor(() => expect(screen.getByText("Utente non trovato")).toBeTruthy());
    expect(screen.queryByLabelText("Link di reset")).toBeNull();
  });

  it("il link si chiude quando l'owner ha finito", async () => {
    fetchUsers.mockResolvedValue([{ email: "bea@x.co", name: "Bea", role: "viewer", createdAt: 1 }]);
    issueUserResetLink.mockResolvedValue({ ok: true, link: "http://x/reset?token=t" });
    render(<UsersAdmin selfEmail="me@x.co" />);
    await waitFor(() => expect(screen.getByText("Bea")).toBeTruthy());

    fireEvent.click(screen.getByLabelText(/Genera un link di reset/));
    await screen.findByLabelText("Link di reset");
    fireEvent.click(screen.getByText("Chiudi"));
    await waitFor(() => expect(screen.queryByLabelText("Link di reset")).toBeNull());
  });

  // --- inviti (D3-B) ------------------------------------------------------------

  const owner = [{ email: "me@x.co", name: "Me", role: "owner", createdAt: 1 }];

  it("l'owner invita un'email con un ruolo e vede il link (canale email assente)", async () => {
    fetchUsers.mockResolvedValue(owner);
    createInviteRemote.mockResolvedValue({
      ok: true,
      emailed: false,
      link: "http://x/invito?token=inv",
      invite: { id: "i1", email: "ada@x.co", role: "editor", createdAt: 1, expiresAt: 2 },
    });
    render(<UsersAdmin selfEmail="me@x.co" />);
    await waitFor(() => expect(screen.getByText("Me")).toBeTruthy());

    fireEvent.change(screen.getByLabelText("Email da invitare"), { target: { value: "ada@x.co" } });
    fireEvent.change(screen.getByLabelText("Ruolo dell'invito"), { target: { value: "editor" } });
    fireEvent.click(screen.getByText("Invita"));
    await waitFor(() => expect(createInviteRemote).toHaveBeenCalledWith("ada@x.co", "editor"));

    const field = (await screen.findByLabelText("Link d'invito")) as HTMLInputElement;
    expect(field.value).toBe("http://x/invito?token=inv");
    expect(screen.getByText(/consegnalo tu/i)).toBeTruthy();
    // l'invito compare tra quelli in attesa
    expect(screen.getByLabelText("Revoca l'invito per ada@x.co")).toBeTruthy();
  });

  it("con il canale email dice che l'invito è partito", async () => {
    fetchUsers.mockResolvedValue(owner);
    createInviteRemote.mockResolvedValue({
      ok: true,
      emailed: true,
      link: "http://x/invito?token=inv",
      invite: { id: "i1", email: "ada@x.co", role: "viewer", createdAt: 1, expiresAt: 2 },
    });
    render(<UsersAdmin selfEmail="me@x.co" />);
    await waitFor(() => expect(screen.getByText("Me")).toBeTruthy());
    fireEvent.change(screen.getByLabelText("Email da invitare"), { target: { value: "ada@x.co" } });
    fireEvent.click(screen.getByText("Invita"));
    await waitFor(() => expect(screen.getByText(/email inviata/i)).toBeTruthy());
    expect(createInviteRemote).toHaveBeenCalledWith("ada@x.co", "viewer");
  });

  it("mostra l'errore del server e non aggiunge niente", async () => {
    fetchUsers.mockResolvedValue(owner);
    createInviteRemote.mockResolvedValue({ ok: false, error: "Esiste già un account con questa email" });
    render(<UsersAdmin selfEmail="me@x.co" />);
    await waitFor(() => expect(screen.getByText("Me")).toBeTruthy());
    fireEvent.change(screen.getByLabelText("Email da invitare"), { target: { value: "me@x.co" } });
    fireEvent.click(screen.getByText("Invita"));
    await waitFor(() => expect(screen.getByText(/Esiste già un account/)).toBeTruthy());
    expect(screen.queryByLabelText("Link d'invito")).toBeNull();
  });

  it("elenca gli inviti in attesa e li revoca", async () => {
    fetchUsers.mockResolvedValue(owner);
    fetchInvites.mockResolvedValue([{ id: "i9", email: "zoe@x.co", role: "viewer", createdAt: 1, expiresAt: 2 }]);
    revokeInviteRemote.mockResolvedValue({ ok: true });
    render(<UsersAdmin selfEmail="me@x.co" />);
    await waitFor(() => expect(screen.getByText("zoe@x.co")).toBeTruthy());
    fireEvent.click(screen.getByLabelText("Revoca l'invito per zoe@x.co"));
    await waitFor(() => expect(revokeInviteRemote).toHaveBeenCalledWith("i9"));
    await waitFor(() => expect(screen.queryByText("zoe@x.co")).toBeNull());
  });
});
