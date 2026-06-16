import "dotenv/config";

/** Runtime configuration, read from the environment (.env). */
export const config = {
  port: Number(process.env.PORT ?? 8787),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  githubToken: process.env.GITHUB_TOKEN ?? "",
  githubRepo: process.env.GITHUB_REPO ?? "Carlomadella/Tutto-sulla-programmazione",
  baseBranch: process.env.GITHUB_BASE_BRANCH ?? "main",
  agentId: process.env.SAMS_AGENT_ID ?? "",
  environmentId: process.env.SAMS_ENVIRONMENT_ID ?? "",
  openPRs: (process.env.SAMS_OPEN_PRS ?? "true") !== "false",
  /** model the managed agents run on */
  model: process.env.SAMS_MODEL ?? "claude-opus-4-8",
};

/** True when the runtime has everything it needs to drive sessions. */
export function isConfigured(): boolean {
  return Boolean(config.anthropicApiKey && config.agentId && config.environmentId);
}
