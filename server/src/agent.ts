import type { Content, FunctionDeclaration, Part } from "@google/genai";
import { getGemini, geminiModel } from "./gemini";
import { getSettings } from "./config";
import { createBranch, createPullRequest, listFiles, readFile, writeFile } from "./github";
import { appendTaskLog, appendToPageByTitle, notionConfigured } from "./notion";
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

/**
 * Self-hosted agent loop powered by Gemini (free tier). The model reasons and
 * calls tools (GitHub Contents API + Notion API); the runtime executes them and
 * streams progress back to the SAMS UI. No local git, no sandbox — all HTTP.
 */
export async function runGeminiTask(body: AssignBody, emit: (e: WireEvent) => void): Promise<void> {
  const s = getSettings();
  const agentId = body.agentId;
  const agentName = body.agentName || body.agentId;
  const title = body.title;

  const repoEnabled = s.githubToken.length > 0 && s.githubRepo.includes("/");
  const notionEnabled = notionConfigured();
  const branch = body.branch?.trim() || makeBranch(agentName, title);

  emit({ agentId, agentName, status: "working", progress: 4, level: "INFO", message: `Avvio · Gemini (${geminiModel()})` });

  if (repoEnabled) {
    try {
      await createBranch(branch, s.baseBranch);
      emit({ agentId, agentName, level: "INFO", message: `Branch ${branch} pronto su ${s.githubRepo}` });
    } catch (err) {
      emit({ agentId, agentName, level: "WARN", message: `Branch non creato: ${(err as Error).message}` });
    }
  }

  // --- tool declarations (only what's configured) ---------------------------
  const decls: FunctionDeclaration[] = [];
  if (repoEnabled) {
    decls.push(
      {
        name: "gh_list_files",
        description: "Elenca i file in una cartella del repository.",
        parametersJsonSchema: { type: "object", properties: { path: { type: "string", description: "cartella, vuoto = root" } } },
      },
      {
        name: "gh_read_file",
        description: "Leggi il contenuto di un file del repository.",
        parametersJsonSchema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
      },
      {
        name: "gh_write_file",
        description: "Crea o sovrascrivi un file nel repository (commit sul branch di lavoro).",
        parametersJsonSchema: {
          type: "object",
          properties: { path: { type: "string" }, content: { type: "string" }, message: { type: "string", description: "messaggio di commit" } },
          required: ["path", "content"],
        },
      },
    );
  }
  if (notionEnabled) {
    decls.push({
      name: "notion_write",
      description: "Aggiungi contenuto (markdown, anche blocchi di codice ```lang) a una pagina Notion individuata per titolo.",
      parametersJsonSchema: {
        type: "object",
        properties: { page_title: { type: "string" }, content: { type: "string", description: "markdown da inserire" } },
        required: ["page_title", "content"],
      },
    });
  }
  decls.push({
    name: "done",
    description: "Chiama quando il task è completato.",
    parametersJsonSchema: { type: "object", properties: { summary: { type: "string" } }, required: ["summary"] },
  });

  const system =
    `Sei "${agentName}", un agente operativo della knowledge base/progetto dell'utente. ` +
    `Esegui il task in modo mirato e di alta qualità, scrivendo in italiano (se non diversamente indicato). ` +
    (repoEnabled ? `Per il codice usa gli strumenti gh_* (branch di lavoro: ${branch}). ` : ``) +
    (notionEnabled ? `Per scrivere su Notion usa notion_write (trova la pagina per titolo). ` : ``) +
    `Quando hai finito chiama done con un breve riassunto. Non chiedere conferme.`;

  let wroteFiles = false;
  let doneSummary = "";
  let progress = 8;

  const contents: Content[] = [{ role: "user", parts: [{ text: `Task: ${title}` }] }];
  const ai = getGemini();

  for (let step = 0; step < 14; step++) {
    const resp = await ai.models.generateContent({
      model: geminiModel(),
      contents,
      config: { systemInstruction: system, tools: [{ functionDeclarations: decls }], temperature: 0.4 },
    });

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
          result = (await listFiles(str(args.path), branch)).join("\n") || "(vuoto)";
          emit({ agentId, agentName, progress, level: "INFO", message: `ls ${str(args.path) || "/"}` });
        } else if (name === "gh_read_file") {
          result = truncate(await readFile(str(args.path), branch), 8000);
          emit({ agentId, agentName, progress, level: "INFO", message: `read ${str(args.path)}` });
        } else if (name === "gh_write_file") {
          await writeFile(str(args.path), str(args.content), branch, str(args.message) || `SAMS: ${truncate(title, 60)}`);
          wroteFiles = true;
          emit({ agentId, agentName, progress, level: "SUCCESS", message: `write ${str(args.path)}` });
        } else if (name === "notion_write") {
          const resolved = await appendToPageByTitle(str(args.page_title), str(args.content));
          emit({ agentId, agentName, progress, level: "SUCCESS", message: `Notion ← "${resolved}"` });
          result = `scritto sulla pagina "${resolved}"`;
        } else if (name === "done") {
          doneSummary = str(args.summary);
          finished = true;
          result = "ok";
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

  if (doneSummary) emit({ agentId, agentName, level: "INFO", message: truncate(doneSummary, 180) });
  emit({ agentId, agentName, progress: 100, status: "review", level: "SUCCESS", message: "Lavoro completato" });

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

  if (notionEnabled && s.notionPageId) {
    try {
      await appendTaskLog({ agentName, title, branch, repo: s.githubRepo });
    } catch {
      /* logging is best-effort */
    }
  }
}
