import { provision } from "./provision";

/**
 * Optional CLI provisioning (power users). The SAMS UI does the same thing via
 * the "Provisiona agenti" button, so you normally never need this.
 */
async function main(): Promise<void> {
  console.log("Provisioning Managed Agents environment + agent…");
  const { agentId, environmentId } = await provision();
  console.log("\n✅ Saved to server/.sams-runtime.json:");
  console.log(`   SAMS_AGENT_ID=${agentId}`);
  console.log(`   SAMS_ENVIRONMENT_ID=${environmentId}`);
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
