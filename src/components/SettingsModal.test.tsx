import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SettingsModal } from "./SettingsModal";
import { useStore } from "../store/useStore";

const baseStatus = {
  provider: "openrouter",
  hasGeminiKey: false,
  hasAnthropicKey: false,
  hasGroqKey: false,
  hasOpenrouterKey: true,
  hasOpenaiKey: false,
  hasGithubToken: true,
  provisioned: true,
  ready: true,
  repo: "me/repo",
  baseBranch: "main",
  model: "nvidia/nemotron-3-ultra-550b-a55b:free",
  openPRs: true,
  requireApproval: false,
  hasNotionToken: false,
  notionPageId: "",
  notionReady: false,
};

function json(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

describe("<SettingsModal /> — campi gestiti dall'ambiente", () => {
  beforeEach(() => {
    useStore.setState({ settingsOpen: true, backendOnline: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useStore.setState({ settingsOpen: false });
  });

  it("i campi impostati sul server sono in sola lettura e marcati «dal server»", async () => {
    vi.stubGlobal("fetch", vi.fn(() => json({ ...baseStatus, envManaged: ["githubToken", "openrouterApiKey", "provider"] })));
    render(<SettingsModal />);

    const gh = await screen.findByLabelText(/GitHub token/);
    await waitFor(() => expect((gh as HTMLInputElement).disabled).toBe(true));
    expect((screen.getByLabelText(/OpenRouter API key/) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText(/Motore/) as HTMLSelectElement).disabled).toBe(true);
    expect(screen.getAllByText("dal server")).toHaveLength(3);
    // quelli non gestiti dall'ambiente restano modificabili
    expect((screen.getByLabelText(/Repository/) as HTMLInputElement).disabled).toBe(false);
    expect((screen.getByLabelText(/Modello/) as HTMLSelectElement).disabled).toBe(false);
  });

  it("senza variabili d'ambiente nessun campo è bloccato", async () => {
    vi.stubGlobal("fetch", vi.fn(() => json(baseStatus)));
    render(<SettingsModal />);
    const gh = await screen.findByLabelText(/GitHub token/);
    await waitFor(() => expect(screen.getByLabelText(/Repository/)).toHaveProperty("value", "me/repo"));
    expect((gh as HTMLInputElement).disabled).toBe(false);
    expect(screen.queryByText("dal server")).toBeNull();
  });

  it("se il server rifiuta (409) mostra il suo messaggio, non il JSON grezzo", async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) =>
      init?.method === "POST"
        ? json({ error: "Questi campi sono impostati da variabili d'ambiente sul server", envManaged: ["model"] }, 409)
        : json(baseStatus),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<SettingsModal />);
    await waitFor(() => expect(screen.getByLabelText(/Repository/)).toHaveProperty("value", "me/repo"));
    fireEvent.click(screen.getByRole("button", { name: /Salva/ }));
    expect(await screen.findByText("Questi campi sono impostati da variabili d'ambiente sul server")).toBeTruthy();
    expect(screen.queryByText(/envManaged/)).toBeNull();
  });

  it("disco effimero: avviso, chiavi in sola lettura, scelte salvabili e niente chiavi nella richiesta", async () => {
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
      json({ ...baseStatus, hasGithubToken: false, envManaged: [], ephemeralDisk: true }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<SettingsModal />);
    expect(await screen.findByRole("note")).toBeTruthy();
    const gh = screen.getByLabelText(/GitHub token/) as HTMLInputElement;
    await waitFor(() => expect(gh.disabled).toBe(true));
    expect(gh.placeholder).toContain("GITHUB_TOKEN");
    expect((screen.getByLabelText(/OpenRouter API key/) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText(/Repository/) as HTMLInputElement).disabled).toBe(false);
    expect((screen.getByLabelText(/Modello/) as HTMLSelectElement).disabled).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: /Salva/ }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([, i]) => i?.method === "POST")).toBe(true));
    const post = fetchMock.mock.calls.find(([, i]) => i?.method === "POST")!;
    const body = JSON.parse(String(post[1]!.body)) as Record<string, unknown>;
    expect(body).toHaveProperty("githubRepo", "me/repo");
    expect(Object.keys(body).filter((k) => /Key$|Token$/.test(k))).toEqual([]);
  });
});
