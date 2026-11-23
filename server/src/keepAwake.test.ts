import { describe, expect, it, vi } from "vitest";
import { KEEP_AWAKE_EVERY_MS, createKeepAwake, keepAwakeUrl } from "./keepAwake";

describe("keepAwakeUrl", () => {
  it("usa SAMS_KEEP_AWAKE_URL o RENDER_EXTERNAL_URL, altrimenti niente", () => {
    expect(keepAwakeUrl({ RENDER_EXTERNAL_URL: "https://sams.onrender.com/" })).toBe("https://sams.onrender.com/api/health");
    expect(keepAwakeUrl({ SAMS_KEEP_AWAKE_URL: "https://a.b", RENDER_EXTERNAL_URL: "https://c.d" })).toBe("https://a.b/api/health");
    expect(keepAwakeUrl({})).toBeNull();
    expect(keepAwakeUrl({ RENDER_EXTERNAL_URL: "nonunurl" })).toBeNull();
  });
});

describe("createKeepAwake", () => {
  it("pinga ogni 10 minuti solo mentre ci sono task in corso", () => {
    vi.useFakeTimers();
    const ping = vi.fn(async () => undefined);
    const k = createKeepAwake({ url: "https://x/api/health", ping, setInterval, clearInterval: (h) => clearInterval(h as never) });
    k.update(1);
    k.update(2); // già acceso: nessun secondo timer
    vi.advanceTimersByTime(KEEP_AWAKE_EVERY_MS * 2);
    expect(ping).toHaveBeenCalledTimes(2);
    k.update(0);
    expect(k.active()).toBe(false);
    vi.advanceTimersByTime(KEEP_AWAKE_EVERY_MS * 3);
    expect(ping).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("senza indirizzo pubblico non fa niente", () => {
    const setI = vi.fn();
    const k = createKeepAwake({ url: null, ping: vi.fn(), setInterval: setI, clearInterval: vi.fn() });
    k.update(3);
    expect(setI).not.toHaveBeenCalled();
    expect(k.active()).toBe(false);
  });

  it("un ping fallito non rompe niente", async () => {
    vi.useFakeTimers();
    const ping = vi.fn(async () => { throw new Error("giù"); });
    const k = createKeepAwake({ url: "https://x/api/health", ping, setInterval, clearInterval: (h) => clearInterval(h as never) });
    k.update(1);
    vi.advanceTimersByTime(KEEP_AWAKE_EVERY_MS);
    await Promise.resolve();
    expect(ping).toHaveBeenCalledOnce();
    k.update(0);
    vi.useRealTimers();
  });
});
