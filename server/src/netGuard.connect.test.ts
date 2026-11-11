import http from "node:http";
import net, { type AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { guardedFetch, makeGuardedLookup } from "./netGuard";

// DNS rebinding (residuo di sicurezza del 2026-11-10): il controllo preventivo
// (`blockedUrlReason`) risolve il nome una volta, ma la connessione lo risolveva di nuovo
// per conto suo. Un DNS ostile può dare un IP pubblico al primo giro e 127.0.0.1 al
// secondo. Qui si verifica il controllo fatto **alla connessione**.

type Lookup = ReturnType<typeof makeGuardedLookup>;
function callLookup(fn: Lookup, host: string, options: { all?: boolean }) {
  return new Promise<{ err: Error | null; address: unknown; family?: number }>((resolve) => {
    fn(host, options, (err: Error | null, address?: unknown, family?: number) => resolve({ err, address, family }));
  });
}

describe("makeGuardedLookup", () => {
  it("rifiuta se il nome risolve a un indirizzo interno", async () => {
    const lookup = makeGuardedLookup(async () => [{ address: "127.0.0.1" }]);
    const r = await callLookup(lookup, "rebind.example", {});
    expect(r.err?.message).toMatch(/interno/);
  });

  it("rifiuta se anche uno solo degli indirizzi è interno", async () => {
    const lookup = makeGuardedLookup(async () => [{ address: "93.184.216.34" }, { address: "10.0.0.1" }]);
    expect((await callLookup(lookup, "mixed.example", {})).err?.message).toMatch(/interno/);
  });

  it("passa gli indirizzi pubblici, nella forma singola e in quella con all", async () => {
    const lookup = makeGuardedLookup(async () => [{ address: "93.184.216.34" }, { address: "2606:2800:220:1::1" }]);
    const one = await callLookup(lookup, "ok.example", {});
    expect(one.err).toBeNull();
    expect(one.address).toBe("93.184.216.34");
    expect(one.family).toBe(4);
    const all = await callLookup(lookup, "ok.example", { all: true });
    expect(all.address).toEqual([
      { address: "93.184.216.34", family: 4 },
      { address: "2606:2800:220:1::1", family: 6 },
    ]);
  });

  it("un nome che non risolve è un errore, non una connessione", async () => {
    const lookup = makeGuardedLookup(async () => []);
    expect((await callLookup(lookup, "nope.invalid", {})).err?.message).toMatch(/non risolvibile/);
  });
});

describe("guardedFetch", () => {
  let server: http.Server;
  let port = 0;
  let hits = 0;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      hits++;
      if (req.url === "/redirect") {
        res.writeHead(302, { location: "http://127.0.0.1/altrove" });
        res.end();
        return;
      }
      res.writeHead(200, { "content-type": "text/plain", "x-prova": "si" });
      res.end(`segreto interno (UA ${req.headers["user-agent"]})`);
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    port = (server.address() as AddressInfo).port;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  it("un nome che alla connessione risolve a 127.0.0.1 non raggiunge il server", async () => {
    hits = 0;
    const rebinding = async () => [{ address: "127.0.0.1" }];
    await expect(guardedFetch(`http://rebind.example:${port}/`, {}, { resolve: rebinding })).rejects.toThrow(/interno/);
    expect(hits).toBe(0);
  });

  it("un IP interno scritto nell'URL non viene nemmeno contattato", async () => {
    hits = 0;
    await expect(guardedFetch(`http://127.0.0.1:${port}/`)).rejects.toThrow(/interno/);
    await expect(guardedFetch(`http://[::1]:${port}/`)).rejects.toThrow(/interno/);
    expect(hits).toBe(0);
  });

  // Il percorso di successo: si permette l'IP locale solo per poter parlare col server di prova.
  const allowAll = { resolve: async () => [{ address: "127.0.0.1" }], isBlocked: () => false };

  it("restituisce un Response con stato, header e corpo, e manda gli header richiesti", async () => {
    const res = await guardedFetch(`http://prova.example:${port}/`, { headers: { "User-Agent": "SAMS-Agent/1.0" } }, allowAll);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-prova")).toBe("si");
    expect(await res.text()).toBe("segreto interno (UA SAMS-Agent/1.0)");
  });

  it("non segue i redirect da solo: li lascia a chi chiama, che li ricontrolla", async () => {
    const res = await guardedFetch(`http://prova.example:${port}/redirect`, {}, allowAll);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("http://127.0.0.1/altrove");
  });

  it("rispetta l'AbortSignal", async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(guardedFetch(`http://prova.example:${port}/`, { signal: ctrl.signal }, allowAll)).rejects.toThrow();
  });
});

// Ultrareview 2026-11-11: una riga di stato con caratteri di controllo faceva lanciare
// `new Response(...)` dentro il callback di http.request: eccezione non gestita, runtime giù.
describe("guardedFetch — risposta malformata", () => {
  for (const reason of ["O\x01K", "O\x7fK"]) {
    it(`rifiuta una riga di stato con ${JSON.stringify(reason)} invece di far cadere il processo`, async () => {
      const srv = net.createServer((sock) => {
        sock.once("data", () => sock.end(`HTTP/1.1 200 ${reason}\r\ncontent-length: 2\r\n\r\nhi`));
      });
      await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
      const p = (srv.address() as AddressInfo).port;
      const allow = { resolve: async () => [{ address: "127.0.0.1" }], isBlocked: () => false };
      try {
        await expect(guardedFetch(`http://x.example:${p}/`, {}, allow)).rejects.toThrow(/risposta HTTP non valida/);
      } finally {
        srv.close();
      }
    });
  }
});
