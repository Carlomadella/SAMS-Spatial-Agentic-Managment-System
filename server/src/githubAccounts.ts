import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { jsonFetch } from "./http";

/**
 * "Accedi con GitHub": ogni utente collega il proprio account GitHub (GitHub OAuth App)
 * e sceglie una delle sue repo. I task che assegna lavorano lì, con il SUO token.
 *
 * Serve una OAuth App su GitHub e tre variabili sul server:
 * - `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`: quelle della OAuth App;
 * - `SAMS_SECRET_KEY`: una stringa lunga e casuale. Cifra i token prima che finiscano nel
 *   database (AES-256-GCM): chi legge il DB senza la chiave non può usarli.
 * Se ne manca anche una sola, il collegamento è spento e si usa il token del server.
 */

export interface GithubOAuthConfig {
  clientId: string;
  clientSecret: string;
  secretKey: string;
}

/** Permessi chiesti a GitHub: `repo` serve per leggere/scrivere e aprire PR anche sulle repo private. */
export const GITHUB_OAUTH_SCOPE = "repo";

const REPO_RE = /^[\w.-]+\/[\w.-]+$/;

export function isValidRepoName(repo: unknown): repo is string {
  return typeof repo === "string" && REPO_RE.test(repo);
}

/** Un nome di branch ragionevole (niente spazi, `..`, caratteri di controllo). */
export function isValidBranchName(branch: unknown): branch is string {
  return (
    typeof branch === "string" &&
    branch.length > 0 &&
    branch.length <= 200 &&
    /^[\w./-]+$/.test(branch) &&
    !branch.includes("..") &&
    !branch.startsWith("/") &&
    !branch.endsWith("/")
  );
}

/** La configurazione OAuth dall'ambiente, o null se il collegamento non è attivo. */
export function githubOAuthConfig(env: NodeJS.ProcessEnv = process.env): GithubOAuthConfig | null {
  const clientId = (env.GITHUB_CLIENT_ID ?? "").trim();
  const clientSecret = (env.GITHUB_CLIENT_SECRET ?? "").trim();
  const secretKey = (env.SAMS_SECRET_KEY ?? "").trim();
  if (!clientId || !clientSecret || !secretKey) return null;
  return { clientId, clientSecret, secretKey };
}

// --- cifratura del token -----------------------------------------------------

const ENC_PREFIX = "v1:";

function keyBytes(secretKey: string): Buffer {
  // SHA-256 della stringa: qualunque lunghezza diventa una chiave AES-256 da 32 byte.
  return createHash("sha256").update(secretKey, "utf8").digest();
}

/** Cifra un token per il database: `v1:` + base64(iv | tag | testo cifrato). */
export function encryptToken(token: string, secretKey: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(secretKey), iv);
  const ct = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return ENC_PREFIX + Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

/** Decifra un token salvato. Null se è corrotto o la chiave è cambiata. */
export function decryptToken(enc: string, secretKey: string): string | null {
  if (!enc.startsWith(ENC_PREFIX)) return null;
  try {
    const raw = Buffer.from(enc.slice(ENC_PREFIX.length), "base64");
    if (raw.length < 12 + 16 + 1) return null;
    const decipher = createDecipheriv("aes-256-gcm", keyBytes(secretKey), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

// --- stato OAuth --------------------------------------------------------------

/**
 * Il parametro `state` del giro OAuth. Lega il ritorno da GitHub all'utente che l'ha
 * avviato: la sessione viaggia come bearer token (non come cookie), quindi la callback
 * non saprebbe altrimenti di chi è. Monouso, scade dopo 10 minuti. Vive in memoria:
 * SAMS gira come un solo processo.
 *
 * Lo state da solo non basta: chi lo genera potrebbe mandare il link a un'altra persona,
 * che autorizzando collegherebbe il PROPRIO GitHub all'account di chi l'ha generato. Per
 * questo ogni state ha anche un `nonce` che il server mette in un cookie HttpOnly del
 * browser che ha avviato il giro: la callback vale solo se arriva da quello stesso browser.
 */
export class OAuthStates {
  private readonly states = new Map<string, { userId: string; nonce: string; expiresAt: number }>();

  constructor(
    private readonly ttlMs = 10 * 60_000,
    private readonly max = 500,
  ) {}

  create(userId: string, now = Date.now()): { state: string; nonce: string } {
    this.sweep(now);
    if (this.states.size >= this.max) {
      const oldest = this.states.keys().next().value;
      if (oldest !== undefined) this.states.delete(oldest);
    }
    const state = randomBytes(24).toString("hex");
    const nonce = randomBytes(24).toString("hex");
    this.states.set(state, { userId, nonce, expiresAt: now + this.ttlMs });
    return { state, nonce };
  }

  /**
   * L'utente legato a `state`, una volta sola, solo se `nonce` (dal cookie del browser) è
   * quello emesso con lo state. Null se sconosciuto, scaduto o da un altro browser.
   */
  consume(state: string, nonce: string, now = Date.now()): string | null {
    const hit = this.states.get(state);
    if (!hit) return null;
    this.states.delete(state);
    if (hit.expiresAt <= now) return null;
    const a = Buffer.from(nonce, "utf8");
    const b = Buffer.from(hit.nonce, "utf8");
    return a.length === b.length && timingSafeEqual(a, b) ? hit.userId : null;
  }

  private sweep(now: number): void {
    for (const [k, v] of this.states) if (v.expiresAt <= now) this.states.delete(k);
  }
}

/** Indirizzo della pagina di GitHub dove l'utente autorizza SAMS. */
export function authorizeUrl(clientId: string, redirectUri: string, state: string): string {
  const q = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: GITHUB_OAUTH_SCOPE,
    state,
    allow_signup: "true",
  });
  return `https://github.com/login/oauth/authorize?${q.toString()}`;
}

/** Dove GitHub rimanda l'utente dopo l'autorizzazione (va scritto uguale nella OAuth App). */
export function callbackUrl(publicBase: string): string {
  return `${publicBase}/api/github/callback`;
}

// --- chiamate a GitHub --------------------------------------------------------

const API = "https://api.github.com";

function apiHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "sams-runtime",
  };
}

/** Scambia il `code` della callback con il token dell'utente. */
export async function exchangeCode(cfg: GithubOAuthConfig, code: string, redirectUri: string): Promise<string> {
  const res = await jsonFetch<{ access_token?: string; error?: string; error_description?: string }>(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", "User-Agent": "sams-runtime" },
      body: JSON.stringify({ client_id: cfg.clientId, client_secret: cfg.clientSecret, code, redirect_uri: redirectUri }),
    },
    "GitHub OAuth",
  );
  if (!res.access_token) throw new Error(res.error_description || res.error || "GitHub non ha restituito un token");
  return res.access_token;
}

/** Il nome utente GitHub del proprietario del token. */
export async function fetchLogin(token: string): Promise<string> {
  const u = await jsonFetch<{ login?: string }>(`${API}/user`, { headers: apiHeaders(token) }, "GitHub");
  if (!u.login) throw new Error("GitHub non ha restituito il nome utente");
  return u.login;
}

export interface UserRepo {
  fullName: string;
  private: boolean;
  defaultBranch: string;
  /** Il token può scriverci (serve per branch, commit e PR). */
  canPush: boolean;
}

interface RawRepo {
  full_name?: string;
  private?: boolean;
  default_branch?: string;
  permissions?: { push?: boolean };
}

function toUserRepo(r: RawRepo): UserRepo | null {
  if (!r.full_name || !isValidRepoName(r.full_name)) return null;
  return {
    fullName: r.full_name,
    private: Boolean(r.private),
    defaultBranch: r.default_branch || "main",
    canPush: Boolean(r.permissions?.push),
  };
}

/** Le repo dell'utente (sue, da collaboratore o delle sue organizzazioni), più recenti prima. */
export async function listUserRepos(token: string): Promise<UserRepo[]> {
  const q = new URLSearchParams({
    per_page: "100",
    sort: "pushed",
    affiliation: "owner,collaborator,organization_member",
  });
  const rows = await jsonFetch<RawRepo[]>(`${API}/user/repos?${q.toString()}`, { headers: apiHeaders(token) }, "GitHub");
  return (Array.isArray(rows) ? rows : []).map(toUserRepo).filter((r): r is UserRepo => r !== null);
}

/** Informazioni su una repo vista dal token dell'utente (404 se non ci può accedere). */
export async function fetchUserRepo(token: string, repo: string): Promise<UserRepo | null> {
  if (!isValidRepoName(repo)) return null;
  const [owner, name] = repo.split("/");
  const r = await jsonFetch<RawRepo>(
    `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`,
    { headers: apiHeaders(token) },
    "GitHub",
  );
  return toUserRepo(r);
}

/** Revoca il token su GitHub quando l'utente scollega l'account. Best-effort. */
export async function revokeToken(cfg: GithubOAuthConfig, token: string): Promise<void> {
  const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64");
  await jsonFetch(
    `${API}/applications/${encodeURIComponent(cfg.clientId)}/token`,
    {
      method: "DELETE",
      headers: { ...apiHeaders(""), Authorization: `Basic ${basic}`, "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: token }),
    },
    "GitHub",
  );
}

// --- cookie del giro OAuth --------------------------------------------------------

export const OAUTH_COOKIE = "sams_gh_oauth";

/** Cookie col nonce: HttpOnly, SameSite=Lax (arriva sul ritorno da github.com), solo su /api/github. */
export function oauthCookie(nonce: string, secure: boolean, maxAgeSec = 600): string {
  return `${OAUTH_COOKIE}=${nonce}; Path=/api/github; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure ? "; Secure" : ""}`;
}

/** Il valore del cookie del giro OAuth dall'header `Cookie`, o "". */
export function readOauthCookie(header: string | undefined): string {
  for (const part of (header ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === OAUTH_COOKIE) return v.join("=");
  }
  return "";
}
