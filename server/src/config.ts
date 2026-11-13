import fs from "node:fs";
import "dotenv/config";
import { dataFile } from "./dataDir";
import { loadSettingRows, saveSettingRows } from "./db";
import { Mutex, type SqlDriver } from "./sql";

export type Provider = "gemini" | "claude" | "groq" | "openrouter" | "openai";

/**
 * Runtime settings. Defaults come from the environment (.env), but the SAMS UI
 * can override them at runtime via /api/settings — those overrides are persisted
 * to a local, git-ignored JSON file so they survive restarts.
 */
export interface Settings {
  provider: Provider;
  // engine keys
  geminiApiKey: string;
  anthropicApiKey: string;
  groqApiKey: string;
  openrouterApiKey: string;
  openaiApiKey: string;
  // github
  githubToken: string;
  githubRepo: string;
  baseBranch: string;
  /** Secret HMAC per verificare i webhook GitHub in ingresso (vuoto = verifica off). */
  githubWebhookSecret: string;
  /** Server MCP esposti agli agenti come strumento `mcp_call`, come JSON array
   *  (allow-list): [{ name, url, token?, tools? }]. Vuoto = tool non offerto. */
  mcpServers: string;
  // claude managed-agents resources (provider="claude" only)
  agentId: string;
  environmentId: string;
  // misc
  model: string;
  openPRs: boolean;
  requireApproval: boolean;
  notionToken: string;
  notionPageId: string;
  runtimeToken: string;
  /** Token "editor": avvia lavoro (assegna/approva/sim/routine/chat) ma non tocca
   *  le impostazioni. Vuoto = tier non configurato (solo owner/viewer). */
  editorToken: string;
  /** Token di sola lettura per la dashboard pubblica (vuoto = aperta). */
  readonlyToken: string;
  port: number;
}

const STORE_FILE = dataFile(".sams-runtime.json");

/** Variabile d'ambiente → campo delle impostazioni (stringhe). */
const ENV_KEYS: ReadonlyArray<[string, keyof Settings]> = [
  ["SAMS_PROVIDER", "provider"],
  ["GEMINI_API_KEY", "geminiApiKey"],
  ["ANTHROPIC_API_KEY", "anthropicApiKey"],
  ["GROQ_API_KEY", "groqApiKey"],
  ["OPENROUTER_API_KEY", "openrouterApiKey"],
  ["OPENAI_API_KEY", "openaiApiKey"],
  ["GITHUB_TOKEN", "githubToken"],
  ["GITHUB_REPO", "githubRepo"],
  ["GITHUB_BASE_BRANCH", "baseBranch"],
  ["GITHUB_WEBHOOK_SECRET", "githubWebhookSecret"],
  ["SAMS_MCP_SERVERS", "mcpServers"],
  ["SAMS_AGENT_ID", "agentId"],
  ["SAMS_ENVIRONMENT_ID", "environmentId"],
  ["SAMS_MODEL", "model"],
  ["NOTION_TOKEN", "notionToken"],
  ["NOTION_PAGE_ID", "notionPageId"],
  ["SAMS_TOKEN", "runtimeToken"],
  ["SAMS_EDITOR_TOKEN", "editorToken"],
  ["SAMS_READONLY_TOKEN", "readonlyToken"],
];

/** Valori di partenza quando né l'ambiente né il file dicono nulla. */
function defaults(env: NodeJS.ProcessEnv): Settings {
  return {
    provider: "gemini",
    geminiApiKey: "",
    anthropicApiKey: "",
    groqApiKey: "",
    openrouterApiKey: "",
    openaiApiKey: "",
    githubToken: "",
    githubRepo: "Carlomadella/Tutto-sulla-programmazione",
    baseBranch: "main",
    githubWebhookSecret: "",
    mcpServers: "",
    agentId: "",
    environmentId: "",
    model: "gemini-2.5-flash",
    openPRs: true,
    requireApproval: false,
    notionToken: "",
    notionPageId: "",
    runtimeToken: "",
    editorToken: "",
    readonlyToken: "",
    port: parsePort(env.PORT),
  };
}

/** Solo le variabili d'ambiente davvero impostate (non vuote). */
function envOverrides(env: NodeJS.ProcessEnv): Partial<Settings> {
  const out: Record<string, unknown> = {};
  // Spazi in testa/coda (frequenti incollando su Render) tolti: un valore di soli spazi è
  // "non impostato", e un modello con lo spazio finale non dà più 409 a ogni salvataggio.
  const val = (name: string): string => (env[name] ?? "").trim();
  for (const [name, key] of ENV_KEYS) {
    const v = val(name);
    if (v !== "") out[key] = v;
  }
  if (val("SAMS_OPEN_PRS") !== "") out.openPRs = val("SAMS_OPEN_PRS") !== "false";
  if (val("SAMS_REQUIRE_APPROVAL") !== "") out.requireApproval = val("SAMS_REQUIRE_APPROVAL") !== "false";
  return out as Partial<Settings>;
}

/**
 * Precedenza: **ambiente > file salvato > default**. Una variabile impostata
 * (su Render, in Docker, nel .env) vince sempre su `.sams-runtime.json`: prima
 * vinceva il file, così cambiare `SAMS_TOKEN` o una chiave sul server non aveva
 * effetto finché il file esisteva — anche se conteneva `runtimeToken: ""`.
 * Il file riempie solo ciò che l'ambiente non dice (le scelte fatte dalla UI).
 * `port` viene solo dall'ambiente.
 */
export function resolveSettings(env: NodeJS.ProcessEnv, stored: Partial<Settings> | null): Settings {
  const { port: _ignored, ...fromFile } = stored ?? {};
  void _ignored;
  return { ...defaults(env), ...fromFile, ...envOverrides(env) };
}

/**
 * Campi **gestiti dall'ambiente**: quelli con una variabile impostata (non vuota).
 * Dato che l'ambiente vince sul file, un cambio dalla UI su questi campi durerebbe
 * solo fino al riavvio — e per un token revocato dalla UI vorrebbe dire che quello
 * vecchio torna valido in silenzio. Per questo la UI non può cambiarli.
 */
export function envManagedKeys(env: NodeJS.ProcessEnv = process.env): Array<keyof Settings> {
  return Object.keys(envOverrides(env)) as Array<keyof Settings>;
}

/**
 * Campi della patch che la UI vorrebbe cambiare ma che sono gestiti dall'ambiente.
 * Un valore uguale a quello attuale non è un cambio (la UI rimanda sempre provider,
 * repo, modello…): passa, e la patch resta un no-op per quel campo.
 */
export function envLockedChanges(
  patch: Partial<Settings>,
  current: Settings,
  locked: ReadonlyArray<keyof Settings>,
): Array<keyof Settings> {
  return locked.filter((k) => k in patch && patch[k] !== undefined && patch[k] !== current[k]);
}

function parsePort(raw: string | undefined): number {
  const p = Number(raw);
  return Number.isFinite(p) && p > 0 && p < 65536 ? p : 8787;
}

function load(): Settings {
  let raw: string;
  try {
    raw = fs.readFileSync(STORE_FILE, "utf8");
  } catch {
    return resolveSettings(process.env, null); // no store file yet — first run
  }
  try {
    const { cleaned, dropped } = scrubEnvCopies(JSON.parse(raw) as Partial<Settings>, process.env);
    fileState = cleaned;
    if (dropped.length > 0) {
      try {
        writeStore(cleaned);
        console.warn(`${STORE_FILE}: tolti ${dropped.length} campi copiati dall'ambiente (${dropped.join(", ")}).`);
      } catch {
        /* sola lettura: il file resta com'è, i valori in memoria sono comunque giusti */
      }
    }
    return resolveSettings(process.env, cleaned);
  } catch (err) {
    console.warn(`⚠️  ${STORE_FILE} è corrotto (${(err as Error).message}); uso i valori di default.`);
    return resolveSettings(process.env, null);
  }
}

/**
 * Cosa scrivere in `.sams-runtime.json`. I campi **gestiti dall'ambiente** non prendono il
 * valore corrente (che viene dalla variabile): resta quello che il file aveva già, o niente.
 * Altrimenti un token messo su Render finiva nel file, e svuotare la variabile per revocarlo
 * lo faceva tornare dal file al riavvio (Ultrareview 2026-11-11).
 */
export function settingsToPersist(
  s: Settings,
  stored: Partial<Settings>,
  env: NodeJS.ProcessEnv = process.env,
): Partial<Omit<Settings, "port">> {
  const data: Partial<Omit<Settings, "port">> = {
    provider: s.provider,
    geminiApiKey: s.geminiApiKey,
    anthropicApiKey: s.anthropicApiKey,
    groqApiKey: s.groqApiKey,
    openrouterApiKey: s.openrouterApiKey,
    openaiApiKey: s.openaiApiKey,
    githubToken: s.githubToken,
    githubRepo: s.githubRepo,
    baseBranch: s.baseBranch,
    githubWebhookSecret: s.githubWebhookSecret,
    mcpServers: s.mcpServers,
    agentId: s.agentId,
    environmentId: s.environmentId,
    model: s.model,
    openPRs: s.openPRs,
    requireApproval: s.requireApproval,
    notionToken: s.notionToken,
    notionPageId: s.notionPageId,
    runtimeToken: s.runtimeToken,
    editorToken: s.editorToken,
    readonlyToken: s.readonlyToken,
  };
  const out = data as Record<string, unknown>;
  for (const key of envManagedKeys(env)) {
    if (key === "port") continue;
    if (key in stored) out[key] = stored[key];
    else delete out[key];
  }
  return data;
}

/**
 * Le versioni precedenti copiavano nel file i valori dell'ambiente. Un campo del file **uguale**
 * alla sua variabile è quasi certamente una di quelle copie: si toglie, così la revoca (variabile
 * svuotata) funziona anche sui deploy già esistenti. Un valore diverso resta: è una scelta fatta
 * dalla UI prima che il campo venisse bloccato.
 */
export function scrubEnvCopies(
  stored: Partial<Settings>,
  env: NodeJS.ProcessEnv = process.env,
): { cleaned: Partial<Settings>; dropped: Array<keyof Settings> } {
  const fromEnv = envOverrides(env);
  const cleaned: Partial<Settings> = { ...stored };
  const dropped: Array<keyof Settings> = [];
  for (const key of Object.keys(fromEnv) as Array<keyof Settings>) {
    if (key in cleaned && cleaned[key] === fromEnv[key]) {
      delete cleaned[key];
      dropped.push(key);
    }
  }
  return { cleaned, dropped };
}

// --- opzione C: scelte nel database, segreti nell'ambiente (o nel file in locale) -------

/** I segreti: non vanno mai nel database. In produzione arrivano dall'ambiente. */
export const SECRET_KEYS = [
  "geminiApiKey",
  "anthropicApiKey",
  "groqApiKey",
  "openrouterApiKey",
  "openaiApiKey",
  "githubToken",
  "githubWebhookSecret",
  "notionToken",
  "runtimeToken",
  "editorToken",
  "readonlyToken",
  "mcpServers",
] as const satisfies ReadonlyArray<keyof Settings>;

/** Le scelte non segrete: stanno nella tabella `settings`, così sopravvivono senza disco. */
export const CHOICE_KEYS = [
  "provider",
  "model",
  "githubRepo",
  "baseBranch",
  "openPRs",
  "requireApproval",
  "notionPageId",
  "agentId",
  "environmentId",
] as const satisfies ReadonlyArray<keyof Settings>;

type SecretKey = (typeof SECRET_KEYS)[number];
type ChoiceKey = (typeof CHOICE_KEYS)[number];

const PROVIDERS: ReadonlyArray<Provider> = ["gemini", "claude", "groq", "openrouter", "openai"];

/** La variabile d'ambiente che imposta un segreto (per i messaggi di errore della UI). */
export function secretEnvName(key: SecretKey): string {
  return ENV_KEYS.find(([, k]) => k === key)?.[0] ?? key;
}

/**
 * `SAMS_EPHEMERAL_DISK=1`: il server non ha un disco persistente (es. piano gratuito di
 * Render). Il file `.sams-runtime.json` sparirebbe al riavvio, quindi i segreti non si
 * salvano dalla UI: si impostano come variabili d'ambiente. Non lo si indovina dal codice.
 */
export function ephemeralDisk(env: NodeJS.ProcessEnv = process.env): boolean {
  const v = (env.SAMS_EPHEMERAL_DISK ?? "").trim().toLowerCase();
  return v !== "" && v !== "0" && v !== "false" && v !== "no";
}

/**
 * Disco effimero ma niente `SAMS_DB_URL`: il database SQLite starebbe sul disco che si
 * azzera, e account, chat e mondo sparirebbero al primo riavvio. Il server non parte:
 * su Render un deploy che non parte lascia in piedi la versione precedente.
 */
export function ephemeralWithoutDb(env: NodeJS.ProcessEnv = process.env): boolean {
  return ephemeralDisk(env) && (env.SAMS_DB_URL ?? "").trim() === "";
}

/** I segreti che la patch vorrebbe cambiare: su disco effimero vanno rifiutati. */
export function secretChanges(patch: Partial<Settings>, current: Settings): SecretKey[] {
  return SECRET_KEYS.filter((k) => k in patch && patch[k] !== undefined && patch[k] !== current[k]);
}

function pick<K extends keyof Settings>(src: Partial<Settings>, keys: ReadonlyArray<K>): Partial<Settings> {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (k in src && src[k] !== undefined) out[k] = src[k];
  return out as Partial<Settings>;
}

function omit(src: Partial<Settings>, keys: ReadonlyArray<keyof Settings>): Partial<Settings> {
  const out: Partial<Settings> = { ...src };
  for (const k of keys) delete out[k];
  return out;
}

/** Scelte → righe della tabella (valori in JSON, così i booleani restano booleani). */
export function encodeChoices(choices: Partial<Settings>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of CHOICE_KEYS) if (k in choices && choices[k] !== undefined) out[k] = JSON.stringify(choices[k]);
  return out;
}

/** Righe della tabella → scelte. Righe sconosciute, corrotte o del tipo sbagliato si ignorano. */
export function decodeChoices(rows: Record<string, string>): Partial<Settings> {
  const out: Record<string, unknown> = {};
  for (const k of CHOICE_KEYS as ReadonlyArray<ChoiceKey>) {
    if (!(k in rows)) continue;
    let v: unknown;
    try {
      v = JSON.parse(rows[k]);
    } catch {
      continue;
    }
    if (k === "openPRs" || k === "requireApproval") {
      if (typeof v === "boolean") out[k] = v;
    } else if (k === "provider") {
      if (typeof v === "string" && PROVIDERS.includes(v as Provider)) out[k] = v;
    } else if (typeof v === "string") {
      out[k] = v;
    }
  }
  return out as Partial<Settings>;
}

/** Il contenuto del file come caricato (senza le copie dell'ambiente): base per `persist()`. */
let fileState: Partial<Settings> = {};
let current: Settings = load();
/** Il database delle scelte, collegato da `initSettings()` dopo `initDb()`. Prima: solo file. */
let settingsDb: SqlDriver | null = null;
/** Le scelte come stanno nella tabella (senza le copie dell'ambiente). */
let dbState: Partial<Settings> = {};
/** Scritture serializzate: due salvataggi da ⚙ non si sovrappongono nel database. */
const settingsLock = new Mutex();

/**
 * Collega le impostazioni al database (va chiamata subito dopo `initDb()`):
 * 1. legge le scelte dalla tabella `settings`;
 * 2. se la tabella è vuota, ci **importa** le scelte che il file aveva (una volta sola);
 * 3. toglie dalla tabella le copie identiche alle variabili d'ambiente (come per il file);
 * 4. toglie le scelte dal file, che da qui in poi tiene solo i segreti (se il disco è
 *    effimero il file non si tocca).
 * Ritorna i campi importati dal file, per il log di avvio.
 */
export function initSettings(d: SqlDriver, env: NodeJS.ProcessEnv = process.env): Promise<{ imported: string[] }> {
  return settingsLock.run(async () => {
    const rows = await loadSettingRows(d);
    let stored = decodeChoices(rows);
    let imported: string[] = [];
    if (Object.keys(rows).length === 0) {
      const fromFile = pick(fileState, CHOICE_KEYS);
      imported = Object.keys(fromFile);
      if (imported.length > 0) await saveSettingRows(d, encodeChoices(fromFile));
      stored = fromFile;
    }
    const { cleaned, dropped } = scrubEnvCopies(stored, env);
    if (dropped.length > 0) await saveSettingRows(d, {}, dropped);
    settingsDb = d;
    dbState = cleaned;
    if (Object.keys(pick(fileState, CHOICE_KEYS)).length > 0 && !ephemeralDisk(env)) {
      const secretsOnly = omit(fileState, CHOICE_KEYS);
      try {
        writeStore(secretsOnly);
        fileState = secretsOnly;
      } catch {
        /* file in sola lettura: resta com'è, il database vince comunque sulle scelte */
      }
    }
    current = resolveSettings(env, { ...fileState, ...dbState });
    return { imported };
  });
}

/**
 * Salva `next`. Con il database collegato: le scelte vanno nella tabella; i segreti nel
 * file solo se la patch ne cambia qualcuno (mai su disco effimero). Senza database (test,
 * script): tutto nel file, come prima.
 */
async function persist(next: Settings, changed: ReadonlyArray<keyof Settings>): Promise<void> {
  const env = process.env;
  if (!settingsDb) {
    const data = settingsToPersist(next, fileState, env);
    writeStore(data);
    fileState = data;
    return;
  }
  const choices = pick(settingsToPersist(next, dbState, env), CHOICE_KEYS);
  const remove = CHOICE_KEYS.filter((k) => !(k in choices));
  await saveSettingRows(settingsDb, encodeChoices(choices), remove);
  dbState = choices;
  const secretChanged = changed.some((k) => (SECRET_KEYS as ReadonlyArray<keyof Settings>).includes(k));
  if (secretChanged && !ephemeralDisk(env)) {
    const data = pick(settingsToPersist(next, fileState, env), SECRET_KEYS);
    writeStore(data);
    fileState = data;
  }
}

function writeStore(data: Partial<Omit<Settings, "port">>): void {
  // 0o600: the file holds API tokens in plaintext — keep it owner-only.
  fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), { encoding: "utf8", mode: 0o600 });
  try {
    fs.chmodSync(STORE_FILE, 0o600); // enforce perms even if the file pre-existed with looser mode
  } catch {
    /* best-effort on platforms without chmod */
  }
}

export function getSettings(): Settings {
  return current;
}

/** Fields the UI is allowed to change. */
export type SettingsPatch = Partial<
  Pick<
    Settings,
    | "provider"
    | "geminiApiKey"
    | "anthropicApiKey"
    | "groqApiKey"
    | "openrouterApiKey"
    | "openaiApiKey"
    | "githubToken"
    | "githubRepo"
    | "baseBranch"
    | "model"
    | "openPRs"
    | "requireApproval"
    | "notionToken"
    | "notionPageId"
    | "runtimeToken"
    | "editorToken"
  >
>;

/**
 * Applica una patch dalla UI. Prima si salva, poi si aggiorna la memoria: se il database
 * non risponde, le impostazioni in uso restano quelle di prima (e la richiesta fallisce).
 */
export function updateSettings(patch: SettingsPatch): Promise<Settings> {
  return settingsLock.run(async () => {
    const next = { ...current, ...patch };
    await persist(next, Object.keys(patch) as Array<keyof Settings>);
    current = next;
    return current;
  });
}

/** Store the provisioned Agent + Environment IDs (Claude provider only). */
export function setProvision(ids: { agentId: string; environmentId: string }): Promise<Settings> {
  return settingsLock.run(async () => {
    const next = { ...current, agentId: ids.agentId, environmentId: ids.environmentId };
    await persist(next, ["agentId", "environmentId"]);
    current = next;
    return current;
  });
}

export function isConfigured(): boolean {
  const s = getSettings();
  if (s.provider === "gemini") return s.geminiApiKey.length > 0;
  if (s.provider === "groq") return s.groqApiKey.length > 0;
  if (s.provider === "openrouter") return s.openrouterApiKey.length > 0;
  if (s.provider === "openai") return s.openaiApiKey.length > 0;
  return s.anthropicApiKey.length > 0;
}

export function isProvisioned(): boolean {
  const s = getSettings();
  // Gemini, Groq and OpenRouter are self-hosted loops — no provisioning step.
  if (s.provider === "gemini" || s.provider === "groq" || s.provider === "openrouter" || s.provider === "openai") return true;
  return s.agentId.length > 0 && s.environmentId.length > 0;
}

export function isReady(): boolean {
  return isConfigured() && isProvisioned();
}

/** Safe snapshot for the UI — never leaks the secret values themselves. */
export function publicStatus() {
  const s = getSettings();
  return {
    provider: s.provider,
    hasGeminiKey: s.geminiApiKey.length > 0,
    hasAnthropicKey: s.anthropicApiKey.length > 0,
    hasGroqKey: s.groqApiKey.length > 0,
    hasOpenrouterKey: s.openrouterApiKey.length > 0,
    hasOpenaiKey: s.openaiApiKey.length > 0,
    hasGithubToken: s.githubToken.length > 0,
    provisioned: isProvisioned(),
    ready: isReady(),
    repo: s.githubRepo,
    baseBranch: s.baseBranch,
    model: s.model,
    openPRs: s.openPRs,
    requireApproval: s.requireApproval,
    hasNotionToken: s.notionToken.length > 0,
    notionPageId: s.notionPageId,
    notionReady: s.notionToken.length > 0,
    hasToken: s.runtimeToken.length > 0,
    hasEditorToken: s.editorToken.length > 0,
    hasReadonlyToken: s.readonlyToken.length > 0,
  };
}

/** Campi che la finestra delle impostazioni sa modificare (incl. il provisioning). */
const UI_EDITABLE_KEYS: ReadonlyArray<keyof Settings> = [
  "provider",
  "geminiApiKey",
  "anthropicApiKey",
  "groqApiKey",
  "openrouterApiKey",
  "openaiApiKey",
  "githubToken",
  "githubRepo",
  "baseBranch",
  "model",
  "openPRs",
  "requireApproval",
  "notionToken",
  "notionPageId",
  "agentId",
  "environmentId",
];

/**
 * Quali campi *modificabili dalla UI* sono bloccati dall'ambiente. Solo per l'owner:
 * anche i soli nomi dicono a un estraneo cosa è configurato (o cosa manca). Non
 * include mai i campi di sola sicurezza (token dei ruoli, secret dei webhook, MCP).
 */
export function envManagedForUi(env: NodeJS.ProcessEnv = process.env): Array<keyof Settings> {
  return envManagedKeys(env).filter((k) => UI_EDITABLE_KEYS.includes(k));
}
