import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { claimDriver } from "./backend";
import { useStore } from "../store/useStore";

// Collaudo 2026-11-10: un viewer prendeva la guida del mondo condiviso, ma non può
// salvarlo. Ora la guida è da editor, e il client non ci prova nemmeno se non basta.
describe("claimDriver", () => {
  const f = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ holderId: "v1", name: "Io" }), { status: 200 })));
  beforeEach(() => {
    f.mockClear();
    vi.stubGlobal("fetch", f);
    useStore.getState().setBackendOnline(true);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    useStore.getState().setViewer("owner", false);
    useStore.getState().setBackendOnline(false);
  });

  it("un viewer non chiede la guida", async () => {
    useStore.getState().setViewer("viewer", true);
    await claimDriver();
    expect(f).not.toHaveBeenCalled();
  });

  it("un editor la chiede", async () => {
    useStore.getState().setViewer("editor", true);
    await claimDriver();
    expect(f).toHaveBeenCalledOnce();
  });
});
