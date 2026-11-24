// Chiamate agli strumenti scritte nel TESTO della risposta (simulazione 24/11).
//
// Alcuni modelli gratuiti (Nemotron, Qwen) a volte non usano le chiamate strutturate
// dell'API ma scrivono la chiamata nel testo, in uno di questi due formati:
//
//   <tool_call><function=done><parameter=summary>…</parameter></function></tool_call>
//   <tool_call>{"name": "done", "arguments": {"summary": "…"}}</tool_call>
//
// SAMS le ignorava: un `done` così finiva come «passi esauriti» con l'XML grezzo nel
// riassunto. Qui le si riconosce, così il ciclo dell'agente le esegue come le altre.

export interface TextToolCall {
  name: string;
  args: Record<string, unknown>;
}

const BLOCK = /<tool_call>([\s\S]*?)<\/tool_call>/g;
const FUNCTION = /<function=([\w.-]+)>([\s\S]*?)<\/function>/;
const PARAM = /<parameter=([\w.-]+)>([\s\S]*?)<\/parameter>/g;

/** Il valore di un parametro: numeri e JSON (array/oggetti) tornano col loro tipo. */
function paramValue(raw: string): unknown {
  const v = raw.trim();
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if (v === "true" || v === "false") return v === "true";
  if ((v.startsWith("[") && v.endsWith("]")) || (v.startsWith("{") && v.endsWith("}"))) {
    try {
      return JSON.parse(v);
    } catch {
      /* resta testo */
    }
  }
  return v;
}

function parseBlock(body: string): TextToolCall | null {
  const fn = FUNCTION.exec(body);
  if (fn) {
    const args: Record<string, unknown> = {};
    for (const m of fn[2].matchAll(PARAM)) args[m[1]] = paramValue(m[2]);
    return { name: fn[1], args };
  }
  try {
    const j = JSON.parse(body.trim()) as { name?: unknown; arguments?: unknown };
    if (typeof j.name !== "string" || !j.name) return null;
    const a = typeof j.arguments === "string" ? JSON.parse(j.arguments) : j.arguments;
    return { name: j.name, args: a && typeof a === "object" ? (a as Record<string, unknown>) : {} };
  } catch {
    return null;
  }
}

/** Le chiamate scritte nel testo, nell'ordine in cui compaiono (vuoto se non ce ne sono). */
export function parseTextToolCalls(text: string | null | undefined): TextToolCall[] {
  if (!text || !text.includes("<tool_call>")) return [];
  const out: TextToolCall[] = [];
  for (const m of text.matchAll(BLOCK)) {
    const call = parseBlock(m[1]);
    if (call) out.push(call);
  }
  return out;
}

/** Il testo senza i blocchi `<tool_call>` (quello che resta da mostrare come pensiero). */
export function stripTextToolCalls(text: string): string {
  return text.replace(BLOCK, "").trim();
}
