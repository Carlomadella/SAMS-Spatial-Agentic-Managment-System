import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connectBackend } from "./backend";
import { useStore } from "../store/useStore";
import { STREAM_STALE_MS, STREAM_WATCHDOG_MS } from "./streamHealth";

/** EventSource finto: registra le istanze e permette di simulare open/errore/ping. */
class FakeEventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;
  static instances: FakeEventSource[] = [];
  readyState = FakeEventSource.CONNECTING;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  listeners: Record<string, Array<() => void>> = {};
  closed = false;
  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }
  addEventListener(name: string, fn: () => void) {
    (this.listeners[name] ??= []).push(fn);
  }
  close() {
    this.closed = true;
    this.readyState = FakeEventSource.CLOSED;
  }
  open() {
    this.readyState = FakeEventSource.OPEN;
    this.onopen?.();
  }
  fail(permanent: boolean) {
    this.readyState = permanent ? FakeEventSource.CLOSED : FakeEventSource.CONNECTING;
    this.onerror?.();
  }
  ping() {
    for (const fn of this.listeners.ping ?? []) fn();
  }
}

const last = () => FakeEventSource.instances[FakeEventSource.instances.length - 1];

describe("connectBackend — lo stream si ripara da solo", () => {
  let stop: () => void = () => {};

  beforeEach(() => {
    vi.useFakeTimers();
    FakeEventSource.instances = [];
    vi.stubGlobal("EventSource", FakeEventSource);
    // Le idratazioni dell'onopen falliscono in silenzio: qui conta solo lo stream.
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
  });

  afterEach(() => {
    stop();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("all'apertura la UI è online", () => {
    stop = connectBackend();
    last().open();
    expect(useStore.getState().backendOnline).toBe(true);
  });

  it("se il browser chiude lo stream per sempre (errore HTTP), riapre con attesa crescente", () => {
    stop = connectBackend();
    last().open();
    last().fail(true);
    expect(useStore.getState().backendOnline).toBe(false);
    expect(FakeEventSource.instances).toHaveLength(1);

    vi.advanceTimersByTime(1000); // primo tentativo dopo 1 s
    expect(FakeEventSource.instances).toHaveLength(2);

    last().fail(true);
    vi.advanceTimersByTime(1999); // il secondo aspetta 2 s
    expect(FakeEventSource.instances).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(FakeEventSource.instances).toHaveLength(3);

    last().open();
    expect(useStore.getState().backendOnline).toBe(true);
  });

  it("un errore temporaneo (il browser ritenta da solo) non apre un secondo stream", () => {
    stop = connectBackend();
    last().open();
    last().fail(false);
    expect(useStore.getState().backendOnline).toBe(false);
    vi.advanceTimersByTime(5000);
    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it("uno stream aperto ma muto oltre la soglia viene chiuso e riaperto", () => {
    stop = connectBackend();
    const first = last();
    first.open();
    vi.advanceTimersByTime(STREAM_STALE_MS + STREAM_WATCHDOG_MS);
    expect(first.closed).toBe(true);
    expect(useStore.getState().backendOnline).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(FakeEventSource.instances).toHaveLength(2);
  });

  it("i ping del server tengono vivo lo stream", () => {
    stop = connectBackend();
    const first = last();
    first.open();
    for (let t = 0; t < STREAM_STALE_MS * 3; t += 25_000) {
      vi.advanceTimersByTime(25_000);
      first.ping();
    }
    expect(first.closed).toBe(false);
    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it("dopo lo stop non si riconnette più", () => {
    stop = connectBackend();
    last().open();
    last().fail(true);
    stop();
    vi.advanceTimersByTime(60_000);
    expect(FakeEventSource.instances).toHaveLength(1);
  });
});
