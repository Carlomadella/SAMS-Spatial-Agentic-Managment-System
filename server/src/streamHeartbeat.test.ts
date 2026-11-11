import { describe, expect, it, vi } from "vitest";
import { heartbeatTick } from "./streamHeartbeat";

const deps = (over: Partial<Parameters<typeof heartbeatTick>[0]> = {}) => ({
  isGone: () => false,
  stillAllowed: () => true,
  write: vi.fn(),
  end: vi.fn(),
  cleanup: vi.fn(),
  onCheckError: vi.fn(),
  ...over,
});

describe("heartbeatTick", () => {
  it("con lo stream vivo e la credenziale valida manda il ping", () => {
    const d = deps();
    heartbeatTick(d);
    expect(d.write).toHaveBeenCalledWith("event: ping\ndata: {}\n\n");
    expect(d.cleanup).not.toHaveBeenCalled();
  });

  it("credenziale non più valida → chiude lo stream", () => {
    const d = deps({ stillAllowed: () => false });
    heartbeatTick(d);
    expect(d.end).toHaveBeenCalledOnce();
    expect(d.cleanup).toHaveBeenCalledOnce();
    expect(d.write).not.toHaveBeenCalled();
  });

  // Ultrareview 2026-11-11: un errore di SQLite (es. SQLITE_BUSY) nel controllo della
  // sessione usciva dal setInterval e faceva cadere tutto il runtime.
  it("se il controllo lancia, chiude solo questo stream e non propaga", () => {
    const boom = new Error("SQLITE_BUSY");
    const d = deps({ stillAllowed: () => { throw boom; } });
    expect(() => heartbeatTick(d)).not.toThrow();
    expect(d.onCheckError).toHaveBeenCalledWith(boom);
    expect(d.end).toHaveBeenCalledOnce();
    expect(d.cleanup).toHaveBeenCalledOnce();
  });

  it("se anche chiudere lancia, non propaga", () => {
    const d = deps({ stillAllowed: () => false, end: vi.fn(() => { throw new Error("già chiuso"); }) });
    expect(() => heartbeatTick(d)).not.toThrow();
    expect(d.cleanup).toHaveBeenCalledOnce();
  });

  it("stream già finito → solo pulizia", () => {
    const d = deps({ isGone: () => true });
    heartbeatTick(d);
    expect(d.cleanup).toHaveBeenCalledOnce();
    expect(d.write).not.toHaveBeenCalled();
  });

  it("errore di scrittura → pulizia, senza propagare", () => {
    const d = deps({ write: vi.fn(() => { throw new Error("EPIPE"); }) });
    expect(() => heartbeatTick(d)).not.toThrow();
    expect(d.cleanup).toHaveBeenCalledOnce();
  });
});
