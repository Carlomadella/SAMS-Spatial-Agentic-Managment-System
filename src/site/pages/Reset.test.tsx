import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const resetPasswordRemote = vi.fn();
vi.mock("../../lib/backend", () => ({
  resetPasswordRemote: (token: string, password: string) => resetPasswordRemote(token, password),
}));

const navigate = vi.fn();
let search = "";
// `Link` serve al <Logo> dentro la pagina: senza, il render esplode sul contesto del router.
vi.mock("../router", () => ({
  useLocation: () => ({ path: "/reset", search }),
  useNavigate: () => navigate,
  Link: ({ children, ...rest }: { children?: React.ReactNode; to: string }) => <a {...rest}>{children}</a>,
}));

import { Reset } from "./Reset";

/** Compila entrambi i campi password del form. */
function fill(pw: string, confirm = pw) {
  const fields = screen.getAllByPlaceholderText("••••••••") as HTMLInputElement[];
  fireEvent.change(fields[0], { target: { value: pw } });
  fireEvent.change(fields[1], { target: { value: confirm } });
}

describe("<Reset />", () => {
  beforeEach(() => {
    resetPasswordRemote.mockReset();
    navigate.mockReset();
    search = "?token=tok123";
  });

  it("senza token nell'URL non mostra il form: non c'è niente da reimpostare", () => {
    search = "";
    render(<Reset />);
    expect(screen.getByText("Link non valido")).toBeTruthy();
    expect(screen.queryByPlaceholderText("••••••••")).toBeNull();
  });

  it("manda il token della query insieme alla nuova password", async () => {
    resetPasswordRemote.mockResolvedValue({ ok: true });
    render(<Reset />);
    fill("password-nuova");
    fireEvent.click(screen.getByText("Imposta la password"));
    await waitFor(() => expect(resetPasswordRemote).toHaveBeenCalledWith("tok123", "password-nuova"));
  });

  it("conferma il successo e offre l'accesso", async () => {
    resetPasswordRemote.mockResolvedValue({ ok: true });
    render(<Reset />);
    fill("password-nuova");
    fireEvent.click(screen.getByText("Imposta la password"));
    await waitFor(() => expect(screen.getByText("Password aggiornata")).toBeTruthy());

    fireEvent.click(screen.getByText("Accedi"));
    expect(navigate).toHaveBeenCalledWith("/login");
  });

  it("rifiuta una password troppo corta senza chiamare il server", async () => {
    render(<Reset />);
    fill("corta");
    fireEvent.click(screen.getByText("Imposta la password"));
    await waitFor(() => expect(screen.getByText(/almeno 8 caratteri/)).toBeTruthy());
    expect(resetPasswordRemote).not.toHaveBeenCalled();
  });

  it("rifiuta due password diverse senza chiamare il server", async () => {
    render(<Reset />);
    fill("password-una", "password-due");
    fireEvent.click(screen.getByText("Imposta la password"));
    await waitFor(() => expect(screen.getByText(/non coincidono/)).toBeTruthy());
    expect(resetPasswordRemote).not.toHaveBeenCalled();
  });

  it("mostra l'errore del server (link scaduto) e lascia riprovare", async () => {
    resetPasswordRemote.mockResolvedValue({ ok: false, error: "Il link è scaduto: richiedine uno nuovo" });
    render(<Reset />);
    fill("password-nuova");
    fireEvent.click(screen.getByText("Imposta la password"));
    await waitFor(() => expect(screen.getByText(/scaduto/)).toBeTruthy());
    expect(screen.queryByText("Password aggiornata")).toBeNull();
  });

  it("un token con caratteri speciali arriva decodificato al server", async () => {
    search = `?token=${encodeURIComponent("a b+c")}`;
    resetPasswordRemote.mockResolvedValue({ ok: true });
    render(<Reset />);
    fill("password-nuova");
    fireEvent.click(screen.getByText("Imposta la password"));
    await waitFor(() => expect(resetPasswordRemote).toHaveBeenCalledWith("a b+c", "password-nuova"));
  });
});
