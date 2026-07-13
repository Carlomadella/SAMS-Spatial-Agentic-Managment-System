import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthContext";

// Risposta fetch finta minima.
function jsonRes(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function Consumer() {
  const { user, loading, login, register, logout } = useAuth();
  return (
    <div>
      <span data-testid="state">{loading ? "loading" : user ? `${user.name}:${user.role}` : "anon"}</span>
      <button onClick={() => void login("carlo@x.com", "supersegreta1")}>login</button>
      <button onClick={() => void register("bea@x.com", "supersegreta1", "Bea")}>register</button>
      <button onClick={() => void logout()}>logout</button>
    </div>
  );
}

describe("<AuthProvider /> (auth reale)", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parte anonimo quando non c'è token e non chiama /me", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<AuthProvider><Consumer /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("anon"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("login: salva il token e imposta l'utente", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonRes(200, { token: "abc123", user: { name: "Carlo", email: "carlo@x.com", role: "owner" } })),
    );
    render(<AuthProvider><Consumer /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("anon"));
    fireEvent.click(screen.getByText("login"));
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("Carlo:owner"));
    expect(localStorage.getItem("sams.site.token")).toBe("abc123");
  });

  it("login fallito: mostra anon e non salva token", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonRes(401, { error: "Email o password non corretti" })));
    render(<AuthProvider><Consumer /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("anon"));
    fireEvent.click(screen.getByText("login"));
    // resta anonimo
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("anon"));
    expect(localStorage.getItem("sams.site.token")).toBeNull();
  });

  it("logout: pulisce token e utente", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("/logout")
          ? jsonRes(204, {})
          : jsonRes(200, { token: "abc123", user: { name: "Carlo", email: "carlo@x.com", role: "owner" } }),
      ),
    );
    render(<AuthProvider><Consumer /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("anon"));
    fireEvent.click(screen.getByText("login"));
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("Carlo:owner"));
    fireEvent.click(screen.getByText("logout"));
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("anon"));
    expect(localStorage.getItem("sams.site.token")).toBeNull();
  });

  it("ripristina la sessione dal token via /me all'avvio", async () => {
    localStorage.setItem("sams.site.token", "tok");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonRes(200, { user: { name: "Bea", email: "bea@x.com", role: "viewer" } })),
    );
    render(<AuthProvider><Consumer /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("Bea:viewer"));
  });

  it("token invalido all'avvio: /me 401 → anon e token rimosso", async () => {
    localStorage.setItem("sams.site.token", "stale");
    vi.stubGlobal("fetch", vi.fn(async () => jsonRes(401, { error: "Non autenticato" })));
    render(<AuthProvider><Consumer /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("anon"));
    expect(localStorage.getItem("sams.site.token")).toBeNull();
  });
});
