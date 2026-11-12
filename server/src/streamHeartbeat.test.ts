import { describe, expect, it, vi } from "vitest";
import { heartbeatTick, type HeartbeatDeps } from "./streamHeartbeat";

const deps = (over: Partial<HeartbeatDeps> = {}) => ({
  isGone: () => false,
  stillAllowed: async () => true,
  write: vi.fn(),
  end: vi.fn(),
  cleanup: vi.fn(),
  onCheckError: vi.fn(),
  ...over,
});

describe("heartbeatTick", () => {
  it("con lo stream vivo e la credenziale valida manda il ping", async () => {
    const d = deps();
    await heartbeatTick(d);
    expect(d.write).toHaveBeenCalledWith("event: ping\ndata: {}\n\n");
    expect(d.cleanup).not.toHaveBeenCalled();
  });

  it("credenziale non più valida → chiude lo stream", async () => {
    const d = deps({ stillAllowed: async () => false });
    await heartbeatTick(d);
    expect(d.end).toHaveBeenCalledOnce();
    expect(d.cleanup).toHaveBeenCalledOnce();
    expect(d.write).not.toHaveBeenCalled();
  });

  // Ultrareview 2026-11-11: un errore del DB (es. SQLITE_BUSY) nel controllo della
  // sessione usciva dal setInterval e faceva cadere tutto il runtime.
  it("se il controllo lancia, chiude solo questo stream e non propaga", async () => {
    const boom = new Error("SQLITE_BUSY");
    const d = deps({ stillAllowed: () => { throw boom; } });
    await expect(heartbeatTick(d)).resolves.toBeUndefined();
    expect(d.onCheckError).toHaveBeenCalledWith(boom);
    expect(d.end).toHaveBeenCalledOnce();
    expect(d.cleanup).toHaveBeenCalledOnce();
  });

  // Con MySQL il controllo è una promessa: se rifiuta (connessione persa) vale lo stesso.
  it("se il controllo asincrono rifiuta, chiude solo questo stream e non propaga", async () => {
    const boom = new Error("ECONNRESET");
    const d = deps({ stillAllowed: () => Promise.reject(boom) });
    await expect(heartbeatTick(d)).resolves.toBeUndefined();
    expect(d.onCheckError).toHaveBeenCalledWith(boom);
    expect(d.end).toHaveBeenCalledOnce();
    expect(d.cleanup).toHaveBeenCalledOnce();
  });

  it("stream chiuso mentre si controllava la credenziale → solo pulizia, niente ping", async () => {
    let gone = false;
    const d = deps({
      isGone: () => gone,
      stillAllowed: async () => {
        gone = true;
        return true;
      },
    });
    await heartbeatTick(d);
    expect(d.write).not.toHaveBeenCalled();
    expect(d.cleanup).toHaveBeenCalledOnce();
  });

  it("se anche chiudere lancia, non propaga", async () => {
    const d = deps({ stillAllowed: async () => false, end: vi.fn(() => { throw new Error("già chiuso"); }) });
    await expect(heartbeatTick(d)).resolves.toBeUndefined();
    expect(d.cleanup).toHaveBeenCalledOnce();
  });

  it("stream già finito → solo pulizia", async () => {
    const d = deps({ isGone: () => true });
    await heartbeatTick(d);
    expect(d.cleanup).toHaveBeenCalledOnce();
    expect(d.write).not.toHaveBeenCalled();
  });

  it("errore di scrittura → pulizia, senza propagare", async () => {
    const d = deps({ write: vi.fn(() => { throw new Error("EPIPE"); }) });
    await expect(heartbeatTick(d)).resolves.toBeUndefined();
    expect(d.cleanup).toHaveBeenCalledOnce();
  });
});
