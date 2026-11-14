import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// "Accedi con GitHub" sulle route vere: avvia `server.ts` in un processo figlio con la
// OAuth App configurata (valori finti: GitHub non viene mai chiamato) e lo interroga via
// HTTP. Controlla che un utente senza GitHub collegato non possa far lavorare gli agenti
// sulla repo del server e che il giro OAuth rifiuti uno state inventato.

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

async function waitUntilUp(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child?.exitCode !== null && child?.exitCode !== undefined) {
      throw new Error(`il server è uscito (codice ${child.exitCode}):\n${output}`);
    }
    try {
      await fetch(`${base}/api/driver`);
      return; // risponde (anche 401): è su
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  throw new Error(`il server non è partito in tempo:\n${output}`);
}

beforeAll(async () => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), "sams-github-"));
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  // Ambiente minimo: niente segreti, DB o provider ereditati dalla macchina.
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    HOME: workDir,
    USERPROFILE: workDir,
    PORT: String(port),
    SAMS_DATA_DIR: workDir,
    SAMS_TRUST_PROXY: "1",
    SAMS_PUBLIC_URL: "https://sams.example",
    SAMS_PROVIDER: "openrouter",
    OPENROUTER_API_KEY: "finta",
    GITHUB_TOKEN: "token-del-server",
    GITHUB_REPO: "server/repo",
    GITHUB_CLIENT_ID: "client-finto",
    GITHUB_CLIENT_SECRET: "secret-finto",
    SAMS_SECRET_KEY: "chiave-di-prova",
  };
  child = spawn(process.execPath, [tsxCli, serverEntry], { cwd: workDir, env, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout?.on("data", (d) => (output += String(d)));
  child.stderr?.on("data", (d) => (output += String(d)));
  await waitUntilUp(30_000);
}, 40_000);

afterAll(async () => {
  if (child && child.exitCode === null) {
    const exited = new Promise((r) => child!.once("exit", r));
    child.kill();
    await exited;
  }
  fs.rmSync(workDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

function call(method: "GET" | "POST", route: string, token?: string, body?: unknown): Promise<Response> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  return fetch(`${base}${route}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

let session = "";

describe("Accedi con GitHub", () => {
  it("registra il primo account (owner)", async () => {
    const res = await call("POST", "/api/auth/register", undefined, { email: "mario@example.com", password: "password-lunga-1", name: "Mario" });
    expect(res.status).toBe(201);
    session = ((await res.json()) as { token: string }).token;
    expect(session).toBeTruthy();
  });

  it("/api/github/me: attivo ma non collegato", async () => {
    const res = await call("GET", "/api/github/me", session);
    expect(await res.json()).toEqual({ enabled: true, signedIn: true, connected: false, login: "", repo: "", baseBranch: "" });
  });

  it("connect restituisce l'indirizzo di autorizzazione di GitHub", async () => {
    const res = await call("POST", "/api/github/connect", session);
    expect(res.status).toBe(200);
    const u = new URL(((await res.json()) as { url: string }).url);
    expect(u.host).toBe("github.com");
    expect(u.searchParams.get("client_id")).toBe("client-finto");
    expect(u.searchParams.get("redirect_uri")).toBe("https://sams.example/api/github/callback");
    expect(u.searchParams.get("state")).toMatch(/^[0-9a-f]{48}$/);
    // il nonce va in un cookie del browser che ha avviato il giro
    expect(res.headers.get("set-cookie") ?? "").toMatch(
      /^sams_gh_oauth=[0-9a-f]{48}; Path=\/api\/github; HttpOnly; SameSite=Lax; Max-Age=600; Secure$/,
    );
  });

  it("callback con uno state vero ma da un altro browser (cookie sbagliato o assente): rifiutata", async () => {
    for (const cookie of ["sams_gh_oauth=nonce-sbagliato", ""]) {
      const started = await call("POST", "/api/github/connect", session);
      const state = new URL(((await started.json()) as { url: string }).url).searchParams.get("state")!;
      const res = await fetch(`${base}/api/github/callback?code=abc&state=${state}`, {
        redirect: "manual",
        headers: cookie ? { Cookie: cookie } : {},
      });
      expect(res.headers.get("location")).toBe("https://sams.example/app?github=error");
    }
  });

  it("connect senza account: 401", async () => {
    expect((await call("POST", "/api/github/connect")).status).toBe(401);
  });

  it("callback con uno state inventato: torna alla app con errore, senza salvare nulla", async () => {
    const res = await fetch(`${base}/api/github/callback?code=abc&state=inventato`, { redirect: "manual" });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://sams.example/app?github=error");
    const me = (await (await call("GET", "/api/github/me", session)).json()) as { connected: boolean };
    expect(me.connected).toBe(false);
  });

  it("assegnare un task senza GitHub collegato: 409, niente lavoro sulla repo del server", async () => {
    const res = await call("POST", "/api/assign", session, { agentId: "a1", agentName: "Ada", title: "prova" });
    expect(res.status).toBe(409);
    const data = (await res.json()) as { error: string; needsGithub: boolean };
    expect(data.needsGithub).toBe(true);
    expect(data.error).toMatch(/Collega il tuo account GitHub/);
  });

  it("l'albero dei file non mostra la repo del server a chi non ha collegato GitHub", async () => {
    const data = (await (await call("GET", "/api/repo/tree", session)).json()) as { repo: string; connected: boolean; needsGithub?: string };
    expect(data.repo).toBe("");
    expect(data.connected).toBe(false);
    expect(data.needsGithub).toBeTruthy();
  });

  it("repos e scelta della repo senza collegamento: 409", async () => {
    expect((await call("GET", "/api/github/repos", session)).status).toBe(409);
    expect((await call("POST", "/api/github/repo", session, { repo: "mario/app" })).status).toBe(409);
  });

  it("scollegare senza collegamento è innocuo", async () => {
    expect((await call("POST", "/api/github/disconnect", session)).status).toBe(200);
  });
});

describe("Team visibile a tutti", () => {
  it("un osservatore vede nome e ruolo di ogni account, senza email; un anonimo no", async () => {
    const reg = await call("POST", "/api/auth/register", undefined, { email: "lucia@example.com", password: "password-lunga-2", name: "Lucia" });
    expect(reg.status).toBe(201);
    const viewer = ((await reg.json()) as { token: string }).token;

    const res = await call("GET", "/api/team", viewer);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { members: Array<Record<string, unknown>> };
    expect(body.members).toEqual([
      { name: "Mario", role: "owner" },
      { name: "Lucia", role: "viewer" },
    ]);
    expect(JSON.stringify(body)).not.toContain("@example.com");

    expect((await call("GET", "/api/team")).status).toBe(401);
  });
});
