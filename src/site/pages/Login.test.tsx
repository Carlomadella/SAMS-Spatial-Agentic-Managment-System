import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const forgotPasswordRemote = vi.fn();
vi.mock("../../lib/backend", () => ({
  forgotPasswordRemote: (email: string) => forgotPasswordRemote(email),
}));

const login = vi.fn();
const register = vi.fn();
vi.mock("../auth/AuthContext", () => ({ useAuth: () => ({ login, register }) }));

const navigate = vi.fn();
vi.mock("../router", () => ({
  useNavigate: () => navigate,
  Link: ({ children, ...rest }: { children?: React.ReactNode; to: string }) => <a {...rest}>{children}</a>,
}));

import { Login } from "./Login";

const typeEmail = (v: string) => fireEvent.change(screen.getByPlaceholderText("tu@esempio.com"), { target: { value: v } });
const typePassword = (v: string) => fireEvent.change(screen.getByPlaceholderText("••••••••"), { target: { value: v } });

describe("<Login />", () => {
  beforeEach(() => {
    forgotPasswordRemote.mockReset();
    login.mockReset();
    register.mockReset();
    navigate.mockReset();
  });

  it("accesso riuscito → si entra nella stanza", async () => {
    login.mockResolvedValue({ ok: true });
    render(<Login />);
    typeEmail("a@b.co");
    typePassword("password1");
    fireEvent.click(screen.getByText("Accedi"));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/app"));
  });

  // --- gestione password (2026-07-15) --------------------------------------

  it("«Password dimenticata?» chiede solo l'email, non la password", () => {
    render(<Login />);
    fireEvent.click(screen.getByText("Password dimenticata?"));
    expect(screen.getByText("Mandami il link")).toBeTruthy();
    expect(screen.queryByPlaceholderText("••••••••")).toBeNull();
  });

  it("il reset conferma con una frase che non rivela se l'account esiste", async () => {
    forgotPasswordRemote.mockResolvedValue({ ok: true });
    render(<Login />);
    fireEvent.click(screen.getByText("Password dimenticata?"));
    typeEmail("chissa@b.co");
    fireEvent.click(screen.getByText("Mandami il link"));

    await waitFor(() => expect(forgotPasswordRemote).toHaveBeenCalledWith("chissa@b.co"));
    expect(await screen.findByText(/Se esiste un account con questa email/)).toBeTruthy();
  });

  // "a@b" e non "non-una-email": il campo è `type="email"`, quindi su una stringa senza @
  // è il **browser** a bloccare il submit e il nostro handler non gira nemmeno. "a@b" passa
  // la validazione HTML (che non pretende un dominio) ma non la nostra → esercita il codice.
  it("un'email senza dominio non arriva al server", async () => {
    render(<Login />);
    fireEvent.click(screen.getByText("Password dimenticata?"));
    typeEmail("a@b");
    fireEvent.click(screen.getByText("Mandami il link"));
    await waitFor(() => expect(screen.getByText("Inserisci un'email valida.")).toBeTruthy());
    expect(forgotPasswordRemote).not.toHaveBeenCalled();
  });

  it("si torna all'accesso dal reset", () => {
    render(<Login />);
    fireEvent.click(screen.getByText("Password dimenticata?"));
    fireEvent.click(screen.getByText("Torna all'accesso"));
    expect(screen.getByText("Bentornato")).toBeTruthy();
  });

  it("registrazione con canale email attivo: si resta fuori e si aspetta la conferma", async () => {
    register.mockResolvedValue({ ok: true, needsVerification: true });
    render(<Login />);
    fireEvent.click(screen.getByText("Registrati")); // passa a signup
    typeEmail("nuovo@b.co");
    typePassword("password1");
    fireEvent.click(screen.getByRole("button", { name: /Registrati/ }));

    expect(await screen.findByText(/link per confermare il tuo indirizzo/)).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled(); // niente sessione → niente stanza
  });

  it("login rifiutato perché l'email non è confermata: mostra il motivo", async () => {
    login.mockResolvedValue({
      ok: false,
      error: "Conferma il tuo indirizzo email per entrare",
      needsVerification: true,
    });
    render(<Login />);
    typeEmail("a@b.co");
    typePassword("password1");
    fireEvent.click(screen.getByText("Accedi"));
    expect(await screen.findByText("Conferma il tuo indirizzo email per entrare")).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
  });
});
