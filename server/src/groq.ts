import { getSettings } from "./config";
import { composeSystem, loadProjectGuide } from "./agent";
import { notionConfigured } from "./notion";
import type { AssignBody, WireEvent } from "./types";
import {
  MAX_STEPS,
  PROGRESS_START,
  THOUGHT_LIMIT,
  buildToolSpecs,
  executeTool,
  finalizeTask,
  makeBranch,
  toGroqTools,
  truncate,
  type ToolContext,
} from "./agentTools";

const GROQ_API = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";
const MAX_RETRIES = 5;
const MAX_BACKOFF_MS = 30000;

export function groqModel(): string {
  const s = getSettings();
  // Accept groq-specific model names; fall back to the hardcoded default.
  const m = s.model?.trim();
  return m && m.startsWith("llama") ? m : DEFAULT_GROQ_MODEL;
}

type GroqTool = ReturnType<typeof toGroqTools>[number];

interface GroqMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

interface GroqResponse {
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason: string;
  }>;
  usage?: { total_tokens?: number };
}

async function groqChat(
  messages: GroqMessage[],
  tools: GroqTool[],
  systemPrompt: string,
  onRetry?: (attempt: number, waitMs: number) => void,
): Promise<{ text: string; toolCalls: Array<{ id: string; name: string; args: Record<string, unknown> }>; tokens: number }> {
  const s = getSettings();
  const allMessages: GroqMessage[] = [{ role: "system", content: systemPrompt }, ...messages];

  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const waitMs = Math.min(1000 * 2 ** attempt, MAX_BACKOFF_MS);
      onRetry?.(attempt, waitMs);
      await new Promise((r) => setTimeout(r, waitMs));
    }
    try {
      const res = await fetch(GROQ_API, {
        method: "POST",
        signal: AbortSignal.timeout(60000),
        headers: {
          Authorization: `Bearer ${s.groqApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: groqModel(),
          messages: allMessages,
          tools: tools.length > 0 ? tools : undefined,
          tool_choice: tools.length > 0 ? "auto" : undefined,
          temperature: 0.4,
        }),
      });
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`Groq ${res.status}`);
        continue;
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Groq ${res.status}: ${text.slice(0, 200)}`);
      }
      const data = (await res.json()) as GroqResponse;
      const msg = data.choices[0]?.message;
      const toolCalls = (msg?.tool_calls ?? []).map((tc) => {
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(tc.function.arguments) as Record<string, unknown>; } catch { /* keep empty */ }
        return { id: tc.id, name: tc.function.name, args };
      });
      return {
        text: msg?.content ?? "",
        toolCalls,
        tokens: data.usage?.total_tokens ?? 0,
      };
    } catch (err) {
      lastErr = err as Error;
      if (attempt >= MAX_RETRIES - 1) throw err;
    }
  }
  throw lastErr ?? new Error("Groq: troppi tentativi falliti");
}

/** Self-hosted agent loop using Groq (free Llama 3.3 70B, OpenAI-compatible API). */
export async function runGroqTask(body: AssignBody, emit: (e: WireEvent) => void): Promise<void> {
  const s = getSettings();
  const agentId = body.agentId;
  const agentName = body.agentName || body.agentId;
  const title = body.title;

  const repoEnabled = s.githubToken.length > 0 && s.githubRepo.includes("/");
  const notionEnabled = notionConfigured();
  const branch = body.branch?.trim() || makeBranch(agentName, title);
  const role = body.role?.trim() || "";
  const instructions = body.instructions?.trim() || "";
  const requireApproval = s.requireApproval;

  emit({ agentId, agentName, status: "working", progress: 6, level: "INFO", message: `Avvio · Groq (${groqModel()})` });

  if (!repoEnabled && !notionEnabled) {
    emit({ agentId, agentName, status: "blocked", level: "ERROR", message: "Nessuno strumento configurato: aggiungi un token GitHub e/o Notion in ⚙." });
    return;
  }

  const tools = toGroqTools(buildToolSpecs(s, { repoEnabled, notionEnabled }));

  let guide = "";
  if (repoEnabled) {
    guide = await loadProjectGuide(s.baseBranch);
    if (guide) emit({ agentId, agentName, level: "INFO", message: "Linee guida del progetto caricate" });
  }
  const system = composeSystem({ agentName, notionEnabled, repoEnabled, relayEnabled: true, role, instructions, guide });

  const ctx: ToolContext = {
    s, agentId, agentName, title, branch, requireApproval, emit,
    wroteFiles: false, notionWrote: false, branchReady: false,
    doneSummary: "", finished: false, progress: PROGRESS_START, stagedFiles: [],
  };
  let totalTokens = 0;

  const messages: GroqMessage[] = [{ role: "user", content: `Task: ${title}` }];

  let truncated = true; // cleared on a natural stop (done / no more tool calls)
  for (let step = 0; step < MAX_STEPS; step++) {
    const resp = await groqChat(
      messages,
      tools,
      system,
      (n, waitMs) =>
        emit({ agentId, agentName, level: "WARN", message: `Groq occupato, riprovo (${n}) tra ${Math.round(waitMs / 1000)}s…` }),
    );
    totalTokens += resp.tokens;

    if (resp.toolCalls.length === 0) {
      ctx.doneSummary = resp.text ?? "";
      truncated = false;
      break;
    }

    // Show reasoning text only when the model is about to call a tool — emitting
    // on every turn would double-log the final answer (also emitted as summary).
    if (resp.text?.trim()) {
      emit({ agentId, agentName, level: "INFO", message: `💭 ${truncate(resp.text.trim(), THOUGHT_LIMIT)}` });
    }

    messages.push({
      role: "assistant",
      content: resp.text || null,
      tool_calls: resp.toolCalls.map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: { name: tc.name, arguments: JSON.stringify(tc.args) },
      })),
    });

    for (const call of resp.toolCalls) {
      const result = await executeTool(call.name, call.args, ctx);
      messages.push({ role: "tool", content: result, tool_call_id: call.id });
    }
    if (ctx.finished) {
      truncated = false;
      break;
    }
  }

  if (truncated) {
    emit({ agentId, agentName, level: "WARN", message: `Task interrotto: raggiunto il limite di ${MAX_STEPS} passi senza chiamare done` });
  }

  await finalizeTask(ctx, { totalTokens, repoEnabled, notionEnabled, prProviderLabel: `Groq · ${groqModel()}` });
}
