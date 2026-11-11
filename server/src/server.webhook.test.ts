import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Il webhook GitHub sul vero `server.ts` con NODE_ENV=production e senza
// GITHUB_WEBHOOK_SECRET. Collaudo 2026-11-10: una richiesta non firmata riceveva 200.

const here = path.dirname(fileURLToPath(import.meta.url));
const serverEntry = path.join(here, "server.ts");
const tsxCli = path.join(here, "..", "node_modules", "tsx", "dist", "cli.mjs");

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address() as net.AddressInfo;
      srv.close(() => resolve(port));
    });
  });
}

let child: ChildProcess | undefined;
let workDir = "";
let base = "";
let output = "";

beforeAll(async () => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), "sams-webhook-"));
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    HOME: workDir,
    USERPROFILE: workDir,
    PORT: String(port),
    SAMS_DATA_DIR: workDir,
    NODE_ENV: "production",
  };
  child = spawn(process.execPath, [tsxCli, serverEntry], { cwd: workDir, env, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout?.on("data", (d) => (output += String(d)));
  child.stderr?.on("data", (d) => (output += String(d)));
  const deadline = Date.now() + 30_000;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`il server è uscito (codice ${child.exitCode}):\n${output}`);
    try {
      await fetch(`${base}/api/health`);
      return;
    } catch {
      if (Date.now() > deadline) throw new Error(`il server non è partito in tempo:\n${output}`);
      await new Promise((r) => setTimeout(r, 200));
    }
  }
}, 40_000);

afterAll(async () => {
  if (child && child.exitCode === null) {
    const exited = new Promise((r) => child!.once("exit", r));
    child.kill();
    await exited;
  }
  fs.rmSync(workDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

describe("POST /api/webhook/github in produzione senza secret", () => {
  it("rifiuta una richiesta non firmata con 503", async () => {
    const res = await fetch(`${base}/api/webhook/github`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-GitHub-Event": "push" },
      body: JSON.stringify({ ref: "refs/heads/main", sender: { login: "intruso" }, commits: [{}] }),
    });
    expect(res.status).toBe(503);
    expect(((await res.json()) as { error: string }).error).toContain("GITHUB_WEBHOOK_SECRET");
  });
});
