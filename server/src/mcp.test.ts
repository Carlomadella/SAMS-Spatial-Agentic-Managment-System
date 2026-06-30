import { describe, it, expect } from "vitest";
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
