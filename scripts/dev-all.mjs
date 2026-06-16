// Starts the SAMS web app and the managed-agents runtime together.
// Usage: npm start   (after: npm run bootstrap)
import { spawn } from "node:child_process";

const shell = process.platform === "win32";
const procs = [
  { name: "web", cmd: "npm", args: ["run", "dev"] },
  { name: "runtime", cmd: "npm", args: ["--prefix", "server", "run", "dev"] },
];

const children = procs.map(({ name, cmd, args }) => {
  console.log(`▶ starting ${name}: ${cmd} ${args.join(" ")}`);
  const child = spawn(cmd, args, { stdio: "inherit", shell });
  child.on("exit", (code) => console.log(`■ ${name} exited (${code ?? "signal"})`));
  return child;
});

function shutdown() {
  for (const c of children) c.kill("SIGINT");
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
