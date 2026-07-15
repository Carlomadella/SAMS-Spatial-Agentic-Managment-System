import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const verifyEmailRemote = vi.fn();
vi.mock("../../lib/backend", () => ({
  verifyEmailRemote: (token: string) => verifyEmailRemote(token),
}));

const refresh = vi.fn();
vi.mock("../auth/AuthContext", () => ({ useAuth: () => ({ refresh }) }));

const navigate = vi.fn();
let search = "";
// `Link` serve al <Logo> dentro la pagina: senza, il render esplode sul contesto del router.
vi.mock("../router", () => ({
  useLocation: () => ({ path: "/verifica", search }),
  useNavigate: () => navigate,
  Link: ({ children, ...rest }: { children?: React.ReactNode; to: string }) => <a {...rest}>{children}</a>,
}));

import { Verify } from "./Verify";

describe("<Verify />", () => {
  beforeEach(() => {
    verifyEmailRemote.mockReset();
    refresh.mockReset();
    navigate.mockReset();
    refresh.mockResolvedValue(undefined);
    search = "?token=tok123";
  });

  it("conferma da sola all'apertura del link, senza altri click", async () => {
    verifyEmailRemote.mockResolvedValue({ ok: true });
    render(<Verify />);
    await waitFor(() => expect(verifyEmailRemote).toHaveBeenCalledWith("tok123"));
    expect(await screen.findByText("Indirizzo confermato")).toBeTruthy();
  });

  it("rilegge l'utente dopo la conferma (il badge «da confermare» sparisce)", async () => {
    verifyEmailRemote.mockResolvedValue({ ok: true });
    render(<Verify />);
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("senza token non chiama il server e lo dice", async () => {
    search = "";
    render(<Verify />);
    expect(screen.getByText("Non ha funzionato")).toBeTruthy();
    expect(screen.getByText(/non contiene un codice di verifica/)).toBeTruthy();
    expect(verifyEmailRemote).not.toHaveBeenCalled();
  });

  it("mostra l'errore del server su token scaduto", async () => {
    verifyEmailRemote.mockResolvedValue({ ok: false, error: "Il link di verifica è scaduto: chiedine uno nuovo" });
    render(<Verify />);
    expect(await screen.findByText("Il link di verifica è scaduto: chiedine uno nuovo")).toBeTruthy();
    expect(screen.queryByText("Indirizzo confermato")).toBeNull();
  });

  it("non spende il token due volte se il componente rimonta (StrictMode)", async () => {
    verifyEmailRemote.mockResolvedValue({ ok: true });
    const { unmount } = render(<Verify />);
    await waitFor(() => expect(verifyEmailRemote).toHaveBeenCalledTimes(1));
    unmount();
    // Un secondo render è un nuovo componente e può richiamare: quello che conta è che
    // *lo stesso* mount non chiami due volte, cosa che spenderebbe un token già speso.
    expect(verifyEmailRemote).toHaveBeenCalledTimes(1);
  });

  it("dopo la conferma manda all'accesso", async () => {
    verifyEmailRemote.mockResolvedValue({ ok: true });
    render(<Verify />);
    fireEvent.click(await screen.findByText("Accedi"));
    expect(navigate).toHaveBeenCalledWith("/login");
  });
});
