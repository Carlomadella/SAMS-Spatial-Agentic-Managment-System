import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Test d'integrazione delle guardie di ruolo sulle route vere: avvia `server.ts` in un
// processo figlio (cartella di lavoro e dati temporanee, niente .env, token dei tre tier
// da env) e lo interroga via HTTP. Collaudo 2026-11-10: un viewer prendeva la guida del
// mondo condiviso (che non può salvare) e non poteva presentarsi col proprio nome.

const here = path.dirname(fileURLToPath(import.meta.url));
const serverEntry = path.join(here, "server.ts");
const tsxCli = path.join(here, "..", "node_modules", "tsx", "dist", "cli.mjs");

const TOKENS = { owner: "test-owner-tok", editor: "test-editor-tok", viewer: "test-viewer-tok" } as const;

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
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), "sams-roles-"));
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
    SAMS_TOKEN: TOKENS.owner,
    SAMS_EDITOR_TOKEN: TOKENS.editor,
    SAMS_READONLY_TOKEN: TOKENS.viewer,
    SAMS_TRUST_PROXY: "1",
    GITHUB_REPO: "acme/segreto",
    NOTION_PAGE_ID: "notion-pagina-privata",
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

describe("POST /api/presence (presentarsi col proprio nome)", () => {
  it("un viewer può: non è lavoro, è dire chi sei", async () => {
    const res = await call("POST", "/api/presence", TOKENS.viewer, { id: "obs-viewer", name: "Vera" });
    expect(res.status).toBe(200);
  });

  it("un anonimo no", async () => {
    const res = await call("POST", "/api/presence", undefined, { id: "obs-anon", name: "Anon" });
    expect(res.status).toBe(401);
  });
});

describe("/api/driver (guida del mondo condiviso)", () => {
  it("un viewer può vedere chi guida", async () => {
    const res = await call("GET", "/api/driver", TOKENS.viewer);
    expect(res.status).toBe(200);
  });

  it("un viewer NON può prendere la guida", async () => {
    const res = await call("POST", "/api/driver", TOKENS.viewer, { id: "obs-viewer", name: "Vera" });
    expect(res.status).toBe(403);
    const after = (await (await call("GET", "/api/driver", TOKENS.viewer)).json()) as { holderId?: string | null };
    expect(after.holderId ?? null).not.toBe("obs-viewer");
  });

  it("un anonimo non può prendere la guida", async () => {
    const res = await call("POST", "/api/driver", undefined, { id: "obs-anon", name: "Anon" });
    expect(res.status).toBe(401);
  });

  it("un editor la prende", async () => {
    const res = await call("POST", "/api/driver", TOKENS.editor, { id: "obs-editor", name: "Edo" });
    expect(res.status).toBe(200);
    const after = (await (await call("GET", "/api/driver", TOKENS.viewer)).json()) as { holderId?: string | null };
    expect(after.holderId).toBe("obs-editor");
  });
});

// Ultrareview 2026-11-11: l'id di una vista è pubblico. Con /api/presence aperto ai viewer,
// chiunque poteva rinominare gli altri; col driver, rinnovare il lease altrui.
describe("l'id di una vista non basta: serve la stessa identità", () => {
  it("un altro con l'id del driver non rinnova né prende la guida", async () => {
    const mine = await call("POST", "/api/driver", TOKENS.editor, { id: "obs-editor", name: "Edo" });
    expect(((await mine.json()) as { youAreDriver: boolean }).youAreDriver).toBe(true);
    const res = await call("POST", "/api/driver", TOKENS.owner, { id: "obs-editor", name: "Intruso" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { holderId: string; name: string; youAreDriver: boolean };
    expect(body.youAreDriver).toBe(false);
    expect(body.name).toBe("Edo");
  });

  it("solo chi ha aperto la vista può rinominarla", async () => {
    const t = (await (await call("POST", "/api/events/ticket", TOKENS.editor)).json()) as { ticket: string };
    const ctrl = new AbortController();
    const stream = await fetch(`${base}/api/events?t=${t.ticket}&v=obs-view-ed&n=Edo`, { signal: ctrl.signal });
    expect(stream.status).toBe(200);
    try {
      const altrui = (await (await call("POST", "/api/presence", TOKENS.viewer, { id: "obs-view-ed", name: "Hacked" })).json()) as { changed: number };
      expect(altrui.changed).toBe(0);
      const mio = (await (await call("POST", "/api/presence", TOKENS.editor, { id: "obs-view-ed", name: "Edoardo" })).json()) as { changed: number };
      expect(mio.changed).toBe(1);
    } finally {
      ctrl.abort();
    }
  });
});

describe("GET /api/admin/client-ip (diagnostica di SAMS_TRUST_PROXY)", () => {
  it("con 1 hop fidato prende l'IP aggiunto dal proxy, non quello scritto dal client", async () => {
    const res = await fetch(`${base}/api/admin/client-ip`, {
      headers: { Authorization: `Bearer ${TOKENS.owner}`, "X-Forwarded-For": "6.6.6.6, 203.0.113.7" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { trustProxy: unknown; ip: string };
    expect(body.trustProxy).toBe(1);
    expect(body.ip).toBe("203.0.113.7");
  });
  it("è solo per l'owner", async () => {
    expect((await call("GET", "/api/admin/client-ip", TOKENS.editor)).status).toBe(403);
    expect((await call("GET", "/api/admin/client-ip")).status).toBe(401);
  });
});

// Collaudo 2026-11-10: /api/health e /api/status erano pubblici e dicevano a chiunque
// quale repo e quale pagina Notion usa il workspace.
describe("stato del runtime: niente repo né Notion a chi non è entrato", () => {
  it("/api/health dice solo se il server è su e pronto", async () => {
    const res = await call("GET", "/api/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(typeof body.ready).toBe("boolean");
    expect(JSON.stringify(body)).not.toContain("acme/segreto");
    expect(JSON.stringify(body)).not.toContain("notion-pagina-privata");
  });

  it("/api/status a un anonimo: repo, branch e pagina Notion vuoti", async () => {
    const body = (await (await call("GET", "/api/status")).json()) as Record<string, unknown>;
    expect(body.repo).toBe("");
    expect(body.baseBranch).toBe("");
    expect(body.notionPageId).toBe("");
    expect(typeof body.ready).toBe("boolean");
  });

  it("/api/status a un viewer con credenziale: li vede", async () => {
    const body = (await (await call("GET", "/api/status", TOKENS.viewer)).json()) as Record<string, unknown>;
    expect(body.repo).toBe("acme/segreto");
    expect(body.notionPageId).toBe("notion-pagina-privata");
  });
});
