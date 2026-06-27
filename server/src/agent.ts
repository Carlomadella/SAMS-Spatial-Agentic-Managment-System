import type { Content, FunctionDeclaration, Part } from "@google/genai";
import { geminiModel, generateWithRetryStream } from "./gemini";
import { getSettings } from "./config";
import { readFile } from "./github";
import { notionConfigured } from "./notion";
import type { AssignBody, WireEvent } from "./types";
import {
  GUIDE_LIMIT,
  MAX_STEPS,
  PROGRESS_START,
  THOUGHT_LIMIT,
  buildToolSpecs,
  executeTool,
  finalizeTask,
  makeBranch,
  toGeminiDecls,
  truncate,
  type ToolContext,
} from "./agentTools";

/** Files an agent reads (in order) for project-specific guidelines, if present. */
const GUIDE_FILES = ["AGENTS.md", "CONVENTIONS.md", ".sams/guide.md", "SAMS_GUIDE.md"];

/** Read the first project-guide file that exists on the base branch ("" if none). */
export async function loadProjectGuide(baseBranch: string): Promise<string> {
  for (const f of GUIDE_FILES) {
    try {
      const c = await readFile(f, baseBranch);
      if (c && c.trim()) return truncate(c, GUIDE_LIMIT);
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

/** Build the Gemini system instruction from the configured tools + optional role, user instructions and guide. */
export function composeSystem(o: {
  agentName: string;
  notionEnabled: boolean;
  repoEnabled: boolean;
  relayEnabled?: boolean;
  role?: string;
  instructions?: string;
  guide?: string;
}): string {
  const base =
    `Sei "${o.agentName}", un agente operativo. Prima di qualsiasi altra azione chiama SEMPRE announce_plan con 4–6 passi che descrivono come intendi procedere. Poi esegui il piano passo dopo passo con precisione e alta qualità, scrivendo in italiano. ` +
    (o.notionEnabled
      ? `Per Notion: leggi con notion_read e scrivi SOLO con notion_write (trova la pagina per titolo); leggi prima di scrivere per evitare duplicati. `
      : `Notion non è configurato: non puoi scrivere su Notion. `) +
    (o.repoEnabled
      ? `Per i file di codice del repository usa gli strumenti gh_*. Dopo ogni gh_write_file su file di codice, leggi con gh_read_file i file di test correlati (*.test.ts, *.spec.ts, directory __tests__/) e verifica mentalmente che la tua implementazione li superi; se trovi discrepanze, correggi prima di chiamare done. `
      : `Il repository GitHub non è configurato: non puoi usare strumenti gh_*. `) +
    (o.relayEnabled
      ? `Se un altro agente deve continuare il lavoro (es: il Revisore revisioni il codice, il Tester scriva i test), usa relay_task specificando il ruolo (Tester/Revisore/Documentatore/Architetto) o nome dell'agente, poi chiama done. `
      : ``) +
    `Usa solo lo strumento pertinente al task (un task "su Notion" usa notion_write, non gli strumenti gh_*). ` +
    `Se non hai lo strumento adatto, spiega il problema e chiama done. Quando hai finito chiama done con un breve riassunto. Non chiedere conferme.`;
  const userInstr = o.instructions?.trim();
  const roleExtra = o.role ? (ROLE_PROMPTS[o.role] ?? "") : "";
  const g = o.guide?.trim();
  const parts = [base];
  if (userInstr) parts.push(`Istruzioni specifiche per questo agente (hanno la priorità su tutto il resto):\n${userInstr}`);
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
  const instructions = body.instructions?.trim() || "";
  const requireApproval = s.requireApproval;

  emit({ agentId, agentName, status: "working", progress: 6, level: "INFO", message: `Avvio · Gemini (${geminiModel()})` });

  if (!repoEnabled && !notionEnabled) {
    emit({ agentId, agentName, status: "blocked", level: "ERROR", message: "Nessuno strumento configurato: aggiungi un token GitHub e/o Notion in ⚙." });
    return;
  }

  const decls = toGeminiDecls(buildToolSpecs(s, { repoEnabled, notionEnabled })) as FunctionDeclaration[];

  // load optional project guidelines (AGENTS.md / CONVENTIONS.md / …) so the
  // agent follows the repo's conventions — a no-op if no such file exists.
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

  const contents: Content[] = [{ role: "user", parts: [{ text: `Task: ${title}` }] }];

  for (let step = 0; step < MAX_STEPS; step++) {
    let thinking = "";
    const resp = await generateWithRetryStream(
      {
        model: geminiModel(),
        contents,
        config: { systemInstruction: system, tools: [{ functionDeclarations: decls }], temperature: 0.4 },
      },
      (chunk) => { thinking += chunk; },
      (n, waitMs) =>
        emit({ agentId, agentName, level: "WARN", message: `Gemini occupato, riprovo (${n}) tra ${Math.round(waitMs / 1000)}s…` }),
    );
    totalTokens += resp.tokens;

    const calls = resp.functionCalls;
    if (calls.length === 0) {
      ctx.doneSummary = resp.text;
      break;
    }

    // Show reasoning text emitted by the model before it calls a tool
    const thought = thinking.trim();
    if (thought) emit({ agentId, agentName, level: "INFO", message: `💭 ${truncate(thought, THOUGHT_LIMIT)}` });

    contents.push({ role: "model", parts: calls.map((c) => ({ functionCall: c })) });

    const responseParts: Part[] = [];
    for (const call of calls) {
      const name = call.name ?? "";
      const args = (call.args ?? {}) as Record<string, unknown>;
      const result = await executeTool(name, args, ctx);
      responseParts.push({ functionResponse: { name, response: { result } } });
    }

    contents.push({ role: "user", parts: responseParts });
    if (ctx.finished) break;
  }

  await finalizeTask(ctx, { totalTokens, repoEnabled, notionEnabled, prProviderLabel: "Gemini" });
}
