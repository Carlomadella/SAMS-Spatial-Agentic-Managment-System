import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadSettingRows, openDb, saveSettingRows } from "./db";

/**
 * Il giro completo dell'opzione C con file e database veri: una cartella dati temporanea
 * (SAMS_DATA_DIR) e un SQLite in memoria. `config.ts` legge il file al caricamento, quindi
 * ogni test lo ricarica da capo dopo aver preparato l'ambiente.
 */

// Tutte le variabili che config.ts guarda: vuote = "non impostate", e dotenv (che non
// sovrascrive) non porta dentro quelle del server/.env di chi lancia i test.
const SETTINGS_ENV = [
  "SAMS_PROVIDER", "SAMS_MODEL", "GEMINI_API_KEY", "GROQ_API_KEY", "OPENROUTER_API_KEY", "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY", "GITHUB_TOKEN", "GITHUB_REPO", "GITHUB_BASE_BRANCH", "GITHUB_WEBHOOK_SECRET",
  "SAMS_MCP_SERVERS", "SAMS_AGENT_ID", "SAMS_ENVIRONMENT_ID", "NOTION_TOKEN", "NOTION_PAGE_ID", "SAMS_TOKEN",
  "SAMS_EDITOR_TOKEN", "SAMS_READONLY_TOKEN", "SAMS_OPEN_PRS", "SAMS_REQUIRE_APPROVAL", "SAMS_EPHEMERAL_DISK",
];

let dir = "";
const storeFile = () => path.join(dir, ".sams-runtime.json");
const readStore = () => JSON.parse(fs.readFileSync(storeFile(), "utf8")) as Record<string, unknown>;

async function loadConfig(env: Record<string, string> = {}) {
  for (const k of SETTINGS_ENV) vi.stubEnv(k, env[k] ?? "");
  vi.stubEnv("SAMS_DATA_DIR", dir);
  vi.resetModules();
  return import("./config");
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "sams-settings-"));
});
afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("initSettings / updateSettings — opzione C", () => {
  it("al primo avvio importa le scelte dal file nel DB e lascia nel file solo i segreti", async () => {
    fs.writeFileSync(storeFile(), JSON.stringify({ model: "m-file", requireApproval: true, openrouterApiKey: "sk-file" }));
    const cfg = await loadConfig();
    const d = await openDb(":memory:");
    const { imported } = await cfg.initSettings(d);

    expect(imported.sort()).toEqual(["model", "requireApproval"]);
    expect(await loadSettingRows(d)).toEqual({ model: '"m-file"', requireApproval: "true" });
    expect(readStore()).toEqual({ openrouterApiKey: "sk-file" });
    expect(cfg.getSettings()).toMatchObject({ model: "m-file", requireApproval: true, openrouterApiKey: "sk-file" });
  });

  it("il database vince sul file per le scelte; il file non viene reimportato", async () => {
    fs.writeFileSync(storeFile(), JSON.stringify({ model: "vecchio" }));
    const cfg = await loadConfig();
    const d = await openDb(":memory:");
    await saveSettingRows(d, { model: '"dal-db"' });
    const { imported } = await cfg.initSettings(d);
    expect(imported).toEqual([]);
    expect(cfg.getSettings().model).toBe("dal-db");
  });

  it("le scelte salvate da ⚙ vanno nel DB e sopravvivono a un riavvio senza file", async () => {
    const cfg = await loadConfig();
    const d = await openDb(":memory:");
    await cfg.initSettings(d);
    await cfg.updateSettings({ model: "nuovo", openPRs: false });
    expect(fs.existsSync(storeFile())).toBe(false); // nessun segreto cambiato → il file non si tocca

    // "Riavvio" su un disco azzerato: stesso DB, niente file.
    const again = await loadConfig();
    await again.initSettings(d);
    expect(again.getSettings()).toMatchObject({ model: "nuovo", openPRs: false });
  });

  it("i segreti non finiscono mai nel database", async () => {
    const cfg = await loadConfig();
    const d = await openDb(":memory:");
    await cfg.initSettings(d);
    await cfg.updateSettings({ githubToken: "ghp_segreto", model: "m" });
    const rows = await loadSettingRows(d);
    expect(Object.keys(rows)).not.toContain("githubToken");
    expect(JSON.stringify(rows)).not.toContain("ghp_segreto");
    const file = readStore();
    expect(file.githubToken).toBe("ghp_segreto");
    expect(Object.keys(file)).not.toContain("model"); // nel file solo segreti
  });

  it("un campo gestito dall'ambiente non viene scritto nel DB, e le vecchie copie si tolgono", async () => {
    const cfg = await loadConfig({ SAMS_MODEL: "m-env" });
    const d = await openDb(":memory:");
    await saveSettingRows(d, { model: '"m-env"', baseBranch: '"dev"' }); // model: copia dell'ambiente
    await cfg.initSettings(d);
    expect(await loadSettingRows(d)).toEqual({ baseBranch: '"dev"' });
    await cfg.updateSettings({ requireApproval: true });
    expect(await loadSettingRows(d)).not.toHaveProperty("model");
    expect(cfg.getSettings().model).toBe("m-env");
  });

  it("disco effimero: il file non viene riscritto all'avvio", async () => {
    fs.writeFileSync(storeFile(), JSON.stringify({ model: "m-file", githubToken: "g" }));
    const cfg = await loadConfig({ SAMS_EPHEMERAL_DISK: "1" });
    const d = await openDb(":memory:");
    await cfg.initSettings(d);
    expect(readStore()).toEqual({ model: "m-file", githubToken: "g" });
    expect(cfg.getSettings().model).toBe("m-file");
  });

  it("se il DB non risponde, le impostazioni in uso restano quelle di prima", async () => {
    const cfg = await loadConfig();
    const d = await openDb(":memory:");
    await cfg.initSettings(d);
    await d.close();
    await expect(cfg.updateSettings({ model: "mai" })).rejects.toThrow();
    expect(cfg.getSettings().model).not.toBe("mai");
  });

  it("setProvision salva gli id nel DB", async () => {
    const cfg = await loadConfig();
    const d = await openDb(":memory:");
    await cfg.initSettings(d);
    await cfg.setProvision({ agentId: "ag_1", environmentId: "env_1" });
    expect(await loadSettingRows(d)).toMatchObject({ agentId: '"ag_1"', environmentId: '"env_1"' });
  });
});
