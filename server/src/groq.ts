import { getSettings } from "./config";
import { composeSystem, loadProjectGuide } from "./agent";
import { commentOnPullRequest, createBranch, createIssue, createPullRequest, listCIRuns, listFiles, listPullRequests, readFile, readPullRequest, writeFile } from "./github";
import { setPending } from "./pendingBuffer";
import type { PendingFile } from "./types";
import { appendTaskLog, appendToPageByTitle, createPage as notionCreatePage, notionConfigured, readPageByTitle, replacePageByTitle } from "./notion";
import type { AssignBody, WireEvent } from "./types";

const GROQ_API = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";

export function groqModel(): string {
  const s = getSettings();
  // Accept groq-specific model names; fall back to the hardcoded default.
  const m = s.model?.trim();
  return m && m.startsWith("llama") ? m : DEFAULT_GROQ_MODEL;
}

function slugify(s: string): string {
  return (
    s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "task"
  );
}
function makeBranch(agentName: string, title: string): string {
  return `sams/${agentName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}/${slugify(title)}-${Date.now().toString(36)}`;
}
function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : JSON.stringify(v);
}

interface GroqTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

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
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) {
      const waitMs = Math.min(1000 * 2 ** attempt, 30000);
      onRetry?.(attempt, waitMs);
      await new Promise((r) => setTimeout(r, waitMs));
    }
    try {
      const res = await fetch(GROQ_API, {
        method: "POST",
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
      if (attempt >= 4) throw err;
      lastErr = err as Error;
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

  const tools: GroqTool[] = [];
  if (repoEnabled) {
    tools.push(
      {
        type: "function",
        function: {
          name: "gh_list_files",
          description: `Elenca i file in una cartella del repository (legge da '${s.baseBranch}').`,
          parameters: { type: "object", properties: { path: { type: "string", description: "cartella, vuoto = root" } } },
        },
      },
      {
        type: "function",
        function: {
          name: "gh_read_file",
          description: `Leggi un file del repository (legge da '${s.baseBranch}').`,
          parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
        },
      },
      {
        type: "function",
        function: {
          name: "gh_write_file",
          description: "Crea o aggiorna un file nel repository (commit su un branch dedicato, poi PR).",
          parameters: {
            type: "object",
            properties: { path: { type: "string" }, content: { type: "string" }, message: { type: "string" } },
            required: ["path", "content"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "gh_create_issue",
          description: "Apre una issue su GitHub (per segnalare bug, richiedere feature o documentare un problema trovato).",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string" },
              body: { type: "string" },
              labels: { type: "array", items: { type: "string" } },
            },
            required: ["title", "body"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "gh_list_prs",
          description: "Elenca le pull request aperte nel repository (numero, titolo, autore, branch).",
          parameters: { type: "object", properties: {} },
        },
      },
      {
        type: "function",
        function: {
          name: "gh_read_pr",
          description: "Leggi i dettagli di una pull request: titolo, descrizione, file modificati con conteggio delle righe.",
          parameters: {
            type: "object",
            properties: { pr_number: { type: "number", description: "Numero della PR" } },
            required: ["pr_number"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "gh_comment_pr",
          description: "Pubblica un commento su una pull request (revisione, feedback, osservazioni).",
          parameters: {
            type: "object",
            properties: {
              pr_number: { type: "number", description: "Numero della PR" },
              body: { type: "string", description: "Testo del commento (markdown supportato)" },
            },
            required: ["pr_number", "body"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "gh_list_ci",
          description: "Elenca gli ultimi run della CI (GitHub Actions) per un branch.",
          parameters: {
            type: "object",
            properties: { branch: { type: "string", description: "Branch da controllare (opzionale)" } },
          },
        },
      },
    );
  }
  if (notionEnabled) {
    tools.push(
      {
        type: "function",
        function: {
          name: "notion_read",
          description: "Leggi il contenuto testuale di una pagina Notion (trovata per titolo). Usalo PRIMA di scrivere per evitare duplicati.",
          parameters: {
            type: "object",
            properties: { page_title: { type: "string" } },
            required: ["page_title"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "notion_write",
          description: "Aggiungi contenuto (markdown, anche blocchi ```lang) a una pagina Notion trovata per titolo.",
          parameters: {
            type: "object",
            properties: { page_title: { type: "string" }, content: { type: "string" } },
            required: ["page_title", "content"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "notion_create_page",
          description: "Crea una nuova pagina figlio Notion sotto la pagina trovata per titolo (parent_title).",
          parameters: {
            type: "object",
            properties: {
              parent_title: { type: "string", description: "Titolo della pagina genitore" },
              title: { type: "string", description: "Titolo della nuova pagina" },
              content: { type: "string", description: "Contenuto markdown della nuova pagina" },
            },
            required: ["parent_title", "title", "content"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "notion_replace_page",
          description: "Sostituisce TUTTO il contenuto di una pagina Notion (cancella i blocchi esistenti e riscrive). Usa con cautela.",
          parameters: {
            type: "object",
            properties: {
              page_title: { type: "string" },
              content: { type: "string", description: "Nuovo contenuto markdown completo" },
            },
            required: ["page_title", "content"],
          },
        },
      },
    );
  }
  tools.push(
    {
      type: "function",
      function: {
        name: "announce_plan",
        description: "Chiama SUBITO all'inizio, prima di qualsiasi altra azione, per dichiarare i passi del tuo piano (4–6 voci). Aiuta l'utente a seguire il progresso.",
        parameters: {
          type: "object",
          properties: {
            steps: { type: "array", items: { type: "string" }, description: "Lista di passi del piano (4–6 voci brevi)" },
          },
          required: ["steps"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "web_fetch",
        description: "Scarica il contenuto testuale di una URL (documentazione, API, pagine web) utile per il task. Ritorna fino a 6000 caratteri di testo leggibile.",
        parameters: {
          type: "object",
          properties: { url: { type: "string", description: "URL da scaricare (deve iniziare con https://)" } },
          required: ["url"],
        },
      },
    },
  );
  tools.push(
    {
      type: "function",
      function: {
        name: "relay_task",
        description: "Delega la continuazione del task a un altro agente SAMS specificando il ruolo (Tester/Revisore/Documentatore/Architetto) o il nome. Chiama done subito dopo.",
        parameters: {
          type: "object",
          properties: {
            target: { type: "string", description: "Ruolo o nome dell'agente destinatario" },
            title: { type: "string", description: "Titolo del task da assegnare" },
            branch: { type: "string", description: "Branch su cui lavorare (vuoto = eredita quello corrente)" },
            context: { type: "string", description: "Contesto o istruzioni aggiuntive per il destinatario" },
          },
          required: ["target", "title"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "done",
        description: "Chiama quando il task è completato (o se non puoi completarlo).",
        parameters: { type: "object", properties: { summary: { type: "string" } }, required: ["summary"] },
      },
    },
  );

  let guide = "";
  if (repoEnabled) {
    guide = await loadProjectGuide(s.baseBranch);
    if (guide) emit({ agentId, agentName, level: "INFO", message: "Linee guida del progetto caricate" });
  }
  const system = composeSystem({ agentName, notionEnabled, repoEnabled, relayEnabled: true, role, instructions, guide });

  let wroteFiles = false;
  let notionWrote = false;
  let branchReady = false;
  let doneSummary = "";
  let progress = 10;
  let totalTokens = 0;
  const stagedFiles: PendingFile[] = [];

  const messages: GroqMessage[] = [{ role: "user", content: `Task: ${title}` }];

  for (let step = 0; step < 14; step++) {
    const resp = await groqChat(
      messages,
      tools,
      system,
      (n, waitMs) =>
        emit({ agentId, agentName, level: "WARN", message: `Groq occupato, riprovo (${n}) tra ${Math.round(waitMs / 1000)}s…` }),
    );
    totalTokens += resp.tokens;

    if (resp.text?.trim()) {
      emit({ agentId, agentName, level: "INFO", message: `💭 ${truncate(resp.text.trim(), 200)}` });
    }

    if (resp.toolCalls.length === 0) {
      doneSummary = resp.text ?? "";
      break;
    }

    const assistantMsg: GroqMessage = {
      role: "assistant",
      content: resp.text || null,
      tool_calls: resp.toolCalls.map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: { name: tc.name, arguments: JSON.stringify(tc.args) },
      })),
    };
    messages.push(assistantMsg);

    let finished = false;
    for (const call of resp.toolCalls) {
      const name = call.name;
      const args = call.args;
      progress = Math.min(92, progress + 7);
      let result = "ok";
      try {
        if (name === "gh_list_files") {
          result = (await listFiles(str(args.path), s.baseBranch)).join("\n") || "(vuoto)";
          emit({ agentId, agentName, progress, level: "INFO", message: `ls ${str(args.path) || "/"}` });
        } else if (name === "gh_read_file") {
          result = truncate(await readFile(str(args.path), s.baseBranch), 8000);
          emit({ agentId, agentName, progress, level: "INFO", message: `read ${str(args.path)}` });
        } else if (name === "gh_write_file") {
          const filePath = str(args.path);
          const fileContent = str(args.content);
          const fileMessage = str(args.message) || `SAMS: ${truncate(title, 60)}`;
          if (requireApproval) {
            stagedFiles.push({ path: filePath, content: fileContent, message: fileMessage });
            emit({ agentId, agentName, progress, level: "INFO", message: `staged ${filePath}` });
          } else {
            if (!branchReady) {
              await createBranch(branch, s.baseBranch);
              branchReady = true;
              emit({ agentId, agentName, level: "INFO", message: `Branch ${branch} creato` });
            }
            await writeFile(filePath, fileContent, branch, fileMessage);
            wroteFiles = true;
            emit({ agentId, agentName, progress, level: "SUCCESS", message: `write ${filePath}` });
          }
        } else if (name === "gh_create_issue") {
          const issue = await createIssue(
            str(args.title),
            str(args.body),
            Array.isArray(args.labels) ? (args.labels as string[]) : [],
          );
          result = `Issue #${issue.number}: ${issue.html_url}`;
          emit({ agentId, agentName, progress, level: "SUCCESS", message: `Issue #${issue.number} aperta` });
        } else if (name === "gh_list_prs") {
          result = await listPullRequests();
          emit({ agentId, agentName, progress, level: "INFO", message: `PR elencate` });
        } else if (name === "gh_read_pr") {
          const prNum = Number(args.pr_number);
          result = await readPullRequest(prNum);
          emit({ agentId, agentName, progress, level: "INFO", message: `PR #${prNum} letta` });
        } else if (name === "gh_comment_pr") {
          const prNum = Number(args.pr_number);
          const comment = await commentOnPullRequest(prNum, str(args.body));
          result = `Commento pubblicato: ${comment.html_url}`;
          emit({ agentId, agentName, progress, level: "SUCCESS", message: `Commento su PR #${prNum}` });
        } else if (name === "gh_list_ci") {
          result = await listCIRuns(str(args.branch) || undefined);
          emit({ agentId, agentName, progress, level: "INFO", message: `CI run elencati` });
        } else if (name === "notion_read") {
          const { title: resolved, text } = await readPageByTitle(str(args.page_title));
          result = text;
          emit({ agentId, agentName, progress, level: "INFO", message: `Notion → letta "${resolved}"` });
        } else if (name === "notion_write") {
          const resolved = await appendToPageByTitle(str(args.page_title), str(args.content));
          notionWrote = true;
          result = `scritto sulla pagina "${resolved}"`;
          emit({ agentId, agentName, progress, level: "SUCCESS", message: `Notion ← "${resolved}"` });
        } else if (name === "notion_create_page") {
          const created = await notionCreatePage(str(args.parent_title), str(args.title), str(args.content));
          notionWrote = true;
          result = `Pagina "${str(args.title)}" creata: ${created.url}`;
          emit({ agentId, agentName, progress, level: "SUCCESS", message: `Notion: nuova pagina "${str(args.title)}"` });
        } else if (name === "notion_replace_page") {
          const replaced = await replacePageByTitle(str(args.page_title), str(args.content));
          notionWrote = true;
          result = `Pagina "${replaced}" sostituita`;
          emit({ agentId, agentName, progress, level: "SUCCESS", message: `Notion ↺ "${replaced}"` });
        } else if (name === "announce_plan") {
          const steps = Array.isArray(args.steps) ? (args.steps as string[]) : [];
          result = "Piano ricevuto";
          emit({ agentId, agentName, plan: steps, level: "INFO", message: `📋 Piano (${steps.length} passi): ${steps.slice(0, 3).join(" → ")}${steps.length > 3 ? " …" : ""}` });
        } else if (name === "web_fetch") {
          const url = str(args.url);
          if (!url.startsWith("http://") && !url.startsWith("https://")) {
            result = "ERRORE: URL non valida — deve iniziare con https://";
          } else {
            const resp = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { "User-Agent": "SAMS-Agent/1.0" } });
            const raw = await resp.text();
            const ct = resp.headers.get("content-type") ?? "";
            const content = ct.includes("html")
              ? raw
                  .replace(/<script[\s\S]*?<\/script>/gi, " ")
                  .replace(/<style[\s\S]*?<\/style>/gi, " ")
                  .replace(/<[^>]+>/g, " ")
                  .replace(/&(?:nbsp|amp|lt|gt);/g, (m) => ({ "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">" }[m] ?? m))
                  .replace(/\s+/g, " ")
                  .trim()
              : raw;
            result = truncate(content, 6000);
            emit({ agentId, agentName, progress, level: "INFO", message: `fetch ${url.slice(0, 70)}` });
          }
        } else if (name === "relay_task") {
          const relayTarget = str(args.target);
          const relayTitle = str(args.title);
          const relayBranch = str(args.branch) || branch;
          const relayCtx = str(args.context);
          result = `Relay inviato a "${relayTarget}": ${relayTitle}`;
          emit({ agentId, agentName, progress, level: "SUCCESS", message: `→ Relay a ${relayTarget}: ${relayTitle}`, relayTo: { target: relayTarget, title: relayTitle, branch: relayBranch, context: relayCtx } });
        } else if (name === "done") {
          doneSummary = str(args.summary);
          finished = true;
        } else {
          result = `strumento sconosciuto: ${name}`;
        }
      } catch (err) {
        result = `ERRORE: ${(err as Error).message}`;
        emit({ agentId, agentName, level: "WARN", message: `${name}: ${(err as Error).message}` });
      }
      messages.push({ role: "tool", content: result, tool_call_id: call.id });
    }
    if (finished) break;
  }

  if (doneSummary) emit({ agentId, agentName, level: "INFO", message: truncate(doneSummary, 200) });

  if (requireApproval && stagedFiles.length > 0) {
    setPending(agentId, { branch, title, agentName, files: stagedFiles });
    emit({
      agentId, agentName,
      status: "awaiting_approval",
      progress: 100,
      level: "WARN",
      message: `${stagedFiles.length} file${stagedFiles.length > 1 ? " pronti" : " pronto"} — approva o rifiuta nel pannello`,
      pendingFiles: stagedFiles,
      tokens: totalTokens,
    });
    if (notionWrote && s.notionPageId) {
      try { await appendTaskLog({ agentName, title, branch, repo: s.githubRepo }); } catch { /* best-effort */ }
    }
    return;
  }

  const didSomething = wroteFiles || notionWrote;
  emit({
    agentId,
    agentName,
    progress: 100,
    status: didSomething ? "review" : "idle",
    level: didSomething ? "SUCCESS" : "WARN",
    message: didSomething ? "Lavoro completato" : "Concluso senza modifiche — controlla strumenti/istruzioni",
    tokens: totalTokens,
  });

  if (repoEnabled && wroteFiles && s.openPRs) {
    try {
      const pr = await createPullRequest({
        branch,
        title,
        body: `Automated by SAMS agent **${agentName}** (Groq · ${groqModel()}).\n\n**Task:** ${title}\n\n_Branch \`${branch}\` → \`${s.baseBranch}\`._`,
      });
      emit({ agentId, agentName, level: "SUCCESS", message: `PR #${pr.number}: ${pr.html_url}` });
    } catch (err) {
      emit({ agentId, agentName, level: "WARN", message: `PR non creata: ${(err as Error).message}` });
    }
  }

  if (didSomething && notionEnabled && s.notionPageId) {
    try {
      await appendTaskLog({ agentName, title, branch, repo: s.githubRepo });
    } catch {
      /* logging is best-effort */
    }
  }
}
