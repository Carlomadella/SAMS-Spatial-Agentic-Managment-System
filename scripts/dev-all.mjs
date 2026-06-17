// Starts the SAMS web app and the managed-agents runtime together.
// Always ensures dependencies are installed first, so `npm start` keeps working
// after a `git pull` adds new packages. Usage: npm start
import { spawn, spawnSync } from "node:child_process";

const shell = process.platform === "win32";

function installDeps(label, prefixArgs) {
  console.log(`📦 Ensuring ${label} dependencies…`);
  const r = spawnSync("npm", [...prefixArgs, "install", "--no-fund", "--no-audit"], {
    stdio: "inherit",
    shell,
  });
  if (r.status !== 0) {
    console.error(`❌ Failed to install ${label} dependencies.`);
    process.exit(1);
  }
}

// `npm install` is a fast no-op when nothing changed, but it DOES pick up new
// dependencies after a pull — which is exactly what was missing before.
installDeps("web", []);
installDeps("runtime", ["--prefix", "server"]);

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
