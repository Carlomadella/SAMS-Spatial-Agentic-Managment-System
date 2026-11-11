import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connectBackend, fetchWhoami } from "./backend";
import { useStore } from "../store/useStore";

// Ultrareview 2026-11-11: senza login (o dopo un logout) il biglietto dello stream veniva
// negato e whoami non partiva mai: la UI restava col ruolo di partenza, owner, e mostrava
// controlli che poi fallivano con 401.
describe("accesso negato → niente controlli da owner", () => {
  beforeEach(() => {
    useStore.getState().setViewer("owner", false);
    useStore.getState().setAccountName("Ada");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    useStore.getState().setViewer("owner", false);
    useStore.getState().setAccountName("");
    useStore.getState().setStreamAuthRequired(false);
  });

  it("fetchWhoami: un 401 è un viewer con i ruoli attivi, non un owner", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));
    expect(await fetchWhoami()).toMatchObject({ role: "viewer", enforced: true });
  });

  it("fetchWhoami: runtime irraggiungibile resta dev aperto (owner)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    expect(await fetchWhoami()).toMatchObject({ role: "owner", enforced: false });
  });

  it("biglietto dello stream negato → ruolo viewer e nome dell'account dimenticato", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));
    const stop = connectBackend();
    await vi.waitFor(() => expect(useStore.getState().streamAuthRequired).toBe(true));
    stop();
    expect(useStore.getState().viewerRole).toBe("viewer");
    expect(useStore.getState().roleEnforced).toBe(true);
    expect(useStore.getState().accountName).toBe("");
  });
});
