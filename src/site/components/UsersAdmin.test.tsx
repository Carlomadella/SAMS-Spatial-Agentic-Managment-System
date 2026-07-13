import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const fetchUsers = vi.fn();
const setUserRoleRemote = vi.fn();
vi.mock("../../lib/backend", () => ({
  fetchUsers: () => fetchUsers(),
  setUserRoleRemote: (email: string, role: string) => setUserRoleRemote(email, role),
}));

import { UsersAdmin } from "./UsersAdmin";

describe("<UsersAdmin />", () => {
  beforeEach(() => {
    fetchUsers.mockReset();
    setUserRoleRemote.mockReset();
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
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "viewer" } });
    await waitFor(() => expect(screen.getByText(/ultimo owner/)).toBeTruthy());
  });
});
