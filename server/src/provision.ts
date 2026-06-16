import { getClient } from "./anthropic";
import { getSettings, setProvision } from "./config";
import { WORKER_SYSTEM } from "./prompts";

/**
 * One-time creation of the managed Agent + cloud Environment. The IDs are saved
 * to the runtime settings so they're reused across sessions and restarts.
 * Calling again provisions a fresh pair.
 */
export async function provision(): Promise<{ agentId: string; environmentId: string }> {
  const s = getSettings();
  if (!s.anthropicApiKey) {
    throw new Error("Manca la API key Anthropic — salvala prima dalle Impostazioni.");
  }
  const client = getClient();

  const env = await client.beta.environments.create({
    name: `sams-env-${Date.now().toString(36)}`,
    config: { type: "cloud", networking: { type: "unrestricted" } },
  });

  const agent = await client.beta.agents.create({
    name: "SAMS Worker",
    model: s.model,
    system: WORKER_SYSTEM,
    tools: [{ type: "agent_toolset_20260401" }],
  });

  setProvision({ agentId: agent.id, environmentId: env.id });
  return { agentId: agent.id, environmentId: env.id };
}
