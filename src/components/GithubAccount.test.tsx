import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { GithubAccount } from "./GithubAccount";
import { githubReturnOutcome } from "./SettingsModal";

function json(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

const off = { enabled: true, signedIn: true, connected: false, login: "", repo: "", baseBranch: "" };
const repos = [
  { fullName: "mario/app", private: false, defaultBranch: "main", canPush: true },
  { fullName: "mario/privata", private: true, defaultBranch: "dev", canPush: true },
  { fullName: "altri/sola-lettura", private: false, defaultBranch: "main", canPush: false },
];

/** fetch finto che risponde per percorso. */
function route(map: Record<string, (init?: RequestInit) => Promise<Response>>) {
  const fn = vi.fn((url: string, init?: RequestInit) => {
    const path = new URL(url, "http://x").pathname;
    const h = map[path];
    return h ? h(init) : json({ error: "?" }, 404);
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("<GithubAccount />", () => {
  it("non appare se il server non ha la OAuth App", async () => {
    const f = route({ "/api/github/me": () => json({ ...off, enabled: false }) });
    const { container } = render(<GithubAccount />);
    await waitFor(() => expect(f).toHaveBeenCalled());
    expect(container.textContent).toBe("");
  });

  it("senza accesso a SAMS chiede di accedere", async () => {
    route({ "/api/github/me": () => json({ ...off, signedIn: false }) });
    render(<GithubAccount />);
    expect(await screen.findByText(/Accedi al tuo account SAMS/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Collega GitHub/ })).toBeNull();
  });

  it("«Collega GitHub» porta alla pagina di autorizzazione di GitHub", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    route({
      "/api/github/me": () => json(off),
      "/api/github/connect": () => json({ url: "https://github.com/login/oauth/authorize?client_id=x" }),
    });
    render(<GithubAccount />);
    fireEvent.click(await screen.findByRole("button", { name: /Collega GitHub/ }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://github.com/login/oauth/authorize?client_id=x"));
  });

  it("collegato: elenca le repo, blocca quelle in sola lettura e salva la scelta", async () => {
    let saved: unknown = null;
    route({
      "/api/github/me": () => json({ ...off, connected: true, login: "mario" }),
      "/api/github/repos": () => json({ repos }),
      "/api/github/repo": (init) => {
        saved = JSON.parse(String(init?.body));
        return json({ ok: true, repo: "mario/privata", baseBranch: "dev" });
      },
    });
    const changed = vi.fn();
    window.addEventListener("sams:github-changed", changed);
    render(<GithubAccount />);
    expect(await screen.findByText("@mario")).toBeTruthy();
    const select = (await screen.findByLabelText(/Repository di lavoro/)) as HTMLSelectElement;
    const ro = [...select.options].find((o) => o.value === "altri/sola-lettura")!;
    expect(ro.disabled).toBe(true);
    expect(screen.getByText(/Scegli una repo/)).toBeTruthy();

    fireEvent.change(select, { target: { value: "mario/privata" } });
    expect((screen.getByLabelText(/Branch base/) as HTMLInputElement).value).toBe("dev");
    fireEvent.click(screen.getByRole("button", { name: /Usa questa repo/ }));
    expect(await screen.findByText(/lavoreranno su mario\/privata/)).toBeTruthy();
    expect(saved).toEqual({ repo: "mario/privata", baseBranch: "dev" });
    expect(changed).toHaveBeenCalled();
    window.removeEventListener("sams:github-changed", changed);
  });

  it("mostra l'errore del server se la repo non è utilizzabile", async () => {
    route({
      "/api/github/me": () => json({ ...off, connected: true, login: "mario" }),
      "/api/github/repos": () => json({ repos }),
      "/api/github/repo": () => json({ error: "Non hai i permessi di scrittura su mario/app" }, 403),
    });
    render(<GithubAccount />);
    const select = (await screen.findByLabelText(/Repository di lavoro/)) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "mario/app" } });
    fireEvent.click(screen.getByRole("button", { name: /Usa questa repo/ }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/permessi di scrittura/);
  });

  it("scollega", async () => {
    const f = route({
      "/api/github/me": () => json({ ...off, connected: true, login: "mario", repo: "mario/app", baseBranch: "main" }),
      "/api/github/repos": () => json({ repos }),
      "/api/github/disconnect": () => json({ ok: true }),
    });
    render(<GithubAccount />);
    fireEvent.click(await screen.findByRole("button", { name: /Scollega/ }));
    expect(await screen.findByRole("button", { name: /Collega GitHub/ })).toBeTruthy();
    expect(f.mock.calls.some(([u]) => String(u).endsWith("/api/github/disconnect"))).toBe(true);
  });
});

describe("githubReturnOutcome", () => {
  it("legge l'esito del ritorno da GitHub", () => {
    expect(githubReturnOutcome("?github=connected")).toBe("connected");
    expect(githubReturnOutcome("?github=denied")).toBe("denied");
    expect(githubReturnOutcome("?github=error")).toBe("error");
    expect(githubReturnOutcome("?github=altro")).toBeNull();
    expect(githubReturnOutcome("")).toBeNull();
  });
});
