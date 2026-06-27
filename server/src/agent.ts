import type { Content, FunctionDeclaration, Part } from "@google/genai";
import { geminiModel, generateWithRetry, usageTokens } from "./gemini";
import { getSettings } from "./config";
import { createBranch, createPullRequest, listFiles, readFile, writeFile } from "./github";
import { appendTaskLog, appendToPageByTitle, notionConfigured, readPageByTitle } from "./notion";
import type { AssignBody, WireEvent } from "./types";

function slugify(s: string): string {
  return (
    s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) ||
    "task"
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

/** Files an agent reads (in order) for project-specific guidelines, if present. */
const GUIDE_FILES = ["AGENTS.md", "CONVENTIONS.md", ".sams/guide.md", "SAMS_GUIDE.md"];

/** Read the first project-guide file that exists on the base branch ("" if none). */
async function loadProjectGuide(baseBranch: string): Promise<string> {
  for (const f of GUIDE_FILES) {
    try {
      const c = await readFile(f, baseBranch);
      if (c && c.trim()) return truncate(c, 2000);
    } catch {
      /* not found — try the next candidate */
    }
  }
  return "";
}

/**
 * Extra instructions injected per role. Roles not listed here get no extra text
 * (the base instruction is already enough for a generic developer).
 */
const ROLE_PROMPTS: Record<string, string> = {
  Revisore:
    "Ruolo REVISORE: leggi i file con gh_read_file, individua problemi (bug, stile, sicurezza, performance) e documenta le osservazioni su Notion con notion_write. Non modificare file di codice.",
  Tester:
    "Ruolo TESTER: leggi il codice esistente con gh_read_file, poi scrivi file di test con gh_write_file seguendo le convenzioni di test già presenti nel repository.",
  Documentatore:
    "Ruolo DOCUMENTATORE: scrivi documentazione chiara e completa. Usa notion_write per le pagine Notion, gh_write_file per README o file .md. Leggi il sorgente con gh_read_file prima di documentare.",
  Architetto:
    "Ruolo ARCHITETTO: analizza la struttura del progetto con gh_list_files e gh_read_file, poi scrivi un documento di analisi o un piano architetturale su Notion o come file .md nel repository.",
};

/** Build the Gemini system instruction from the configured tools + optional role and guide. */
export function composeSystem(o: {
  agentName: string;
  notionEnabled: boolean;
  repoEnabled: boolean;
  role?: string;
  guide?: string;
}): string {
  const base =
    `Sei "${o.agentName}", un agente operativo. Esegui il task in modo mirato e di alta qualità, scrivendo in italiano. ` +
    (o.notionEnabled
      ? `Per Notion: leggi con notion_read e scrivi SOLO con notion_write (trova la pagina per titolo); leggi prima di scrivere per evitare duplicati. `
      : `Notion non è configurato: non puoi scrivere su Notion. `) +
    (o.repoEnabled
      ? `Per i file di codice del repository usa gli strumenti gh_*. `
      : `Il repository GitHub non è configurato: non puoi usare strumenti gh_*. `) +
    `Usa solo lo strumento pertinente al task (un task "su Notion" usa notion_write, non gli strumenti gh_*). ` +
    `Se non hai lo strumento adatto, spiega il problema e chiama done. Quando hai finito chiama done con un breve riassunto. Non chiedere conferme.`;
  const roleExtra = o.role ? (ROLE_PROMPTS[o.role] ?? "") : "";
  const g = o.guide?.trim();
  const parts = [base];
  if (roleExtra) parts.push(roleExtra);
  if (g) parts.push(`Linee guida del progetto (rispettale scrupolosamente):\n${g}`);
  return parts.join("\n\n");
}

/**
 * Self-hosted agent loop powered by Gemini (free tier). The model reasons and
 * calls tools (GitHub Contents API + Notion API); the runtime executes them and
 * streams progress to the SAMS UI. GitHub is lazy: reads hit the base branch and
 * the work branch is created only on the first write — so a Notion-only task
 * never touches GitHub.
 */
export async function runGeminiTask(body: AssignBody, emit: (e: WireEvent) => void): Promise<void> {
  const s = getSettings();
  const agentId = body.agentId;
  const agentName = body.agentName || body.agentId;
  const title = body.title;

  const repoEnabled = s.githubToken.length > 0 && s.githubRepo.includes("/");
  const notionEnabled = notionConfigured();
  const branch = body.branch?.trim() || makeBranch(agentName, title);
  const role = body.role?.trim() || "";

  emit({ agentId, agentName, status: "working", progress: 6, level: "INFO", message: `Avvio · Gemini (${geminiModel()})` });

  if (!repoEnabled && !notionEnabled) {
    emit({ agentId, agentName, status: "blocked", level: "ERROR", message: "Nessuno strumento configurato: aggiungi un token GitHub e/o Notion in ⚙." });
    return;
  }

  // --- tool declarations (only what's configured) ---------------------------
  const decls: FunctionDeclaration[] = [];
  if (repoEnabled) {
    decls.push(
      {
        name: "gh_list_files",
        description: `Elenca i file in una cartella del repository (legge da '${s.baseBranch}').`,
        parametersJsonSchema: { type: "object", properties: { path: { type: "string", description: "cartella, vuoto = root" } } },
      },
      {
        name: "gh_read_file",
        description: `Leggi un file del repository (legge da '${s.baseBranch}').`,
        parametersJsonSchema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
      },
      {
        name: "gh_write_file",
        description: "Crea o aggiorna un file nel repository (commit su un branch dedicato, poi PR).",
        parametersJsonSchema: {
          type: "object",
          properties: { path: { type: "string" }, content: { type: "string" }, message: { type: "string" } },
          required: ["path", "content"],
        },
      },
    );
  }
  if (notionEnabled) {
    decls.push(
      {
        name: "notion_read",
        description: "Leggi il contenuto testuale di una pagina Notion (trovata per titolo). Usalo PRIMA di scrivere per evitare duplicati o per aggiornare contenuti esistenti.",
        parametersJsonSchema: {
          type: "object",
          properties: { page_title: { type: "string" } },
          required: ["page_title"],
        },
      },
      {
        name: "notion_write",
        description: "Aggiungi contenuto (markdown, anche blocchi ```lang) a una pagina Notion trovata per titolo.",
        parametersJsonSchema: {
          type: "object",
          properties: { page_title: { type: "string" }, content: { type: "string" } },
          required: ["page_title", "content"],
        },
      },
    );
  }
  decls.push({
    name: "done",
    description: "Chiama quando il task è completato (o se non puoi completarlo).",
    parametersJsonSchema: { type: "object", properties: { summary: { type: "string" } }, required: ["summary"] },
  });

  // load optional project guidelines (AGENTS.md / CONVENTIONS.md / …) so the
  // agent follows the repo's conventions — a no-op if no such file exists.
  let guide = "";
  if (repoEnabled) {
    guide = await loadProjectGuide(s.baseBranch);
    if (guide) emit({ agentId, agentName, level: "INFO", message: "Linee guida del progetto caricate" });
  }
  const system = composeSystem({ agentName, notionEnabled, repoEnabled, role, guide });

  let wroteFiles = false;
  let notionWrote = false;
  let branchReady = false;
  let doneSummary = "";
  let progress = 10;
  let totalTokens = 0;

  const contents: Content[] = [{ role: "user", parts: [{ text: `Task: ${title}` }] }];

  for (let step = 0; step < 14; step++) {
    const resp = await generateWithRetry(
      {
        model: geminiModel(),
        contents,
        config: { systemInstruction: system, tools: [{ functionDeclarations: decls }], temperature: 0.4 },
      },
      (n, waitMs) =>
        emit({ agentId, agentName, level: "WARN", message: `Gemini occupato, riprovo (${n}) tra ${Math.round(waitMs / 1000)}s…` }),
    );
    totalTokens += usageTokens(resp);

    const calls = resp.functionCalls ?? [];
    if (calls.length === 0) {
      doneSummary = resp.text ?? "";
      break;
    }

    contents.push({ role: "model", parts: calls.map((c) => ({ functionCall: c })) });

    const responseParts: Part[] = [];
    let finished = false;
    for (const call of calls) {
      const name = call.name ?? "";
      const args = (call.args ?? {}) as Record<string, unknown>;
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
          if (!branchReady) {
            await createBranch(branch, s.baseBranch);
            branchReady = true;
            emit({ agentId, agentName, level: "INFO", message: `Branch ${branch} creato` });
          }
          await writeFile(str(args.path), str(args.content), branch, str(args.message) || `SAMS: ${truncate(title, 60)}`);
          wroteFiles = true;
          emit({ agentId, agentName, progress, level: "SUCCESS", message: `write ${str(args.path)}` });
        } else if (name === "notion_read") {
          const { title: resolved, text } = await readPageByTitle(str(args.page_title));
          result = text;
          emit({ agentId, agentName, progress, level: "INFO", message: `Notion → letta "${resolved}"` });
        } else if (name === "notion_write") {
          const resolved = await appendToPageByTitle(str(args.page_title), str(args.content));
          notionWrote = true;
          result = `scritto sulla pagina "${resolved}"`;
          emit({ agentId, agentName, progress, level: "SUCCESS", message: `Notion ← "${resolved}"` });
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
      responseParts.push({ functionResponse: { name, response: { result } } });
    }

    contents.push({ role: "user", parts: responseParts });
    if (finished) break;
  }

  if (doneSummary) emit({ agentId, agentName, level: "INFO", message: truncate(doneSummary, 200) });

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
        body: `Automated by SAMS agent **${agentName}** (Gemini).\n\n**Task:** ${title}\n\n_Branch \`${branch}\` → \`${s.baseBranch}\`._`,
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
