import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const deleteAccountRemote = vi.fn();
vi.mock("../../lib/backend", () => ({ deleteAccountRemote: (p: string) => deleteAccountRemote(p) }));
const logout = vi.fn(async () => {});
vi.mock("../auth/AuthContext", () => ({ useAuth: () => ({ logout }) }));
const navigate = vi.fn();
vi.mock("../router", () => ({
  useNavigate: () => navigate,
  Link: ({ children, to }: { children?: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

import { DeleteAccount } from "./DeleteAccount";

const open = () => fireEvent.click(screen.getByRole("button", { name: "Elimina account" }));
const confirmButton = () => screen.getByRole("button", { name: "Elimina definitivamente" }) as HTMLButtonElement;

// Pagina Privacy (20/11/2026): l'utente elimina da solo il proprio account (GDPR).
describe("<DeleteAccount />", () => {
  beforeEach(() => {
    deleteAccountRemote.mockReset();
    logout.mockClear();
    navigate.mockReset();
  });

  it("non elimina finché mancano password e conferma esplicita", () => {
    render(<DeleteAccount />);
    open();
    expect(confirmButton().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Password attuale"), { target: { value: "segreta123" } });
    expect(confirmButton().disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(confirmButton().disabled).toBe(false);
  });

  it("a buon fine chiude la sessione e torna alla home", async () => {
    deleteAccountRemote.mockResolvedValue({ ok: true });
    render(<DeleteAccount />);
    open();
    fireEvent.change(screen.getByLabelText("Password attuale"), { target: { value: "segreta123" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(confirmButton());
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/"));
    expect(deleteAccountRemote).toHaveBeenCalledWith("segreta123");
    expect(logout).toHaveBeenCalled();
  });

  it("mostra l'errore del server (es. unico owner) e non esce", async () => {
    deleteAccountRemote.mockResolvedValue({ ok: false, error: "Sei l'unico owner: prima nomina owner un'altra persona." });
    render(<DeleteAccount />);
    open();
    fireEvent.change(screen.getByLabelText("Password attuale"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(confirmButton());
    expect((await screen.findByRole("alert")).textContent).toMatch(/unico owner/);
    expect(logout).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});
