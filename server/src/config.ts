import fs from "node:fs";
import path from "node:path";
import "dotenv/config";

export type Provider = "gemini" | "claude" | "groq";

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
  // github
  githubToken: string;
  githubRepo: string;
  baseBranch: string;
  // claude managed-agents resources (provider="claude" only)
  agentId: string;
  environmentId: string;
  // misc
  model: string;
  openPRs: boolean;
  requireApproval: boolean;
  notionToken: string;
  notionPageId: string;
  port: number;
}

const STORE_FILE = path.join(process.cwd(), ".sams-runtime.json");

function fromEnv(): Settings {
  return {
    provider: (process.env.SAMS_PROVIDER as Provider) || "gemini",
    geminiApiKey: process.env.GEMINI_API_KEY ?? "",
    anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
    groqApiKey: process.env.GROQ_API_KEY ?? "",
    githubToken: process.env.GITHUB_TOKEN ?? "",
    githubRepo: process.env.GITHUB_REPO ?? "Carlomadella/Tutto-sulla-programmazione",
    baseBranch: process.env.GITHUB_BASE_BRANCH ?? "main",
    agentId: process.env.SAMS_AGENT_ID ?? "",
    environmentId: process.env.SAMS_ENVIRONMENT_ID ?? "",
    model: process.env.SAMS_MODEL ?? "gemini-2.5-flash",
    openPRs: (process.env.SAMS_OPEN_PRS ?? "true") !== "false",
    requireApproval: (process.env.SAMS_REQUIRE_APPROVAL ?? "false") !== "false",
    notionToken: process.env.NOTION_TOKEN ?? "",
    notionPageId: process.env.NOTION_PAGE_ID ?? "",
    port: parsePort(process.env.PORT),
  };
}

function parsePort(raw: string | undefined): number {
  const p = Number(raw);
  return Number.isFinite(p) && p > 0 && p < 65536 ? p : 8787;
}

function load(): Settings {
  const base = fromEnv();
  let raw: string;
  try {
    raw = fs.readFileSync(STORE_FILE, "utf8");
  } catch {
    return base; // no store file yet — first run, use env defaults
  }
  try {
    return { ...base, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch (err) {
    console.warn(`⚠️  ${STORE_FILE} è corrotto (${(err as Error).message}); uso i valori di default.`);
    return base;
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
    githubToken: s.githubToken,
    githubRepo: s.githubRepo,
    baseBranch: s.baseBranch,
    agentId: s.agentId,
    environmentId: s.environmentId,
    model: s.model,
    openPRs: s.openPRs,
    requireApproval: s.requireApproval,
    notionToken: s.notionToken,
    notionPageId: s.notionPageId,
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
    | "githubToken"
    | "githubRepo"
    | "baseBranch"
    | "model"
    | "openPRs"
    | "requireApproval"
    | "notionToken"
    | "notionPageId"
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
  return s.anthropicApiKey.length > 0;
}

export function isProvisioned(): boolean {
  const s = getSettings();
  // Gemini and Groq are self-hosted loops — no provisioning step.
  if (s.provider === "gemini" || s.provider === "groq") return true;
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
  };
}
