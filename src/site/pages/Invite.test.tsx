import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const lookupInviteRemote = vi.fn();
vi.mock("../../lib/backend", () => ({
  lookupInviteRemote: (token: string) => lookupInviteRemote(token),
}));

const register = vi.fn();
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ register }),
}));

const navigate = vi.fn();
let search = "";
// `Link` serve al <Logo> dentro la pagina: senza, il render esplode sul contesto del router.
vi.mock("../router", () => ({
  useLocation: () => ({ path: "/invito", search }),
  useNavigate: () => navigate,
  Link: ({ children, ...rest }: { children?: React.ReactNode; to: string }) => <a {...rest}>{children}</a>,
}));

import { Invite } from "./Invite";

function fill(name: string, pw: string, confirm = pw) {
  fireEvent.change(screen.getByLabelText("Nome"), { target: { value: name } });
  const fields = screen.getAllByPlaceholderText("••••••••") as HTMLInputElement[];
  fireEvent.change(fields[0], { target: { value: pw } });
  fireEvent.change(fields[1], { target: { value: confirm } });
}

async function opened(email = "ada@example.test", role: "editor" | "viewer" = "viewer") {
  lookupInviteRemote.mockResolvedValue({ ok: true, email, role });
  render(<Invite />);
  await waitFor(() => expect(screen.getByDisplayValue(email)).toBeTruthy());
}

describe("<Invite /> (D3-B)", () => {
  beforeEach(() => {
    lookupInviteRemote.mockReset();
    register.mockReset();
    navigate.mockReset();
    search = "?token=inv123";
  });

  it("senza token nell'URL dice che il link non è valido", () => {
    search = "";
    render(<Invite />);
    expect(screen.getByText("Link non valido")).toBeTruthy();
    expect(lookupInviteRemote).not.toHaveBeenCalled();
  });

  it("mostra per chi è l'invito e con che ruolo, con l'email non modificabile", async () => {
    await opened("ada@example.test", "editor");
    expect(lookupInviteRemote).toHaveBeenCalledWith("inv123");
    expect((screen.getByDisplayValue("ada@example.test") as HTMLInputElement).readOnly).toBe(true);
    expect(screen.getByText(/Editor/)).toBeTruthy();
  });

  it("un invito scaduto o usato mostra l'errore del server e niente form", async () => {
    lookupInviteRemote.mockResolvedValue({ ok: false, error: "L'invito è scaduto: chiedine uno nuovo a chi ti ha invitato" });
    render(<Invite />);
    await waitFor(() => expect(screen.getByText(/scaduto/)).toBeTruthy());
    expect(screen.queryByPlaceholderText("••••••••")).toBeNull();
  });

  it("registra con l'email dell'invito e il token, poi apre la stanza", async () => {
    register.mockResolvedValue({ ok: true });
    await opened();
    fill("Ada", "password-lunga");
    fireEvent.click(screen.getByText("Crea l'account"));
    await waitFor(() => expect(register).toHaveBeenCalledWith("ada@example.test", "password-lunga", "Ada", "inv123"));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/app"));
  });

  it("controlla le password prima di chiamare il server", async () => {
    await opened();
    fill("Ada", "corta");
    fireEvent.click(screen.getByText("Crea l'account"));
    await waitFor(() => expect(screen.getByText(/almeno 8 caratteri/)).toBeTruthy());
    fill("Ada", "password-una", "password-due");
    fireEvent.click(screen.getByText("Crea l'account"));
    await waitFor(() => expect(screen.getByText(/non coincidono/)).toBeTruthy());
    expect(register).not.toHaveBeenCalled();
  });

  it("mostra l'errore della registrazione e lascia riprovare", async () => {
    register.mockResolvedValue({ ok: false, error: "L'invito è già stato usato" });
    await opened();
    fill("Ada", "password-lunga");
    fireEvent.click(screen.getByText("Crea l'account"));
    await waitFor(() => expect(screen.getByText("L'invito è già stato usato")).toBeTruthy());
    expect(navigate).not.toHaveBeenCalled();
  });
});
