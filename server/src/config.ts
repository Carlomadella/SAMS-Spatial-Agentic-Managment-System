import fs from "node:fs";
import path from "node:path";
import "dotenv/config";

/**
 * Runtime settings. Defaults come from the environment (.env), but the SAMS UI
 * can override them at runtime via /api/settings — those overrides are persisted
 * to a local, git-ignored JSON file so they survive restarts.
 */
export interface Settings {
  anthropicApiKey: string;
  githubToken: string;
  githubRepo: string;
  baseBranch: string;
  agentId: string;
  environmentId: string;
  model: string;
  openPRs: boolean;
  port: number;
}

const STORE_FILE = path.join(process.cwd(), ".sams-runtime.json");

function fromEnv(): Settings {
  return {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
    githubToken: process.env.GITHUB_TOKEN ?? "",
    githubRepo: process.env.GITHUB_REPO ?? "Carlomadella/Tutto-sulla-programmazione",
    baseBranch: process.env.GITHUB_BASE_BRANCH ?? "main",
    agentId: process.env.SAMS_AGENT_ID ?? "",
    environmentId: process.env.SAMS_ENVIRONMENT_ID ?? "",
    model: process.env.SAMS_MODEL ?? "claude-opus-4-8",
    openPRs: (process.env.SAMS_OPEN_PRS ?? "true") !== "false",
    port: Number(process.env.PORT ?? 8787),
  };
}

function load(): Settings {
  const base = fromEnv();
  try {
    const saved = JSON.parse(fs.readFileSync(STORE_FILE, "utf8")) as Partial<Settings>;
    return { ...base, ...saved };
  } catch {
    return base;
  }
}

let current: Settings = load();

function persist(): void {
  const s = current;
  const data = {
    anthropicApiKey: s.anthropicApiKey,
    githubToken: s.githubToken,
    githubRepo: s.githubRepo,
    baseBranch: s.baseBranch,
    agentId: s.agentId,
    environmentId: s.environmentId,
    model: s.model,
    openPRs: s.openPRs,
  };
  fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), "utf8");
}

export function getSettings(): Settings {
  return current;
}

/** Fields the UI is allowed to change. */
export type SettingsPatch = Partial<
  Pick<Settings, "anthropicApiKey" | "githubToken" | "githubRepo" | "baseBranch" | "model" | "openPRs">
>;

export function updateSettings(patch: SettingsPatch): Settings {
  current = { ...current, ...patch };
  persist();
  return current;
}

/** Store the provisioned Agent + Environment IDs. */
export function setProvision(ids: { agentId: string; environmentId: string }): Settings {
  current = { ...current, agentId: ids.agentId, environmentId: ids.environmentId };
  persist();
  return current;
}

export function isConfigured(): boolean {
  return getSettings().anthropicApiKey.length > 0;
}

export function isProvisioned(): boolean {
  const s = getSettings();
  return s.agentId.length > 0 && s.environmentId.length > 0;
}

export function isReady(): boolean {
  return isConfigured() && isProvisioned();
}

/** Safe snapshot for the UI — never leaks the secret values themselves. */
export function publicStatus() {
  const s = getSettings();
  return {
    hasAnthropicKey: s.anthropicApiKey.length > 0,
    hasGithubToken: s.githubToken.length > 0,
    provisioned: isProvisioned(),
    ready: isReady(),
    repo: s.githubRepo,
    baseBranch: s.baseBranch,
    model: s.model,
    openPRs: s.openPRs,
  };
}
