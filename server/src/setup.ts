import { anthropic } from "./anthropic";
import { config } from "./config";
import { WORKER_SYSTEM } from "./prompts";

/**
 * One-time provisioning: create the Managed Agents environment + agent, then
 * print the IDs to copy into server/.env. Run with `npm run setup`.
 */
async function main(): Promise<void> {
  if (!config.anthropicApiKey) {
    throw new Error("Set ANTHROPIC_API_KEY in server/.env before running setup.");
  }

  console.log("Creating environment…");
  const env = await anthropic.beta.environments.create({
    name: `sams-env-${Date.now().toString(36)}`,
    config: { type: "cloud", networking: { type: "unrestricted" } },
  });
  console.log("  environment_id:", env.id);

  console.log("Creating agent…");
  const agent = await anthropic.beta.agents.create({
    name: "SAMS Worker",
    model: config.model,
    system: WORKER_SYSTEM,
    tools: [{ type: "agent_toolset_20260401" }],
  });
  console.log("  agent_id:", agent.id);

  console.log("\n✅ Add these two lines to server/.env:\n");
  console.log(`SAMS_ENVIRONMENT_ID=${env.id}`);
  console.log(`SAMS_AGENT_ID=${agent.id}`);
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
