// Runs the Commit Garden API + web client together (installs deps if needed).
// Usage: npm start
import { spawn, spawnSync } from "node:child_process";

const shell = process.platform === "win32";

function ensure(label, prefix) {
  console.log(`📦 Ensuring ${label} dependencies…`);
  const r = spawnSync("npm", ["--prefix", prefix, "install", "--no-fund", "--no-audit"], {
    stdio: "inherit",
    shell,
  });
  if (r.status !== 0) {
    console.error(`❌ Failed to install ${label} dependencies.`);
    process.exit(1);
  }
}

ensure("server", "server");
ensure("client", "client");

const procs = [
  { name: "server", args: ["--prefix", "server", "run", "dev"] },
  { name: "client", args: ["--prefix", "client", "run", "dev"] },
];

const children = procs.map(({ name, args }) => {
  console.log(`▶ starting ${name}`);
  const c = spawn("npm", args, { stdio: "inherit", shell });
  c.on("exit", (code) => console.log(`■ ${name} exited (${code ?? "signal"})`));
  return c;
});

const shutdown = () => children.forEach((c) => c.kill("SIGINT"));
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
