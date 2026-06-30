// Strumento agente `mcp_call`: permette agli agenti di invocare tool esposti da
// server MCP esterni (es. Google Drive, Calendar, Canva) tramite un endpoint
// HTTP JSON-RPC. La configurazione è una allow-list (quali server, e
// facoltativamente quali tool per server): se non è configurato nulla, il tool
// non viene nemmeno offerto. Logica di validazione/shaping pura e testabile; il
// transport è un POST best-effort isolato in fondo.

export interface McpServerConfig {
  name: string;
  url: string;
  token?: string;
  /** Allow-list di tool per questo server; vuota/assente = tutti i tool ammessi. */
  tools?: string[];
}

/** Parsa la config dei server MCP da una stringa JSON (env/settings). Ignora le
 *  voci malformate; ritorna sempre un array (vuoto se nulla è valido). */
export function parseMcpServers(raw: string | undefined): McpServerConfig[] {
  if (!raw || !raw.trim()) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const out: McpServerConfig[] = [];
  for (const item of data) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name.trim() : "";
    const url = typeof o.url === "string" ? o.url.trim() : "";
    if (!name || !/^https?:\/\//.test(url)) continue;
    const cfg: McpServerConfig = { name, url };
    if (typeof o.token === "string" && o.token) cfg.token = o.token;
    if (Array.isArray(o.tools)) cfg.tools = o.tools.filter((t): t is string => typeof t === "string");
    out.push(cfg);
  }
  return out;
}

export function findMcpServer(servers: McpServerConfig[], name: string): McpServerConfig | undefined {
  const n = name.trim().toLowerCase();
  return servers.find((s) => s.name.toLowerCase() === n);
}

/** Un tool è ammesso se il server non ha allow-list oppure se vi è elencato. */
export function isMcpToolAllowed(server: McpServerConfig, tool: string): boolean {
  if (!server.tools || server.tools.length === 0) return true;
  return server.tools.includes(tool);
}

/** Riassunto leggibile dei server/tool disponibili, per la descrizione del tool. */
export function describeMcpServers(servers: McpServerConfig[]): string {
  return servers
    .map((s) => {
      const tools = s.tools && s.tools.length ? s.tools.join(", ") : "tutti";
      return `${s.name} (tool: ${tools})`;
    })
    .join(" · ");
}

/** Estrae il testo da un risultato MCP `tools/call` (`{ content: [...] }`). */
export function extractMcpText(result: unknown): string {
  if (typeof result !== "object" || result === null) return String(result ?? "");
  const r = result as { content?: unknown; isError?: boolean };
  const parts = Array.isArray(r.content) ? r.content : [];
  const text = parts
    .map((p) => {
      if (typeof p === "object" && p !== null && "text" in p) return String((p as { text: unknown }).text ?? "");
      return "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
  const body = text || JSON.stringify(r.content ?? r);
  return r.isError ? `ERRORE MCP: ${body}` : body;
}

interface JsonRpcResponse {
  result?: unknown;
  error?: { message?: string };
}

/**
 * Parsa la risposta JSON-RPC di un server MCP. I server "Streamable HTTP"
 * possono rispondere o con JSON puro o con frame SSE (`data: {...}`): gestiamo
 * entrambi prendendo l'ultimo oggetto JSON-RPC valido che contiene result/error.
 */
export function parseJsonRpcResponse(rawText: string): JsonRpcResponse {
  const text = rawText.trim();
  if (!text) return { error: { message: "risposta vuota" } };

  const tryParse = (s: string): JsonRpcResponse | null => {
    try {
      const o = JSON.parse(s) as JsonRpcResponse;
      return o && (("result" in o) || ("error" in o)) ? o : null;
    } catch {
      return null;
    }
  };

  // JSON puro
  const whole = tryParse(text);
  if (whole) return whole;

  // Frame SSE: prendi l'ultima riga `data:` parsabile
  let last: JsonRpcResponse | null = null;
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^data:\s*(.+)$/);
    if (m) {
      const parsed = tryParse(m[1]);
      if (parsed) last = parsed;
    }
  }
  return last ?? { error: { message: "risposta JSON-RPC non interpretabile" } };
}

const MCP_TIMEOUT_MS = 20000;
const MCP_RESULT_LIMIT = 6000;

/**
 * Invoca un tool su un server MCP configurato. Applica la allow-list (server e
 * tool) e poi esegue un POST JSON-RPC `tools/call`. Ritorna SEMPRE una stringa
 * (risultato o `ERRORE …`) adatta a essere reimmessa nel loop dell'agente.
 */
export async function callMcpTool(
  servers: McpServerConfig[],
  serverName: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<string> {
  const server = findMcpServer(servers, serverName);
  if (!server) {
    const names = servers.map((s) => s.name).join(", ") || "(nessuno)";
    return `ERRORE: server MCP "${serverName}" non configurato. Disponibili: ${names}`;
  }
  if (!toolName.trim()) return "ERRORE: nome del tool MCP mancante";
  if (!isMcpToolAllowed(server, toolName)) {
    return `ERRORE: tool "${toolName}" non permesso sul server "${server.name}" (allow-list: ${server.tools?.join(", ")})`;
  }

  let resp: Response;
  try {
    resp = await fetch(server.url, {
      method: "POST",
      signal: AbortSignal.timeout(MCP_TIMEOUT_MS),
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        ...(server.token ? { authorization: `Bearer ${server.token}` } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: toolName, arguments: args } }),
    });
  } catch (err) {
    return `ERRORE: chiamata MCP fallita (${(err as Error).message})`;
  }
  if (!resp.ok) return `ERRORE: server MCP "${server.name}" ha risposto HTTP ${resp.status}`;

  const rpc = parseJsonRpcResponse(await resp.text());
  if (rpc.error) return `ERRORE MCP: ${rpc.error.message ?? "errore sconosciuto"}`;
  const out = extractMcpText(rpc.result);
  return out.length > MCP_RESULT_LIMIT ? out.slice(0, MCP_RESULT_LIMIT) + "\n…(troncato)" : out;
}
