// Starts the SAMS web app and the managed-agents runtime together.
// Auto-installs missing dependencies so `npm start` "just works".
// Usage: npm start
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const shell = process.platform === "win32";
const root = process.cwd();

function ensureDeps(label, dir, prefixArgs) {
  if (existsSync(path.join(dir, "node_modules"))) return;
  console.log(`📦 Installing ${label} dependencies (first run)…`);
  const r = spawnSync("npm", [...prefixArgs, "install"], { stdio: "inherit", shell });
  if (r.status !== 0) {
    console.error(`❌ Failed to install ${label} dependencies.`);
    process.exit(1);
  }
}

ensureDeps("web", root, []);
ensureDeps("runtime", path.join(root, "server"), ["--prefix", "server"]);

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
