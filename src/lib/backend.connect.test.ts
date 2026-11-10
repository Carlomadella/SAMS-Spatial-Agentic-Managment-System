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

/** Lascia girare le promesse in coda (la richiesta del biglietto è asincrona). */
const flush = () => vi.advanceTimersByTimeAsync(0);

type TicketReply = "ok" | 401 | "network";
let ticketReply: TicketReply = "ok";
let ticketCalls: Array<{ url: string; init?: RequestInit }> = [];

function fakeFetch(url: string, init?: RequestInit): Promise<Response> {
  if (url.endsWith("/api/events/ticket")) {
    ticketCalls.push({ url, init });
    if (ticketReply === "network") return Promise.reject(new Error("offline"));
    if (ticketReply === 401) return Promise.resolve(new Response(JSON.stringify({ error: "no" }), { status: 401 }));
    return Promise.resolve(new Response(JSON.stringify({ ticket: `t${ticketCalls.length}` }), { status: 200 }));
  }
  // Le idratazioni dell'onopen falliscono in silenzio: qui conta solo lo stream.
  return Promise.reject(new Error("offline"));
}

describe("connectBackend — lo stream si ripara da solo", () => {
  let stop: () => void = () => {};

  beforeEach(() => {
    vi.useFakeTimers();
    FakeEventSource.instances = [];
    vi.stubGlobal("EventSource", FakeEventSource);
    ticketReply = "ok";
    ticketCalls = [];
    vi.stubGlobal("fetch", vi.fn(fakeFetch));
    useStore.getState().setStreamAuthRequired(false);
  });

  afterEach(() => {
    stop();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("all'apertura la UI è online", async () => {
    stop = connectBackend();
    await flush();
    last().open();
    expect(useStore.getState().backendOnline).toBe(true);
  });

  it("se il browser chiude lo stream per sempre (errore HTTP), riapre con attesa crescente", async () => {
    stop = connectBackend();
    await flush();
    last().open();
    last().fail(true);
    expect(useStore.getState().backendOnline).toBe(false);
    expect(FakeEventSource.instances).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1000); // primo tentativo dopo 1 s
    expect(FakeEventSource.instances).toHaveLength(2);

    last().fail(true);
    await vi.advanceTimersByTimeAsync(1999); // il secondo aspetta 2 s
    expect(FakeEventSource.instances).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(FakeEventSource.instances).toHaveLength(3);

    last().open();
    expect(useStore.getState().backendOnline).toBe(true);
  });

  it("un errore temporaneo (il browser ritenta da solo) non apre un secondo stream", async () => {
    stop = connectBackend();
    await flush();
    last().open();
    last().fail(false);
    expect(useStore.getState().backendOnline).toBe(false);
    await vi.advanceTimersByTimeAsync(5000);
    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it("uno stream aperto ma muto oltre la soglia viene chiuso e riaperto", async () => {
    stop = connectBackend();
    await flush();
    const first = last();
    first.open();
    await vi.advanceTimersByTimeAsync(STREAM_STALE_MS + STREAM_WATCHDOG_MS);
    expect(first.closed).toBe(true);
    expect(useStore.getState().backendOnline).toBe(false);
    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeEventSource.instances).toHaveLength(2);
  });

  it("i ping del server tengono vivo lo stream", async () => {
    stop = connectBackend();
    await flush();
    const first = last();
    first.open();
    for (let t = 0; t < STREAM_STALE_MS * 3; t += 25_000) {
      await vi.advanceTimersByTimeAsync(25_000);
      first.ping();
    }
    expect(first.closed).toBe(false);
    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it("dopo lo stop non si riconnette più", async () => {
    stop = connectBackend();
    await flush();
    last().open();
    last().fail(true);
    stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it("chiede un biglietto col token di sessione e lo mette nell'URL dello stream (D4-C)", async () => {
    localStorage.setItem("sams.site.token", "sessione-123");
    try {
      stop = connectBackend();
      await flush();
      expect(ticketCalls).toHaveLength(1);
      expect(ticketCalls[0].init?.method).toBe("POST");
      expect((ticketCalls[0].init?.headers as Record<string, string>).Authorization).toBe("Bearer sessione-123");
      expect(new URL(last().url, "http://x").searchParams.get("t")).toBe("t1");
      // il token di sessione non finisce mai nell'URL
      expect(last().url).not.toContain("sessione-123");
    } finally {
      localStorage.removeItem("sams.site.token");
    }
  });

  it("ogni riapertura usa un biglietto nuovo", async () => {
    stop = connectBackend();
    await flush();
    last().open();
    last().fail(true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeEventSource.instances).toHaveLength(2);
    expect(new URL(last().url, "http://x").searchParams.get("t")).toBe("t2");
  });

  it("se il runtime nega il biglietto (401) non apre lo stream e segnala che serve l'accesso", async () => {
    ticketReply = 401;
    stop = connectBackend();
    await flush();
    expect(FakeEventSource.instances).toHaveLength(0);
    expect(useStore.getState().streamAuthRequired).toBe(true);
    expect(useStore.getState().backendOnline).toBe(false);

    // dopo il login (biglietto concesso) si collega da solo al tentativo successivo
    ticketReply = "ok";
    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeEventSource.instances).toHaveLength(1);
    last().open();
    expect(useStore.getState().streamAuthRequired).toBe(false);
    expect(useStore.getState().backendOnline).toBe(true);
  });

  it("se il runtime non risponde alla richiesta del biglietto, prova lo stream senza", async () => {
    ticketReply = "network";
    stop = connectBackend();
    await flush();
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(new URL(last().url, "http://x").searchParams.has("t")).toBe(false);
  });
});
