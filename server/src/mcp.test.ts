import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  parseMcpServers,
  findMcpServer,
  isMcpToolAllowed,
  describeMcpServers,
  extractMcpText,
  parseJsonRpcResponse,
  callMcpTool,
} from "./mcp";

describe("parseMcpServers", () => {
  it("ritorna vuoto su input mancante o non-JSON", () => {
    expect(parseMcpServers(undefined)).toEqual([]);
    expect(parseMcpServers("")).toEqual([]);
    expect(parseMcpServers("non-json")).toEqual([]);
    expect(parseMcpServers('{"name":"x"}')).toEqual([]); // non è un array
  });
  it("tiene solo le voci con name e url http(s), normalizzando token/tools", () => {
    const raw = JSON.stringify([
      { name: "drive", url: "https://mcp.example/drive", token: "t", tools: ["list", "read", 5] },
      { name: "bad", url: "ftp://nope" },
      { name: "", url: "https://x" },
      { name: "canva", url: "https://mcp.example/canva" },
    ]);
    const s = parseMcpServers(raw);
    expect(s.map((x) => x.name)).toEqual(["drive", "canva"]);
    expect(s[0].tools).toEqual(["list", "read"]); // il 5 numerico è scartato
    expect(s[0].token).toBe("t");
    expect(s[1].token).toBeUndefined();
  });
});

describe("findMcpServer / isMcpToolAllowed", () => {
  const servers = parseMcpServers(
    JSON.stringify([
      { name: "Drive", url: "https://x/d", tools: ["files.list"] },
      { name: "calendar", url: "https://x/c" },
    ]),
  );
  it("trova il server senza distinzione di maiuscole", () => {
    expect(findMcpServer(servers, "drive")?.name).toBe("Drive");
    expect(findMcpServer(servers, "CALENDAR")?.name).toBe("calendar");
    expect(findMcpServer(servers, "ghost")).toBeUndefined();
  });
  it("rispetta la allow-list dei tool (vuota = tutti)", () => {
    expect(isMcpToolAllowed(servers[0], "files.list")).toBe(true);
    expect(isMcpToolAllowed(servers[0], "files.delete")).toBe(false);
    expect(isMcpToolAllowed(servers[1], "qualsiasi")).toBe(true);
  });
});

describe("describeMcpServers", () => {
  it("riassume server e tool", () => {
    const servers = parseMcpServers(JSON.stringify([{ name: "drive", url: "https://x", tools: ["a", "b"] }, { name: "cal", url: "https://y" }]));
    expect(describeMcpServers(servers)).toBe("drive (tool: a, b) · cal (tool: tutti)");
  });
});

describe("extractMcpText", () => {
  it("unisce le parti testuali del content", () => {
    expect(extractMcpText({ content: [{ type: "text", text: "riga1" }, { type: "text", text: "riga2" }] })).toBe("riga1\nriga2");
  });
  it("marca gli errori con isError", () => {
    expect(extractMcpText({ content: [{ type: "text", text: "boom" }], isError: true })).toBe("ERRORE MCP: boom");
  });
  it("ripiega su JSON quando non c'è testo", () => {
    expect(extractMcpText({ content: [{ type: "image", data: "..." }] })).toContain("image");
  });
});

describe("parseJsonRpcResponse", () => {
  it("interpreta JSON puro", () => {
    expect(parseJsonRpcResponse('{"jsonrpc":"2.0","id":1,"result":{"ok":1}}').result).toEqual({ ok: 1 });
  });
  it("interpreta frame SSE prendendo l'ultimo data: valido", () => {
    const sse = "event: message\ndata: {\"id\":1,\"result\":{\"a\":1}}\n\n";
    expect(parseJsonRpcResponse(sse).result).toEqual({ a: 1 });
  });
  it("ritorna un errore su risposta vuota o non interpretabile", () => {
    expect(parseJsonRpcResponse("").error).toBeDefined();
    expect(parseJsonRpcResponse("solo testo").error).toBeDefined();
  });
});

describe("callMcpTool — validazione allow-list (senza rete)", () => {
  const servers = parseMcpServers(JSON.stringify([{ name: "drive", url: "https://x/d", tools: ["files.list"] }]));
  it("rifiuta un server non configurato", async () => {
    expect(await callMcpTool(servers, "ghost", "x", {})).toContain('server MCP "ghost" non configurato');
  });
  it("rifiuta un tool fuori allow-list", async () => {
    expect(await callMcpTool(servers, "drive", "files.delete", {})).toContain("non permesso");
  });
  it("rifiuta un nome di tool vuoto", async () => {
    expect(await callMcpTool(servers, "drive", "  ", {})).toContain("nome del tool MCP mancante");
  });
});

// Server MCP finto che si comporta come Scrapling (Streamable HTTP): pretende
// l'handshake `initialize` e poi l'header `Mcp-Session-Id` su ogni chiamata.
describe("callMcpTool — handshake di sessione (server locale finto)", () => {
  // Elenco dei metodi JSON-RPC ricevuti, in ordine, per verificare la sequenza.
  const received: string[] = [];
  // Il server HTTP finto e la sua URL, creati prima dei test.
  let server: import("node:http").Server;
  let url = "";

  beforeAll(async () => {
    // Import dinamico: il modulo http serve solo a questo blocco di test.
    const http = await import("node:http");
    server = http.createServer((req, res) => {
      // Accumulo il corpo della richiesta, che arriva a pezzi.
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        // Leggo il messaggio JSON-RPC e mi segno il metodo chiamato.
        const msg = JSON.parse(body) as { id?: number; method: string; params?: { name?: string } };
        received.push(msg.method);
        // Primo passo: initialize → rispondo con l'id di sessione nell'header.
        if (msg.method === "initialize") {
          res.writeHead(200, { "content-type": "application/json", "mcp-session-id": "sess-42" });
          res.end(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { capabilities: {} } }));
          return;
        }
        // Da qui in poi senza la sessione giusta rispondo 400, come Scrapling.
        if (req.headers["mcp-session-id"] !== "sess-42") {
          res.writeHead(400, { "content-type": "application/json" });
          res.end(JSON.stringify({ jsonrpc: "2.0", id: null, error: { message: "Missing session ID" } }));
          return;
        }
        // La notifica di "pronto" non ha risposta: 202 Accepted, corpo vuoto.
        if (msg.method === "notifications/initialized") {
          res.writeHead(202);
          res.end();
          return;
        }
        // tools/call: rispondo in formato SSE, come fa il vero server.
        res.writeHead(200, { "content-type": "text/event-stream" });
        res.end(`event: message\ndata: ${JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: `ok ${msg.params?.name}` }] } })}\n\n`);
      });
    });
    // Porta 0 = il sistema sceglie una porta libera, niente conflitti in CI.
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    const addr = server.address() as import("node:net").AddressInfo;
    url = `http://127.0.0.1:${addr.port}/mcp`;
  });

  // Spengo il server finto a fine blocco.
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  it("fa initialize → notifications/initialized → tools/call con la sessione", async () => {
    // Configuro il server finto come lo configurerebbe l'utente per Scrapling.
    const servers = parseMcpServers(JSON.stringify([{ name: "scrapling", url }]));
    const out = await callMcpTool(servers, "scrapling", "make_request", { url: "https://example.com" });
    // Il risultato arriva e la sequenza dei metodi è quella prevista dal protocollo.
    expect(out).toBe("ok make_request");
    expect(received).toEqual(["initialize", "notifications/initialized", "tools/call"]);
  });
});
