/**
 * Provider-neutral agent tooling shared by the Gemini (agent.ts) and Groq
 * (groq.ts) loops. Both providers expose the same tool set and execute calls
 * identically; only the model-call primitive and the transcript shape differ.
 * This module owns the single source of truth for: tool specs, the per-provider
 * spec adapters, the tool dispatcher (executeTool) and the post-loop finalize.
 */
import type { Settings } from "./config";
import {
  commentOnPullRequest,
  createBranch,
  createIssue,
  createPullRequest,
  getWorkflowJobs,
  listCIRuns,
  triggerWorkflow,
  listFiles,
  listPullRequests,
  mergePullRequest,
  pullRequestStatus,
  readFile,
  readPullRequest,
  writeFile,
  writeFilesAtomic,
} from "./github";
import {
  appendTaskLog,
  appendToPageByTitle,
  createPage as notionCreatePage,
  readPageByTitle,
  replacePageByTitle,
} from "./notion";
import { setPending } from "./pendingBuffer";
import { db, listMemory, logTask, setMemory } from "./db";
import { emptyGarden, water } from "./garden/model";
import { getStore } from "./garden/store";
import type { PendingFile, WireEvent } from "./types";

// --- tunable limits (named, so both loops stay in sync) ---------------------
export const MAX_STEPS = 14;
export const PROGRESS_START = 10;
export const PROGRESS_CAP = 92;
export const PROGRESS_STEP = 7;
export const FILE_READ_LIMIT = 8000;
export const GUIDE_LIMIT = 2000;
export const WEB_FETCH_LIMIT = 6000;
export const WEB_FETCH_TIMEOUT_MS = 8000;
export const WEB_FETCH_MAX_BYTES = 2_000_000;
export const THOUGHT_LIMIT = 200;
export const COMMIT_MSG_LIMIT = 60;

// --- small string helpers ---------------------------------------------------
export function slugify(s: string): string {
  return (
    s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) ||
    "task"
  );
}
export function makeBranch(agentName: string, title: string): string {
  return `sams/${agentName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}/${slugify(title)}-${Date.now().toString(36)}`;
}
export function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
export function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : JSON.stringify(v);
}

// --- provider-neutral tool specs -------------------------------------------
export interface ToolSpec {
  name: string;
  description: string;
  schema: Record<string, unknown>;
}

/** Build the tool list for the configured capabilities (repo and/or Notion). */
export function buildToolSpecs(s: Settings, caps: { repoEnabled: boolean; notionEnabled: boolean }): ToolSpec[] {
  const specs: ToolSpec[] = [];
  if (caps.repoEnabled) {
    specs.push(
      {
        name: "gh_list_files",
        description: `Elenca i file in una cartella del repository (legge da '${s.baseBranch}').`,
        schema: { type: "object", properties: { path: { type: "string", description: "cartella, vuoto = root" } } },
      },
      {
        name: "gh_read_file",
        description: `Leggi un file del repository (legge da '${s.baseBranch}').`,
        schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
      },
      {
        name: "gh_write_file",
        description: "Crea o aggiorna UN file nel repository (commit su un branch dedicato). Per più file usa gh_write_files.",
        schema: {
          type: "object",
          properties: { path: { type: "string" }, content: { type: "string" }, message: { type: "string" } },
          required: ["path", "content"],
        },
      },
      {
        name: "gh_write_files",
        description: "Commit ATOMICO di più file in un'unica operazione (nessun commit parziale, nessun conflitto di sha). Preferire sempre questo a più chiamate gh_write_file consecutive.",
        schema: {
          type: "object",
          properties: {
            files: {
              type: "array",
              items: {
                type: "object",
                properties: { path: { type: "string" }, content: { type: "string" } },
                required: ["path", "content"],
              },
              description: "Lista di file da scrivere (path + contenuto testuale completo)",
            },
            message: { type: "string", description: "Messaggio di commit (conciso, descrive le modifiche)" },
          },
          required: ["files", "message"],
        },
      },
      {
        name: "gh_create_issue",
        description: "Apre una issue su GitHub (per segnalare bug, richiedere feature o documentare un problema trovato).",
        schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            body: { type: "string" },
            labels: { type: "array", items: { type: "string" } },
          },
          required: ["title", "body"],
        },
      },
      {
        name: "gh_list_prs",
        description: "Elenca le pull request aperte nel repository (numero, titolo, autore, branch).",
        schema: { type: "object", properties: {} },
      },
      {
        name: "gh_read_pr",
        description: "Leggi i dettagli di una pull request: titolo, descrizione, file modificati con conteggio delle righe.",
        schema: {
          type: "object",
          properties: { pr_number: { type: "number", description: "Numero della PR" } },
          required: ["pr_number"],
        },
      },
      {
        name: "gh_comment_pr",
        description: "Pubblica un commento su una pull request (revisione, feedback, osservazioni).",
        schema: {
          type: "object",
          properties: {
            pr_number: { type: "number", description: "Numero della PR" },
            body: { type: "string", description: "Testo del commento (markdown supportato)" },
          },
          required: ["pr_number", "body"],
        },
      },
      {
        name: "gh_pr_status",
        description: "Controlla se una PR è mergeable e lo stato dei check CI (per decidere se procedere).",
        schema: {
          type: "object",
          properties: { pr_number: { type: "number", description: "Numero della PR" } },
          required: ["pr_number"],
        },
      },
      {
        name: "gh_merge_pr",
        description: "Mergia una pull request (usare con cautela; controlla prima gh_pr_status).",
        schema: {
          type: "object",
          properties: {
            pr_number: { type: "number", description: "Numero della PR" },
            method: { type: "string", description: "merge | squash | rebase (default squash)" },
          },
          required: ["pr_number"],
        },
      },
      {
        name: "gh_list_ci",
        description: "Elenca gli ultimi run della CI (GitHub Actions) per un branch. Usa gh_ci_jobs per vedere i dettagli dei fallimenti.",
        schema: {
          type: "object",
          properties: { branch: { type: "string", description: "Branch da controllare (opzionale)" } },
        },
      },
      {
        name: "gh_ci_jobs",
        description: "Dettaglio job e step di un run CI (run_id da gh_list_ci). Mostra quali step sono falliti — utile per diagnosticare errori e correggere il codice.",
        schema: {
          type: "object",
          properties: { run_id: { type: "number", description: "ID del workflow run (dalla colonna id di gh_list_ci)" } },
          required: ["run_id"],
        },
      },
      {
        name: "gh_trigger_workflow",
        description: "Avvia manualmente un workflow CI (GitHub Actions workflow_dispatch) su un branch per eseguire i test o la build. Dopo l'avvio usa gh_list_ci per trovare il run_id e gh_ci_jobs per controllare i risultati.",
        schema: {
          type: "object",
          properties: {
            workflow: { type: "string", description: "Nome del file workflow (es. ci.yml) o ID numerico" },
            ref: { type: "string", description: "Branch su cui avviare il workflow" },
            inputs: { type: "object", description: "Input opzionali per il workflow (se previsti)" },
          },
          required: ["workflow", "ref"],
        },
      },
    );
  }
  if (caps.notionEnabled) {
    specs.push(
      {
        name: "notion_read",
        description:
          "Leggi il contenuto testuale di una pagina Notion (trovata per titolo). Usalo PRIMA di scrivere per evitare duplicati o per aggiornare contenuti esistenti.",
        schema: { type: "object", properties: { page_title: { type: "string" } }, required: ["page_title"] },
      },
      {
        name: "notion_write",
        description: "Aggiungi contenuto (markdown, anche blocchi ```lang) a una pagina Notion trovata per titolo.",
        schema: {
          type: "object",
          properties: { page_title: { type: "string" }, content: { type: "string" } },
          required: ["page_title", "content"],
        },
      },
      {
        name: "notion_create_page",
        description: "Crea una nuova pagina figlio Notion sotto la pagina trovata per titolo (parent_title).",
        schema: {
          type: "object",
          properties: {
            parent_title: { type: "string", description: "Titolo della pagina genitore (workspace o pagina esistente)" },
            title: { type: "string", description: "Titolo della nuova pagina" },
            content: { type: "string", description: "Contenuto markdown della nuova pagina" },
          },
          required: ["parent_title", "title", "content"],
        },
      },
      {
        name: "notion_replace_page",
        description:
          "Sostituisce TUTTO il contenuto di una pagina Notion (cancella i blocchi esistenti e riscrive con il nuovo contenuto). Usa con cautela.",
        schema: {
          type: "object",
          properties: {
            page_title: { type: "string" },
            content: { type: "string", description: "Nuovo contenuto markdown completo" },
          },
          required: ["page_title", "content"],
        },
      },
    );
  }
  specs.push(
    {
      name: "remember",
      description: "Salva un'informazione persistente nella tua memoria di progetto (sopravvive tra i task). Usa chiavi brevi (es: 'architettura', 'convenzioni', 'branch-corrente').",
      schema: {
        type: "object",
        properties: {
          key: { type: "string", description: "Chiave breve identificativa (max 100 caratteri)" },
          value: { type: "string", description: "Informazione da memorizzare (max 2000 caratteri)" },
        },
        required: ["key", "value"],
      },
    },
    {
      name: "recall",
      description: "Leggi le tue memorie di progetto persistenti (salvate con 'remember' nei task precedenti).",
      schema: { type: "object", properties: {} },
    },
    {
      name: "announce_plan",
      description:
        "Chiama SUBITO all'inizio, prima di qualsiasi altra azione, per dichiarare i passi del tuo piano (4–6 voci). Aiuta l'utente a seguire il progresso.",
      schema: {
        type: "object",
        properties: {
          steps: { type: "array", items: { type: "string" }, description: "Lista di passi del piano (4–6 voci brevi)" },
        },
        required: ["steps"],
      },
    },
    {
      name: "web_fetch",
      description:
        "Scarica il contenuto testuale di una URL (documentazione, API, pagine web) utile per il task. Ritorna fino a 6000 caratteri di testo leggibile.",
      schema: {
        type: "object",
        properties: { url: { type: "string", description: "URL da scaricare (deve iniziare con https://)" } },
        required: ["url"],
      },
    },
    {
      name: "relay_task",
      description:
        "Delega la continuazione del task a un altro agente SAMS specificando il ruolo (Tester/Revisore/Documentatore/Architetto) o il nome. Chiama done subito dopo.",
      schema: {
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
    {
      name: "done",
      description: "Chiama quando il task è completato (o se non puoi completarlo).",
      schema: { type: "object", properties: { summary: { type: "string" } }, required: ["summary"] },
    },
  );
  return specs;
}

/** Adapter: provider-neutral specs → Gemini FunctionDeclaration[]. */
export function toGeminiDecls(specs: ToolSpec[]) {
  return specs.map((t) => ({ name: t.name, description: t.description, parametersJsonSchema: t.schema }));
}

/** Adapter: provider-neutral specs → Groq/OpenAI tool[]. */
export function toGroqTools(specs: ToolSpec[]) {
  return specs.map((t) => ({
    type: "function" as const,
    function: { name: t.name, description: t.description, parameters: t.schema },
  }));
}

// --- shared dispatcher ------------------------------------------------------
/** Mutable per-task state + immutable context, shared across tool calls. */
export interface ToolContext {
  s: Settings;
  agentId: string;
  agentName: string;
  title: string;
  branch: string;
  requireApproval: boolean;
  emit: (e: WireEvent) => void;
  // mutable accumulators
  wroteFiles: boolean;
  notionWrote: boolean;
  branchReady: boolean;
  doneSummary: string;
  finished: boolean;
  progress: number;
  stagedFiles: PendingFile[];
}

/** Fetch a URL's readable text, with size/ok guards. Returns a tool-result string. */
async function fetchUrlText(url: string): Promise<string> {
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return "ERRORE: URL non valida — deve iniziare con https://";
  }
  const httpResp = await fetch(url, {
    signal: AbortSignal.timeout(WEB_FETCH_TIMEOUT_MS),
    headers: { "User-Agent": "SAMS-Agent/1.0" },
  });
  if (!httpResp.ok) return `ERRORE: HTTP ${httpResp.status} su ${url.slice(0, 70)}`;
  const declared = Number(httpResp.headers.get("content-length") ?? "0");
  if (declared > WEB_FETCH_MAX_BYTES) {
    return `ERRORE: risposta troppo grande (${Math.round(declared / 1000)} kB, max ${WEB_FETCH_MAX_BYTES / 1000} kB)`;
  }
  const raw = await httpResp.text();
  const ct = httpResp.headers.get("content-type") ?? "";

  if (!ct.includes("html")) return truncate(raw, WEB_FETCH_LIMIT);

  // Extract page title for context
  const titleMatch = raw.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
  const pageTitle = titleMatch ? titleMatch[1].trim() : "";

  // Strip scripts, styles, then all tags; decode common entities
  const ENTITIES: Record<string, string> = { "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };
  const bodyText = raw
    .replace(/<(script|style|nav|header|footer|aside)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:nbsp|amp|lt|gt|quot|#39);/g, (m) => ENTITIES[m] ?? m)
    .replace(/\s+/g, " ")
    .trim();

  const content = pageTitle ? `[${pageTitle}]\n\n${bodyText}` : bodyText;
  return truncate(content, WEB_FETCH_LIMIT);
}

/**
 * Execute a single tool call, mutating `ctx` and returning the result string to
 * feed back to the model. Errors are caught and returned as `ERRORE: …` (and
 * surfaced as a WARN) so a single failing tool never aborts the whole loop.
 */
export async function executeTool(name: string, args: Record<string, unknown>, ctx: ToolContext): Promise<string> {
  const { s, agentId, agentName, emit } = ctx;
  ctx.progress = Math.min(PROGRESS_CAP, ctx.progress + PROGRESS_STEP);
  const progress = ctx.progress;
  let result = "ok";
  try {
    if (name === "gh_list_files") {
      result = (await listFiles(str(args.path), s.baseBranch)).join("\n") || "(vuoto)";
      emit({ agentId, agentName, progress, level: "INFO", message: `ls ${str(args.path) || "/"}` });
    } else if (name === "gh_read_file") {
      result = truncate(await readFile(str(args.path), s.baseBranch), FILE_READ_LIMIT);
      emit({ agentId, agentName, progress, level: "INFO", message: `read ${str(args.path)}` });
    } else if (name === "gh_write_file") {
      const filePath = str(args.path);
      const fileContent = str(args.content);
      const fileMessage = str(args.message) || `SAMS: ${truncate(ctx.title, COMMIT_MSG_LIMIT)}`;
      if (ctx.requireApproval) {
        ctx.stagedFiles.push({ path: filePath, content: fileContent, message: fileMessage });
        emit({ agentId, agentName, progress, level: "INFO", message: `staged ${filePath}` });
      } else {
        if (!ctx.branchReady) {
          await createBranch(ctx.branch, s.baseBranch);
          ctx.branchReady = true;
          emit({ agentId, agentName, level: "INFO", message: `Branch ${ctx.branch} creato` });
        }
        await writeFile(filePath, fileContent, ctx.branch, fileMessage);
        ctx.wroteFiles = true;
        emit({ agentId, agentName, progress, level: "SUCCESS", message: `write ${filePath}` });
      }
    } else if (name === "gh_write_files") {
      const rawFiles = Array.isArray(args.files) ? args.files as Array<Record<string, unknown>> : [];
      const files = rawFiles
        .filter((f) => typeof f.path === "string" && typeof f.content === "string")
        .map((f) => ({ path: str(f.path), content: str(f.content) }));
      if (files.length === 0) {
        result = "ERRORE: nessun file valido nella lista";
      } else {
        const commitMsg = str(args.message) || `SAMS: ${truncate(ctx.title, COMMIT_MSG_LIMIT)}`;
        if (ctx.requireApproval) {
          for (const f of files) ctx.stagedFiles.push({ path: f.path, content: f.content, message: commitMsg });
          emit({ agentId, agentName, progress, level: "INFO", message: `staged ${files.length} file (atomic)` });
          result = `${files.length} file staged per approvazione`;
        } else {
          if (!ctx.branchReady) {
            await createBranch(ctx.branch, s.baseBranch);
            ctx.branchReady = true;
            emit({ agentId, agentName, level: "INFO", message: `Branch ${ctx.branch} creato` });
          }
          await writeFilesAtomic(files, ctx.branch, commitMsg);
          ctx.wroteFiles = true;
          emit({ agentId, agentName, progress, level: "SUCCESS", message: `write atomico: ${files.map((f) => f.path).join(", ")}` });
          result = `${files.length} file committati atomicamente su ${ctx.branch}`;
        }
      }
    } else if (name === "gh_create_issue") {
      const issue = await createIssue(
        str(args.title),
        str(args.body),
        Array.isArray(args.labels) ? (args.labels as unknown[]).map(String) : [],
      );
      result = `Issue #${issue.number}: ${issue.html_url}`;
      emit({ agentId, agentName, progress, level: "SUCCESS", message: `Issue #${issue.number} aperta` });
    } else if (name === "gh_list_prs") {
      result = await listPullRequests();
      emit({ agentId, agentName, progress, level: "INFO", message: `PR elencate` });
    } else if (name === "gh_read_pr") {
      const prNum = Number(args.pr_number);
      if (!Number.isFinite(prNum)) return "ERRORE: pr_number non valido";
      result = await readPullRequest(prNum);
      emit({ agentId, agentName, progress, level: "INFO", message: `PR #${prNum} letta` });
    } else if (name === "gh_comment_pr") {
      const prNum = Number(args.pr_number);
      if (!Number.isFinite(prNum)) return "ERRORE: pr_number non valido";
      const comment = await commentOnPullRequest(prNum, str(args.body));
      result = `Commento pubblicato: ${comment.html_url}`;
      emit({ agentId, agentName, progress, level: "SUCCESS", message: `Commento su PR #${prNum}` });
    } else if (name === "gh_pr_status") {
      const prNum = Number(args.pr_number);
      if (!Number.isFinite(prNum)) return "ERRORE: pr_number non valido";
      result = await pullRequestStatus(prNum);
      emit({ agentId, agentName, progress, level: "INFO", message: `Stato PR #${prNum}` });
    } else if (name === "gh_merge_pr") {
      const prNum = Number(args.pr_number);
      if (!Number.isFinite(prNum)) return "ERRORE: pr_number non valido";
      const method = ["merge", "squash", "rebase"].includes(str(args.method)) ? (str(args.method) as "merge" | "squash" | "rebase") : "squash";
      result = await mergePullRequest(prNum, method);
      emit({ agentId, agentName, progress, level: "SUCCESS", message: `Merge PR #${prNum} (${method})` });
    } else if (name === "gh_list_ci") {
      result = await listCIRuns(str(args.branch) || undefined);
      emit({ agentId, agentName, progress, level: "INFO", message: `CI run elencati` });
    } else if (name === "gh_trigger_workflow") {
      const wf = str(args.workflow);
      const ref = str(args.ref);
      if (!wf || !ref) { result = "ERRORE: workflow e ref sono obbligatori"; }
      else {
        const inputs = args.inputs && typeof args.inputs === "object" && !Array.isArray(args.inputs)
          ? (args.inputs as Record<string, string>)
          : undefined;
        result = await triggerWorkflow(wf, ref, inputs);
        emit({ agentId, agentName, progress, level: "INFO", message: `Workflow "${wf}" avviato su ${ref}` });
      }
    } else if (name === "gh_ci_jobs") {
      const runId = Number(args.run_id);
      if (!Number.isFinite(runId) || runId <= 0) { result = "ERRORE: run_id non valido"; }
      else {
        result = await getWorkflowJobs(runId);
        emit({ agentId, agentName, progress, level: "INFO", message: `Job CI run #${runId}` });
      }
    } else if (name === "notion_read") {
      const { title: resolved, text } = await readPageByTitle(str(args.page_title));
      result = text;
      emit({ agentId, agentName, progress, level: "INFO", message: `Notion → letta "${resolved}"` });
    } else if (name === "notion_write") {
      const resolved = await appendToPageByTitle(str(args.page_title), str(args.content));
      ctx.notionWrote = true;
      result = `scritto sulla pagina "${resolved}"`;
      emit({ agentId, agentName, progress, level: "SUCCESS", message: `Notion ← "${resolved}"` });
    } else if (name === "notion_create_page") {
      const created = await notionCreatePage(str(args.parent_title), str(args.title), str(args.content));
      ctx.notionWrote = true;
      result = `Pagina "${str(args.title)}" creata: ${created.url}`;
      emit({ agentId, agentName, progress, level: "SUCCESS", message: `Notion: nuova pagina "${str(args.title)}"` });
    } else if (name === "notion_replace_page") {
      const replaced = await replacePageByTitle(str(args.page_title), str(args.content));
      ctx.notionWrote = true;
      result = `Pagina "${replaced}" sostituita`;
      emit({ agentId, agentName, progress, level: "SUCCESS", message: `Notion ↺ "${replaced}"` });
    } else if (name === "remember") {
      const key = str(args.key);
      const value = str(args.value);
      if (!key) { result = "ERRORE: key è obbligatoria"; }
      else {
        setMemory(db(), agentId, key, value);
        result = `Memorizzato: "${key}"`;
        emit({ agentId, agentName, progress, level: "INFO", message: `🧠 Memoria salvata: "${key}"` });
      }
    } else if (name === "recall") {
      const memories = listMemory(db(), agentId);
      if (!memories.length) {
        result = "Nessuna memoria salvata";
      } else {
        result = memories.map((m) => `[${m.key}]: ${m.value}`).join("\n\n");
        emit({ agentId, agentName, progress, level: "INFO", message: `🧠 Ricordati ${memories.length} memorie` });
      }
    } else if (name === "announce_plan") {
      const steps = Array.isArray(args.steps) ? (args.steps as unknown[]).map(String) : [];
      result = "Piano ricevuto";
      emit({
        agentId, agentName, plan: steps, level: "INFO",
        message: `📋 Piano (${steps.length} passi): ${steps.slice(0, 3).join(" → ")}${steps.length > 3 ? " …" : ""}`,
      });
    } else if (name === "web_fetch") {
      const url = str(args.url);
      result = await fetchUrlText(url);
      if (!result.startsWith("ERRORE:")) {
        emit({ agentId, agentName, progress, level: "INFO", message: `fetch ${url.slice(0, 70)}` });
      }
    } else if (name === "relay_task") {
      const relayTarget = str(args.target);
      const relayTitle = str(args.title);
      const relayBranch = str(args.branch) || ctx.branch;
      const relayCtx = str(args.context);
      result = `Relay inviato a "${relayTarget}": ${relayTitle}`;
      emit({
        agentId, agentName, progress, level: "SUCCESS",
        message: `→ Relay a ${relayTarget}: ${relayTitle}`,
        relayTo: { target: relayTarget, title: relayTitle, branch: relayBranch, context: relayCtx },
      });
    } else if (name === "done") {
      ctx.doneSummary = str(args.summary);
      ctx.finished = true;
    } else {
      result = `strumento sconosciuto: ${name}`;
    }
  } catch (err) {
    result = `ERRORE: ${(err as Error).message}`;
    emit({ agentId, agentName, level: "WARN", message: `${name}: ${(err as Error).message}` });
  }
  return result;
}

/** Water the SAMS garden for a given agent (1 watering per completed task). Best-effort. */
async function waterAgentGarden(agentName: string): Promise<void> {
  const store = getStore();
  const user = `sams-${agentName.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`;
  const today = new Date().toISOString().slice(0, 10);
  const prev = (await store.get(user)) ?? emptyGarden(user);
  await store.put(water(prev, 1, new Date().toISOString(), today));
}

/**
 * Shared post-loop wrap-up: emit the summary, either pause for approval (when
 * files were staged) or emit the final status, open a PR if files were pushed,
 * and append the Notion task-log. `prProviderLabel` distinguishes Gemini/Groq
 * in the PR body.
 */
export async function finalizeTask(
  ctx: ToolContext,
  opts: { totalTokens: number; repoEnabled: boolean; notionEnabled: boolean; prProviderLabel: string },
): Promise<void> {
  const { s, agentId, agentName, emit } = ctx;
  if (ctx.doneSummary) emit({ agentId, agentName, level: "INFO", message: truncate(ctx.doneSummary, THOUGHT_LIMIT) });

  if (ctx.requireApproval && ctx.stagedFiles.length > 0) {
    setPending(agentId, { branch: ctx.branch, title: ctx.title, agentName, files: ctx.stagedFiles });
    emit({
      agentId, agentName,
      status: "awaiting_approval",
      progress: 100,
      level: "WARN",
      message: `${ctx.stagedFiles.length} file${ctx.stagedFiles.length > 1 ? " pronti" : " pronto"} — approva o rifiuta nel pannello`,
      pendingFiles: ctx.stagedFiles,
      tokens: opts.totalTokens,
    });
    if (ctx.notionWrote && s.notionPageId) {
      try { await appendTaskLog({ agentName, title: ctx.title, branch: ctx.branch, repo: s.githubRepo }); } catch { /* best-effort */ }
    }
    return;
  }

  const didSomething = ctx.wroteFiles || ctx.notionWrote;
  emit({
    agentId, agentName,
    progress: 100,
    status: didSomething ? "review" : "idle",
    level: didSomething ? "SUCCESS" : "WARN",
    message: didSomething ? "Lavoro completato" : "Concluso senza modifiche — controlla strumenti/istruzioni",
    tokens: opts.totalTokens,
  });

  // Task completato → annaffia il giardino dell'agente (collega il lavoro reale alla simulazione).
  if (didSomething) {
    waterAgentGarden(agentName).catch(() => {});
  }

  logTask({
    agentId, agentName,
    title: ctx.title,
    branch: ctx.branch,
    status: didSomething ? "review" : "idle",
    tokens: opts.totalTokens,
    ts: Date.now(),
  });

  if (opts.repoEnabled && ctx.wroteFiles && s.openPRs) {
    try {
      const pr = await createPullRequest({
        branch: ctx.branch,
        title: ctx.title,
        body: `Automated by SAMS agent **${agentName}** (${opts.prProviderLabel}).\n\n**Task:** ${ctx.title}\n\n_Branch \`${ctx.branch}\` → \`${s.baseBranch}\`._`,
      });
      emit({ agentId, agentName, level: "SUCCESS", message: `PR #${pr.number}: ${pr.html_url}` });
    } catch (err) {
      emit({ agentId, agentName, level: "WARN", message: `PR non creata: ${(err as Error).message}` });
    }
  }

  if (didSomething && opts.notionEnabled && s.notionPageId) {
    try {
      await appendTaskLog({ agentName, title: ctx.title, branch: ctx.branch, repo: s.githubRepo });
    } catch {
      /* logging is best-effort */
    }
  }
}
