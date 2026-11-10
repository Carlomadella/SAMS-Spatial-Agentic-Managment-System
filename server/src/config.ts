import fs from "node:fs";
import path from "node:path";
import "dotenv/config";

export type Provider = "gemini" | "claude" | "groq" | "openrouter" | "openai";

/**
 * Runtime settings. Defaults come from the environment (.env), but the SAMS UI
 * can override them at runtime via /api/settings — those overrides are persisted
 * to a local, git-ignored JSON file so they survive restarts.
 */
export interface Settings {
  provider: Provider;
  // engine keys
  geminiApiKey: string;
  anthropicApiKey: string;
  groqApiKey: string;
  openrouterApiKey: string;
  openaiApiKey: string;
  // github
  githubToken: string;
  githubRepo: string;
  baseBranch: string;
  /** Secret HMAC per verificare i webhook GitHub in ingresso (vuoto = verifica off). */
  githubWebhookSecret: string;
  /** Server MCP esposti agli agenti come strumento `mcp_call`, come JSON array
   *  (allow-list): [{ name, url, token?, tools? }]. Vuoto = tool non offerto. */
  mcpServers: string;
  // claude managed-agents resources (provider="claude" only)
  agentId: string;
  environmentId: string;
  // misc
  model: string;
  openPRs: boolean;
  requireApproval: boolean;
  notionToken: string;
  notionPageId: string;
  runtimeToken: string;
  /** Token "editor": avvia lavoro (assegna/approva/sim/routine/chat) ma non tocca
   *  le impostazioni. Vuoto = tier non configurato (solo owner/viewer). */
  editorToken: string;
  /** Token di sola lettura per la dashboard pubblica (vuoto = aperta). */
  readonlyToken: string;
  port: number;
}

const STORE_FILE = path.join(process.cwd(), ".sams-runtime.json");

/** Variabile d'ambiente → campo delle impostazioni (stringhe). */
const ENV_KEYS: ReadonlyArray<[string, keyof Settings]> = [
  ["SAMS_PROVIDER", "provider"],
  ["GEMINI_API_KEY", "geminiApiKey"],
  ["ANTHROPIC_API_KEY", "anthropicApiKey"],
  ["GROQ_API_KEY", "groqApiKey"],
  ["OPENROUTER_API_KEY", "openrouterApiKey"],
  ["OPENAI_API_KEY", "openaiApiKey"],
  ["GITHUB_TOKEN", "githubToken"],
  ["GITHUB_REPO", "githubRepo"],
  ["GITHUB_BASE_BRANCH", "baseBranch"],
  ["GITHUB_WEBHOOK_SECRET", "githubWebhookSecret"],
  ["SAMS_MCP_SERVERS", "mcpServers"],
  ["SAMS_AGENT_ID", "agentId"],
  ["SAMS_ENVIRONMENT_ID", "environmentId"],
  ["SAMS_MODEL", "model"],
  ["NOTION_TOKEN", "notionToken"],
  ["NOTION_PAGE_ID", "notionPageId"],
  ["SAMS_TOKEN", "runtimeToken"],
  ["SAMS_EDITOR_TOKEN", "editorToken"],
  ["SAMS_READONLY_TOKEN", "readonlyToken"],
];

/** Valori di partenza quando né l'ambiente né il file dicono nulla. */
function defaults(env: NodeJS.ProcessEnv): Settings {
  return {
    provider: "gemini",
    geminiApiKey: "",
    anthropicApiKey: "",
    groqApiKey: "",
    openrouterApiKey: "",
    openaiApiKey: "",
    githubToken: "",
    githubRepo: "Carlomadella/Tutto-sulla-programmazione",
    baseBranch: "main",
    githubWebhookSecret: "",
    mcpServers: "",
    agentId: "",
    environmentId: "",
    model: "gemini-2.5-flash",
    openPRs: true,
    requireApproval: false,
    notionToken: "",
    notionPageId: "",
    runtimeToken: "",
    editorToken: "",
    readonlyToken: "",
    port: parsePort(env.PORT),
  };
}

/** Solo le variabili d'ambiente davvero impostate (non vuote). */
function envOverrides(env: NodeJS.ProcessEnv): Partial<Settings> {
  const out: Record<string, unknown> = {};
  for (const [name, key] of ENV_KEYS) {
    const v = env[name];
    if (v !== undefined && v !== "") out[key] = v;
  }
  if (env.SAMS_OPEN_PRS !== undefined && env.SAMS_OPEN_PRS !== "") out.openPRs = env.SAMS_OPEN_PRS !== "false";
  if (env.SAMS_REQUIRE_APPROVAL !== undefined && env.SAMS_REQUIRE_APPROVAL !== "") {
    out.requireApproval = env.SAMS_REQUIRE_APPROVAL !== "false";
  }
  return out as Partial<Settings>;
}

/**
 * Precedenza: **ambiente > file salvato > default**. Una variabile impostata
 * (su Render, in Docker, nel .env) vince sempre su `.sams-runtime.json`: prima
 * vinceva il file, così cambiare `SAMS_TOKEN` o una chiave sul server non aveva
 * effetto finché il file esisteva — anche se conteneva `runtimeToken: ""`.
 * Il file riempie solo ciò che l'ambiente non dice (le scelte fatte dalla UI).
 * `port` viene solo dall'ambiente.
 */
export function resolveSettings(env: NodeJS.ProcessEnv, stored: Partial<Settings> | null): Settings {
  const { port: _ignored, ...fromFile } = stored ?? {};
  void _ignored;
  return { ...defaults(env), ...fromFile, ...envOverrides(env) };
}

/**
 * Campi **gestiti dall'ambiente**: quelli con una variabile impostata (non vuota).
 * Dato che l'ambiente vince sul file, un cambio dalla UI su questi campi durerebbe
 * solo fino al riavvio — e per un token revocato dalla UI vorrebbe dire che quello
 * vecchio torna valido in silenzio. Per questo la UI non può cambiarli.
 */
export function envManagedKeys(env: NodeJS.ProcessEnv = process.env): Array<keyof Settings> {
  return Object.keys(envOverrides(env)) as Array<keyof Settings>;
}

/**
 * Campi della patch che la UI vorrebbe cambiare ma che sono gestiti dall'ambiente.
 * Un valore uguale a quello attuale non è un cambio (la UI rimanda sempre provider,
 * repo, modello…): passa, e la patch resta un no-op per quel campo.
 */
export function envLockedChanges(
  patch: Partial<Settings>,
  current: Settings,
  locked: ReadonlyArray<keyof Settings>,
): Array<keyof Settings> {
  return locked.filter((k) => k in patch && patch[k] !== undefined && patch[k] !== current[k]);
}

function parsePort(raw: string | undefined): number {
  const p = Number(raw);
  return Number.isFinite(p) && p > 0 && p < 65536 ? p : 8787;
}

function load(): Settings {
  let raw: string;
  try {
    raw = fs.readFileSync(STORE_FILE, "utf8");
  } catch {
    return resolveSettings(process.env, null); // no store file yet — first run
  }
  try {
    return resolveSettings(process.env, JSON.parse(raw) as Partial<Settings>);
  } catch (err) {
    console.warn(`⚠️  ${STORE_FILE} è corrotto (${(err as Error).message}); uso i valori di default.`);
    return resolveSettings(process.env, null);
  }
}

let current: Settings = load();

function persist(): void {
  const s = current;
  const data: Omit<Settings, "port"> = {
    provider: s.provider,
    geminiApiKey: s.geminiApiKey,
    anthropicApiKey: s.anthropicApiKey,
    groqApiKey: s.groqApiKey,
    openrouterApiKey: s.openrouterApiKey,
    openaiApiKey: s.openaiApiKey,
    githubToken: s.githubToken,
    githubRepo: s.githubRepo,
    baseBranch: s.baseBranch,
    githubWebhookSecret: s.githubWebhookSecret,
    mcpServers: s.mcpServers,
    agentId: s.agentId,
    environmentId: s.environmentId,
    model: s.model,
    openPRs: s.openPRs,
    requireApproval: s.requireApproval,
    notionToken: s.notionToken,
    notionPageId: s.notionPageId,
    runtimeToken: s.runtimeToken,
    editorToken: s.editorToken,
    readonlyToken: s.readonlyToken,
  };
  // 0o600: the file holds API tokens in plaintext — keep it owner-only.
  fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), { encoding: "utf8", mode: 0o600 });
  try {
    fs.chmodSync(STORE_FILE, 0o600); // enforce perms even if the file pre-existed with looser mode
  } catch {
    /* best-effort on platforms without chmod */
  }
}

export function getSettings(): Settings {
  return current;
}

/** Fields the UI is allowed to change. */
export type SettingsPatch = Partial<
  Pick<
    Settings,
    | "provider"
    | "geminiApiKey"
    | "anthropicApiKey"
    | "groqApiKey"
    | "openrouterApiKey"
    | "openaiApiKey"
    | "githubToken"
    | "githubRepo"
    | "baseBranch"
    | "model"
    | "openPRs"
    | "requireApproval"
    | "notionToken"
    | "notionPageId"
    | "runtimeToken"
    | "editorToken"
  >
>;

export function updateSettings(patch: SettingsPatch): Settings {
  current = { ...current, ...patch };
  persist();
  return current;
}

/** Store the provisioned Agent + Environment IDs (Claude provider only). */
export function setProvision(ids: { agentId: string; environmentId: string }): Settings {
  current = { ...current, agentId: ids.agentId, environmentId: ids.environmentId };
  persist();
  return current;
}

export function isConfigured(): boolean {
  const s = getSettings();
  if (s.provider === "gemini") return s.geminiApiKey.length > 0;
  if (s.provider === "groq") return s.groqApiKey.length > 0;
  if (s.provider === "openrouter") return s.openrouterApiKey.length > 0;
  if (s.provider === "openai") return s.openaiApiKey.length > 0;
  return s.anthropicApiKey.length > 0;
}

export function isProvisioned(): boolean {
  const s = getSettings();
  // Gemini, Groq and OpenRouter are self-hosted loops — no provisioning step.
  if (s.provider === "gemini" || s.provider === "groq" || s.provider === "openrouter" || s.provider === "openai") return true;
  return s.agentId.length > 0 && s.environmentId.length > 0;
}

export function isReady(): boolean {
  return isConfigured() && isProvisioned();
}

/** Safe snapshot for the UI — never leaks the secret values themselves. */
export function publicStatus() {
  const s = getSettings();
  return {
    provider: s.provider,
    hasGeminiKey: s.geminiApiKey.length > 0,
    hasAnthropicKey: s.anthropicApiKey.length > 0,
    hasGroqKey: s.groqApiKey.length > 0,
    hasOpenrouterKey: s.openrouterApiKey.length > 0,
    hasOpenaiKey: s.openaiApiKey.length > 0,
    hasGithubToken: s.githubToken.length > 0,
    provisioned: isProvisioned(),
    ready: isReady(),
    repo: s.githubRepo,
    baseBranch: s.baseBranch,
    model: s.model,
    openPRs: s.openPRs,
    requireApproval: s.requireApproval,
    hasNotionToken: s.notionToken.length > 0,
    notionPageId: s.notionPageId,
    notionReady: s.notionToken.length > 0,
    hasToken: s.runtimeToken.length > 0,
    hasEditorToken: s.editorToken.length > 0,
    hasReadonlyToken: s.readonlyToken.length > 0,
    /** Campi impostati da variabili d'ambiente: la UI li mostra bloccati. Solo i nomi, mai i valori. */
    envManaged: envManagedKeys(),
  };
}
