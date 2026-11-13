import express, { type NextFunction, type Request, type Response } from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { envLockedChanges, envManagedForUi, envManagedKeys, ephemeralDisk, ephemeralWithoutDb, getSettings, initSettings, isReady, publicStatus, secretChanges, secretEnvName, updateSettings, type SettingsPatch } from "./config";
import { log } from "./log";
import { provision } from "./provision";
import { runTask } from "./sessions";
import { runGeminiTask } from "./agent";
import { runGroqTask } from "./groq";
import { runOpenrouterTask } from "./openrouter";
import { runOpenaiTask } from "./openai";
import { addIssueLabel, createBranch, createPullRequest, getRepoTree, githubContext, listIssues, readFile, removeIssueLabel, runWithGithub, runWithRepo, writeFilesAtomic, type GithubContext } from "./github";
import { authorizeUrl, callbackUrl, decryptToken, encryptToken, exchangeCode, fetchLogin, fetchUserRepo, githubOAuthConfig, isValidBranchName, isValidRepoName, listUserRepos, oauthCookie, OAuthStates, readOauthCookie, revokeToken } from "./githubAccounts";
import { claimIssue, getClaims, getSimLabel, releaseByAgent, releaseIssue, simEnabled, simStatus, startSim, stopSim } from "./simLoop";
import { HttpError } from "./http";
import { checkWebhookAuth, parseGithubEvent, parsePushWatering } from "./webhook";
import { emptyGarden, water } from "./garden/model";
import { getPending, clearPending } from "./pendingBuffer";
import { registerGardenRoutes } from "./garden/routes";
import { getStore, initGardenStore } from "./garden/store";
import { buildPublicSnapshot, readonlyAuthorized } from "./publicView";
import { metricsSnapshot, recordChatMessage, recordClients, recordEvent } from "./metrics";
import { clearMemory, consumeInvite, consumeToken, createInvite, getInviteByHash, listPendingInvites, pruneInvites, revokeInvite, countOwners, countUsers, createAuthSession, createToken, createUser, db, dbBackend, deleteAllUserSessions, deleteAuthSession, deleteRoutine, deleteUserSessionsExcept, getSessionUser, getToken, getUserByEmail, getUserById, getGithubLink, saveGithubLink, setGithubRepo, deleteGithubLink, initDb, insertChatMessage, insertRoutine, listChatMessages, listMemory, listRoutines, listUsers, loadWorldSnapshot, markRoutineRun, pruneAuthSessions, pruneTokens, recentTasks, saveWorldAgents, setEmailVerified, setRoutineEnabled, setUserRole, taskStats, updateUserPassword } from "./db";
import { hashPassword, isValidEmail, newSessionToken, normalizeEmail, publicUser, sanitizeName, SESSION_TTL_MS, validatePassword, verifyPassword, type User } from "./auth";
import { createMailer, inviteLink, mailerCanDeliver, normalizeBaseUrl, renderInviteEmail, renderResetEmail, renderVerifyEmail, resetLink, resolveMailerConfig, verifyLink } from "./mailer";
import { hashToken, isTokenUsable, newToken, RESET_TTL_MS, tokenExpiry, tokenRejection, VERIFY_TTL_MS } from "./tokens";
import { describeSchedule, dueRoutines, sanitizeRoutine } from "./routines";
import { isFreshWrite, sanitizeWorldAgents, summarizeWorld } from "./worldState";
import { sanitizeChatInput, type ChatMessage } from "./chat";
import { distinctPeople, presenceState, sanitizeObserverIdentity, type Observer } from "./presence";
import { sanitizeCursor } from "./cursors";
import { sanitizeWorldSim } from "./worldsim";
import { sanitizeSelection } from "./selections";
import { claimDriver, DRIVER_TTL, isLeaseHolder, isLeaseValid, releaseDriver, type DriverLease } from "./driver";
import { createRateLimiter, identityKey } from "./rateLimit";
import { actorLabel } from "./attribution";
import { bearerToken, isAnonymousWhenEnforced, resolveRole, roleAtLeast, rolesEnforced, type Role, type RoleTokens } from "./roles";
import { randomUUID } from "node:crypto";
import { StreamTickets } from "./streamTickets";
import { heartbeatTick } from "./streamHeartbeat";
import { INVITE_TTL_MS, inviteRejection, isInvitableRole, registrationRole, type InvitableRole } from "./invites";
import type { AssignBody, WireEvent } from "./types";
import { parseTrustProxy } from "./trustProxy";
import { Mutex } from "./sql";

const app = express();

// IP vero del client dietro un proxy (Render): vedi trustProxy.ts. Senza, tutti i limiti
// per IP valgono come uno solo, condiviso fra tutti gli utenti.
const trustProxy = parseTrustProxy(process.env.SAMS_TRUST_PROXY);
if (trustProxy.warning) log.warn(trustProxy.warning);
app.set("trust proxy", trustProxy.value);

/** I token dei tre tier dalle impostazioni correnti (owner/editor/viewer). */
function roleTokens(): RoleTokens {
  const s = getSettings();
  return { owner: s.runtimeToken, editor: s.editorToken, viewer: s.readonlyToken };
}

/**
 * Esiste almeno un account registrato? Da lì in poi i ruoli valgono anche senza token
 * statici (decisione 1A). Se il DB non risponde si sceglie la via **chiusa**: meglio un
 * 401 di troppo che un anonimo owner.
 */
let accountsSeen = false;
async function accountsExist(): Promise<boolean> {
  // Gli account non si cancellano: una volta visto il primo, la risposta resta "sì" e si
  // risparmia una query a ogni richiesta (con MySQL è un viaggio di rete).
  if (accountsSeen) return true;
  try {
    accountsSeen = (await countUsers(db())) > 0;
    return accountsSeen;
  } catch (err) {
    log.warn("Conteggio account non riuscito: ruoli considerati attivi", { err: String(err) });
    return true;
  }
}

/**
 * Serializza le sezioni "leggi → controlla → scrivi" che prima erano atomiche perché
 * sincrone (nessun `await` in mezzo): il CAS del mondo e le operazioni sugli account
 * (primo owner, ultimo owner). Con il DB asincrono due richieste potrebbero intrecciarsi.
 * Vale per un solo processo, che è il modo in cui SAMS gira (un'istanza).
 */
const worldLock = new Mutex();
const accountsLock = new Mutex();

/**
 * Ruolo risolto per la richiesta corrente. Un **token di sessione utente valido** (auth
 * reale) vince e porta il ruolo dell'account; altrimenti si ricade sui token statici da
 * env (owner solo in dev aperto: nessun token e nessun account). Così una persona loggata sul sito
 * governa anche la workspace col proprio ruolo, senza doppioni di configurazione.
 */
async function roleOf(req: Request): Promise<Role> {
  const provided = bearerToken(req.headers.authorization);
  if (provided) {
    const user = await getSessionUser(db(), provided);
    if (user) return user.role;
  }
  return resolveRole(roleTokens(), provided, await accountsExist());
}

/**
 * Guardia per ruolo (Roadmap 4, frontiera #2). Con nessun token configurato ogni
 * richiesta è "owner" → comportamento identico a prima. Con i token impostati:
 * `min="owner"` protegge config/segreti, `min="editor"` protegge l'avvio di lavoro.
 * 401 se manca del tutto il token, 403 se il ruolo è insufficiente.
 */
function requireRole(min: Role): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  // Express 5 inoltra all'error handler un middleware asincrono che rifiuta (DB giù → 500).
  return async (req, res, next) => {
    const provided = bearerToken(req.headers.authorization);
    // Con i ruoli attivi, un anonimo risulta "viewer" (vedi resolveRole) ma non deve
    // superare nemmeno la guardia più bassa: serve una credenziale riconosciuta.
    const hasSession = provided ? (await getSessionUser(db(), provided)) !== null : false;
    if (isAnonymousWhenEnforced(roleTokens(), provided, hasSession, await accountsExist())) {
      log.warn("Richiesta anonima respinta", { path: req.path, ip: req.ip, need: min });
      res.status(401).json({ error: "Token mancante o non valido" });
      return;
    }
    const role = await roleOf(req);
    if (roleAtLeast(role, min)) { next(); return; }
    log.warn("Richiesta non autorizzata", { path: req.path, ip: req.ip, role, need: min });
    if (!provided) {
      res.status(401).json({ error: "Token mancante o non valido" });
    } else {
      res.status(403).json({ error: `Ruolo insufficiente (serve ${min}, hai ${role})`, role, need: min });
    }
  };
}

// Explicit, permissive CORS for the local UI (covers SSE + preflight). DELETE is
// listed because routines and agent memory are deleted with it: without it a UI on
// another origin (VITE_SAMS_BACKEND_URL) would see those calls fail at preflight.
app.use((req: Request, res: Response, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});
// Capture the raw body so the GitHub webhook can verify its HMAC signature
// (which is computed over the exact bytes, not the re-serialised JSON).
app.use(
  express.json({
    limit: "2mb",
    verify: (req, _res, buf) => {
      (req as Request & { rawBody?: string }).rawBody = buf.toString("utf8");
    },
  }),
);

/** Connected SSE clients (the SAMS browser UIs), each with its declared identity. */
const clients = new Map<Response, Observer>();
/**
 * Chi ha aperto ogni stream (vedi `viewIdentity`). L'id di una vista è pubblico — arriva a
 * tutti con la presenza — quindi non basta a dimostrare che la vista è tua: per rinominarla
 * o guidare il mondo al suo posto serve anche la stessa identità (Ultrareview 2026-11-11).
 */
const clientKeys = new Map<Response, string>();

/** L'identità dietro una credenziale: l'account se è una sessione, altrimenti la credenziale stessa. */
async function viewIdentity(token: string): Promise<string> {
  const user = token ? await getSessionUser(db(), token) : null;
  return user ? `u:${user.id}` : `c:${token}`;
}
const HEARTBEAT_MS = 25000;

/** Write one already-serialized SSE line to every live client, dropping dead ones. */
function writeToClients(line: string): void {
  for (const res of clients.keys()) {
    if (res.writableEnded || res.destroyed) {
      clients.delete(res);
      continue;
    }
    try {
      res.write(line);
    } catch {
      clients.delete(res); // socket died between checks — drop it
    }
  }
}

function broadcast(e: WireEvent): void {
  recordEvent(e);
  // Release the per-agent cooldown once a task reaches a terminal state.
  if (e.agentId && (e.status === "done" || e.status === "review" || e.status === "idle" || e.status === "blocked")) {
    lastAssign.delete(e.agentId);
  }
  writeToClients(`data: ${JSON.stringify(e)}\n\n`);
}

/**
 * Presence (Roadmap 4, frontiera #2): tell every connected view how many views
 * are watching right now AND who they are (distinct names). Fired on connect/
 * disconnect and on a live rename. Deliberately NOT routed through `broadcast`/
 * `recordEvent` — it carries no agent state and must not inflate the runtime's
 * event metrics. `presence` stays a bare count for backward-compatible clients;
 * `people` is the new named list.
 */
function broadcastPresence(): void {
  recordClients(clients.size); // track the peak for observability
  const { views, people } = presenceState([...clients.values()]);
  writeToClients(
    `data: ${JSON.stringify({ agentId: "presence", agentName: "presence", presence: views, people })}\n\n`,
  );
}

/**
 * Presence realtime / agenti live (Roadmap 4, frontiera #2): after a view saves a
 * new authoritative world snapshot, push it to every connected view so they adopt
 * it immediately (instead of waiting ~20s for their own pull). Like presence, it
 * carries no runtime event — kept out of `broadcast`/`recordEvent` so it doesn't
 * inflate the event metrics. The writer adopting its own echo is a no-op client-side.
 */
function broadcastWorld(snapshot: { agents: unknown[]; version: number; updatedAt: number }): void {
  writeToClients(
    `data: ${JSON.stringify({ agentId: "world", agentName: "world", world: snapshot })}\n\n`,
  );
}

// Driver lease (opzione B3): quale vista è il simulatore autorevole. Vive in
// memoria (effimero); un `holderId` vuoto significa "nessun driver".
let driverLease: DriverLease | null = null;

function currentDriver(now: number): { holderId: string; name: string } {
  return isLeaseValid(driverLease, now)
    ? { holderId: driverLease!.holderId, name: driverLease!.name }
    : { holderId: "", name: "" };
}

function broadcastDriver(): void {
  const d = currentDriver(Date.now());
  writeToClients(`data: ${JSON.stringify({ agentId: "driver", agentName: "driver", driver: d })}\n\n`);
}

// --- GitHub di ogni utente ("Accedi con GitHub") ---------------------------
// Con la OAuth App configurata (vedi githubAccounts.ts) ogni account collega il proprio
// GitHub e sceglie una sua repo: i task che assegna lavorano lì, con il suo token. Senza
// OAuth App (sviluppo locale, script con token statici) valgono token e repo del server.

const oauthStates = new OAuthStates();
const publicBase = (): string => normalizeBaseUrl(process.env.SAMS_PUBLIC_URL);

type UserGithub =
  | { kind: "server" }
  | { kind: "missing"; error: string }
  | { kind: "user"; ctx: GithubContext; login: string };

/** L'utente con sessione valida dietro la richiesta, o null. */
async function sessionUser(req: Request): Promise<User | null> {
  const provided = bearerToken(req.headers.authorization);
  return provided ? getSessionUser(db(), provided) : null;
}

/**
 * Su quale GitHub lavora chi fa la richiesta:
 * - `server`: collegamento spento, o richiesta senza account (token statici) → impostazioni del server;
 * - `missing`: collegamento attivo ma l'utente non ha ancora collegato GitHub o scelto la repo;
 * - `user`: repo, token e branch base dell'utente.
 */
async function userGithub(req: Request): Promise<UserGithub> {
  const cfg = githubOAuthConfig();
  if (!cfg) return { kind: "server" };
  const user = await sessionUser(req);
  if (!user) return { kind: "server" };
  const link = await getGithubLink(db(), user.id);
  if (!link) return { kind: "missing", error: "Collega il tuo account GitHub in ⚙ Impostazioni per far lavorare gli agenti sulle tue repo." };
  const token = decryptToken(link.tokenEnc, cfg.secretKey);
  if (!token) return { kind: "missing", error: "Il collegamento a GitHub non è più valido: ricollegalo in ⚙ Impostazioni." };
  if (!link.repo) return { kind: "missing", error: "Scegli in ⚙ Impostazioni la repo GitHub su cui far lavorare gli agenti." };
  return { kind: "user", login: link.login, ctx: { repo: link.repo, token, baseBranch: link.baseBranch || "main" } };
}

/** Il token GitHub (in chiaro) dell'utente collegato, o null. */
async function linkedToken(req: Request): Promise<{ user: User; token: string } | null> {
  const cfg = githubOAuthConfig();
  const user = cfg ? await sessionUser(req) : null;
  const link = cfg && user ? await getGithubLink(db(), user.id) : null;
  const token = cfg && link ? decryptToken(link.tokenEnc, cfg.secretKey) : null;
  return user && token ? { user, token } : null;
}

/** Stato del collegamento GitHub di chi chiama (mai il token). */
app.get("/api/github/me", async (req: Request, res: Response) => {
  const cfg = githubOAuthConfig();
  const user = await sessionUser(req);
  const off = { enabled: Boolean(cfg), signedIn: Boolean(user), connected: false, login: "", repo: "", baseBranch: "" };
  if (!cfg || !user) { res.json(off); return; }
  const link = await getGithubLink(db(), user.id);
  if (!link || decryptToken(link.tokenEnc, cfg.secretKey) === null) { res.json(off); return; }
  res.json({ ...off, connected: true, login: link.login, repo: link.repo, baseBranch: link.baseBranch });
});

/** Avvia il collegamento: restituisce l'indirizzo di GitHub dove autorizzare SAMS. */
app.post("/api/github/connect", async (req: Request, res: Response) => {
  const cfg = githubOAuthConfig();
  if (!cfg) { res.status(503).json({ error: "Il collegamento a GitHub non è configurato su questo server." }); return; }
  const user = await sessionUser(req);
  if (!user) { res.status(401).json({ error: "Accedi al tuo account SAMS per collegare GitHub." }); return; }
  const { state, nonce } = oauthStates.create(user.id);
  res.setHeader("Set-Cookie", oauthCookie(nonce, publicBase().startsWith("https://")));
  res.json({ url: authorizeUrl(cfg.clientId, callbackUrl(publicBase()), state) });
});

/** Ritorno da GitHub: salva il token (cifrato) e torna alla workspace. */
app.get("/api/github/callback", async (req: Request, res: Response) => {
  const back = (outcome: string) => res.redirect(`${publicBase()}/app?github=${outcome}`);
  const cfg = githubOAuthConfig();
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const code = typeof req.query.code === "string" ? req.query.code : "";
  // Vale solo dal browser che ha avviato il giro (cookie col nonce); poi il cookie si cancella.
  const nonce = readOauthCookie(req.headers.cookie);
  res.setHeader("Set-Cookie", oauthCookie("", publicBase().startsWith("https://"), 0));
  const userId = state && nonce ? oauthStates.consume(state, nonce) : null;
  if (!cfg || !userId || !code) { back(req.query.error === "access_denied" ? "denied" : "error"); return; }
  try {
    const token = await exchangeCode(cfg, code, callbackUrl(publicBase()));
    const login = await fetchLogin(token);
    await saveGithubLink(db(), userId, login, encryptToken(token, cfg.secretKey));
    log.info("GitHub collegato", { userId, login });
    back("connected");
  } catch (err) {
    log.warn("Collegamento GitHub fallito", { err: String(err) });
    back("error");
  }
});

/** Le repo GitHub dell'utente collegato, per scegliere quella di lavoro. */
app.get("/api/github/repos", async (req: Request, res: Response) => {
  const linked = await linkedToken(req);
  if (!linked) { res.status(409).json({ error: "Collega prima il tuo account GitHub." }); return; }
  try {
    res.json({ repos: await listUserRepos(linked.token) });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

/** Sceglie la repo (owner/repo) e il branch base. Verifica che il token ci possa scrivere. */
app.post("/api/github/repo", async (req: Request, res: Response) => {
  const linked = await linkedToken(req);
  if (!linked) { res.status(409).json({ error: "Collega prima il tuo account GitHub." }); return; }
  const body = (req.body ?? {}) as { repo?: unknown; baseBranch?: unknown };
  const repo = typeof body.repo === "string" ? body.repo.trim() : "";
  if (!isValidRepoName(repo)) { res.status(400).json({ error: "Repo non valida: usa il formato owner/repo." }); return; }
  const wanted = typeof body.baseBranch === "string" ? body.baseBranch.trim() : "";
  if (wanted && !isValidBranchName(wanted)) { res.status(400).json({ error: "Nome del branch base non valido." }); return; }
  let info;
  try {
    info = await fetchUserRepo(linked.token, repo);
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) {
      res.status(404).json({ error: `Il tuo account GitHub non vede la repo ${repo}.` });
      return;
    }
    res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
    return;
  }
  if (!info) { res.status(404).json({ error: `Il tuo account GitHub non vede la repo ${repo}.` }); return; }
  if (!info.canPush) { res.status(403).json({ error: `Non hai i permessi di scrittura su ${repo}: gli agenti non potrebbero creare branch e PR.` }); return; }
  const baseBranch = wanted || info.defaultBranch;
  await setGithubRepo(db(), linked.user.id, info.fullName, baseBranch);
  res.json({ ok: true, repo: info.fullName, baseBranch });
});

/** Scollega GitHub: cancella il token salvato e lo revoca su GitHub. */
app.post("/api/github/disconnect", async (req: Request, res: Response) => {
  const user = await sessionUser(req);
  if (!user) { res.status(401).json({ error: "Accedi al tuo account SAMS." }); return; }
  const linked = await linkedToken(req);
  await deleteGithubLink(db(), user.id);
  const cfg = githubOAuthConfig();
  if (cfg && linked) {
    revokeToken(cfg, linked.token).catch((err: unknown) => log.warn("Revoca token GitHub non riuscita", { err: String(err) }));
  }
  res.json({ ok: true });
});

app.get("/api/health", async (_req: Request, res: Response) => {
  res.json({ ok: true, ...publicStatus() });
});

/** Sanitized snapshot for the Settings UI (never returns the secret values). */
app.get("/api/status", async (req: Request, res: Response) => {
  res.json(await ownerStatus(req));
});

/**
 * Lo stato pubblico più, **solo per l'owner**, i campi bloccati dall'ambiente
 * (`envManaged`, solo nomi). Gli altri non lo ricevono: anche i nomi dicono cosa è
 * configurato o cosa manca (es. il secret dei webhook).
 */
async function ownerStatus(req: Request) {
  const st = publicStatus();
  return (await roleOf(req)) === "owner"
    ? { ...st, envManaged: envManagedForUi(), ephemeralDisk: ephemeralDisk() }
    : st;
}

/**
 * Ruolo del chiamante (Roadmap 4, frontiera #2), così la UI può nascondere/
 * disabilitare le azioni che il ruolo non può compiere. `enforced` dice se i
 * ruoli sono attivi (token statici o almeno un account; altrimenti dev aperto, tutti "owner").
 */
app.get("/api/whoami", async (req: Request, res: Response) => {
  const provided = bearerToken(req.headers.authorization);
  const user = provided ? await getSessionUser(db(), provided) : null;
  const enforced = rolesEnforced(roleTokens(), await accountsExist()) || Boolean(user);
  // `name`/`email` valorizzati solo con una sessione utente reale: così la workspace
  // può presentarsi con l'identità dell'account (presence/cursori/chat) invece di "Ospite".
  res.json({ role: await roleOf(req), enforced, name: user?.name ?? "", email: user?.email ?? "" });
});

// --- Auth reale: account utente (Roadmap 4, frontiera #3) ------------------
// Sessione via **bearer token opaco** (Authorization: Bearer …), non cookie — così
// dev (porte diverse) e prod (stessa origine) si comportano identici. Il primo
// utente registrato è owner; gli altri partono viewer. Endpoint pubblici (niente
// requireRole): sono proprio il modo per ottenere un'identità.
const authLimiter = createRateLimiter(12, 5 * 60_000); // 12 tentativi / 5 min per IP
// Hash "civetta": mantiene la verifica a tempo (quasi) costante anche quando l'utente
// non esiste, così un attaccante non distingue "email assente" da "password errata".
const DUMMY_PASS_HASH = hashPassword("__sams_dummy_password__");

app.post("/api/auth/register", async (req: Request, res: Response) => {
  if (!authLimiter.hit(identityKey("", req.ip))) { res.status(429).json({ error: "Troppi tentativi, riprova tra qualche minuto" }); return; }
  const body = (req.body ?? {}) as { email?: unknown; password?: unknown; name?: unknown; invite?: unknown };
  const email = normalizeEmail(body.email);
  if (!isValidEmail(email)) { res.status(400).json({ error: "Email non valida" }); return; }
  const pw = validatePassword(body.password);
  if (!pw.ok) { res.status(400).json({ error: pw.error }); return; }
  // In coda alle altre operazioni sugli account: due prime registrazioni in corsa non
  // devono diventare owner entrambe, né scontrarsi sul vincolo UNIQUE dell'email.
  await accountsLock.run(() => registerAccount(res, body, email));
});

async function registerAccount(
  res: Response,
  body: { password?: unknown; name?: unknown; invite?: unknown },
  email: string,
): Promise<void> {

  const database = db();
  if (await getUserByEmail(database, email)) { res.status(409).json({ error: "Esiste già un account con questa email" }); return; }
  const first = (await countUsers(database)) === 0;
  // Registrazione da invito (D3-B): il ruolo è quello scelto dall'owner e l'indirizzo è
  // già dimostrato (il link è arrivato lì, o l'owner l'ha consegnato di persona).
  const inviteToken = typeof body.invite === "string" ? body.invite : "";
  let invitedRole: InvitableRole | null = null;
  if (inviteToken) {
    const rec = await getInviteByHash(database, hashToken(inviteToken));
    const why = inviteRejection(rec, email);
    if (why) {
      const error = why === "expired" ? "L'invito è scaduto: chiedine uno nuovo a chi ti ha invitato"
        : why === "used" ? "L'invito è già stato usato"
        : why === "email_mismatch" ? "L'invito vale solo per l'indirizzo a cui è stato mandato"
        : "Invito non valido";
      res.status(400).json({ error, reason: why });
      return;
    }
    // Spendilo prima di creare l'account: due registrazioni in corsa non passano entrambe.
    if (!await consumeInvite(database, rec!.tokenHash)) {
      res.status(400).json({ error: "L'invito è già stato usato", reason: "used" });
      return;
    }
    invitedRole = rec!.role;
  }
  const role: Role = registrationRole(first, invitedRole);
  const user: User = {
    id: randomUUID(),
    email,
    name: sanitizeName(body.name, email),
    passHash: hashPassword(body.password as string),
    role,
    createdAt: Date.now(),
    // Il primo utente è chi ospita SAMS: non ha nessuno che possa verificarlo, e mandarlo
    // a caccia di un link per entrare in casa propria sarebbe assurdo. Nasce verificato.
    emailVerified: first || invitedRole !== null || !VERIFICATION_ENFORCED,
  };
  await createUser(database, user);
  log.info("Nuovo account registrato", { email, role, verificato: user.emailVerified });

  // Con un canale email reale l'account nasce **non verificato**: niente sessione, prima
  // conferma l'indirizzo. Senza canale, si entra subito come prima (retro-compatibile).
  if (!user.emailVerified) {
    void deliver(user, "verify", await issueLink(user, "verify"));
    res.status(201).json({ user: publicUser(user), verificationRequired: true });
    return;
  }
  const token = newSessionToken();
  await createAuthSession(database, token, user.id, Date.now() + SESSION_TTL_MS);
  res.status(201).json({ token, user: publicUser(user) });
}

app.post("/api/auth/login", async (req: Request, res: Response) => {
  if (!authLimiter.hit(identityKey("", req.ip))) { res.status(429).json({ error: "Troppi tentativi, riprova tra qualche minuto" }); return; }
  const body = (req.body ?? {}) as { email?: unknown; password?: unknown };
  const email = normalizeEmail(body.email);
  const database = db();
  const user = await getUserByEmail(database, email);
  const password = typeof body.password === "string" ? body.password : "";
  // Verifica sempre un hash (quello dell'utente o il civetta) per non trapelare via timing.
  const ok = verifyPassword(password, user ? user.passHash : DUMMY_PASS_HASH);
  if (!user || !ok) { res.status(401).json({ error: "Email o password non corretti" }); return; }
  // Gate della verifica: solo con un canale email configurato (vedi VERIFICATION_ENFORCED).
  // Le credenziali sono già state validate, quindi dire "non verificato" non rivela nulla
  // a chi non conosce la password.
  if (VERIFICATION_ENFORCED && !user.emailVerified) {
    res.status(403).json({ error: "Conferma il tuo indirizzo email per entrare", reason: "email_not_verified" });
    return;
  }
  const token = newSessionToken();
  await createAuthSession(database, token, user.id, Date.now() + SESSION_TTL_MS);
  res.json({ token, user: publicUser(user) });
});

app.post("/api/auth/logout", async (req: Request, res: Response) => {
  const token = bearerToken(req.headers.authorization);
  if (token) await deleteAuthSession(db(), token);
  res.status(204).end();
});

app.get("/api/auth/me", async (req: Request, res: Response) => {
  const user = await getSessionUser(db(), bearerToken(req.headers.authorization));
  if (!user) { res.status(401).json({ error: "Non autenticato" }); return; }
  res.json({ user: publicUser(user) });
});

// Gestione utenti (solo owner): elenca gli account e cambia i ruoli. Serve a rendere
// utilizzabili i ruoli in un team — senza, dopo il primo utente restano tutti viewer.
app.get("/api/auth/users", requireRole("owner"), async (_req: Request, res: Response) => {
  res.json({ users: await listUsers(db()) });
});

/**
 * Chi fa parte del team, per chiunque abbia un account: solo nome e ruolo, mai l'email.
 * In sola lettura: ruoli e inviti restano all'owner (`/api/auth/users`).
 */
app.get("/api/team", requireRole("viewer"), async (_req: Request, res: Response) => {
  const members = (await listUsers(db())).map((u) => ({ name: u.name, role: u.role }));
  res.json({ members });
});

// Diagnostica di `SAMS_TRUST_PROXY` (solo owner): quale IP il server attribuisce a chi
// chiama e cosa è arrivato nell'header. `ip` deve essere il proprio IP pubblico.
app.get("/api/admin/client-ip", requireRole("owner"), async (req: Request, res: Response) => {
  res.json({
    trustProxy: trustProxy.value,
    ip: req.ip ?? null,
    ips: req.ips,
    forwardedFor: req.headers["x-forwarded-for"] ?? null,
    socket: req.socket.remoteAddress ?? null,
  });
});

// Cambio password del proprio account (autenticato): verifica la vecchia, imposta la nuova
// e slogga gli altri dispositivi (le altre sessioni). Nessuna email → solo cambio, non reset.
app.post("/api/auth/password", async (req: Request, res: Response) => {
  const token = bearerToken(req.headers.authorization);
  const user = await getSessionUser(db(), token);
  if (!user) { res.status(401).json({ error: "Non autenticato" }); return; }
  const body = (req.body ?? {}) as { oldPassword?: unknown; newPassword?: unknown };
  if (!verifyPassword(typeof body.oldPassword === "string" ? body.oldPassword : "", user.passHash)) {
    res.status(401).json({ error: "Password attuale non corretta" });
    return;
  }
  const pw = validatePassword(body.newPassword);
  if (!pw.ok) { res.status(400).json({ error: pw.error }); return; }
  const database = db();
  await updateUserPassword(database, user.id, hashPassword(body.newPassword as string));
  await deleteUserSessionsExcept(database, user.id, token);
  log.info("Password cambiata", { email: user.email });
  res.status(204).end();
});

// --- Gestione password: reset + verifica email -----------------------------
// Doc di decisione 2026-07-15. Il canale email è un'astrazione a driver (`mailer.ts`)
// che si configura da sé: SMTP se c'è SMTP_HOST, Resend se c'è RESEND_API_KEY, altrimenti
// `console` (il link nei log + il fallback owner-issued qui sotto). Da questo dipende
// tutto il resto di questa sezione.
const MAILER_CONFIG = resolveMailerConfig();
const mailer = createMailer(MAILER_CONFIG);
/**
 * Il gate sui non verificati si accende **solo** con un canale che recapita davvero.
 * Senza, nessuno potrebbe verificarsi e bloccare chiuderebbe fuori tutti — stessa forma
 * della regola dei ruoli ("nessun token configurato → tutto owner").
 */
const VERIFICATION_ENFORCED = mailerCanDeliver(MAILER_CONFIG);

log.info("Canale email", { driver: MAILER_CONFIG.driver, verificaImposta: VERIFICATION_ENFORCED });

/** Emette un token monouso e ne restituisce il link (senza spedirlo). */
async function issueLink(user: User, kind: "reset" | "verify"): Promise<string> {
  const token = newToken();
  const table = kind === "reset" ? "password_resets" : "email_verifications";
  const ttl = kind === "reset" ? RESET_TTL_MS : VERIFY_TTL_MS;
  const now = Date.now();
  await createToken(db(), table, {
    tokenHash: hashToken(token),
    userId: user.id,
    createdAt: now,
    expiresAt: tokenExpiry(ttl, now),
    usedAt: null,
  });
  await pruneTokens(db(), table, now); // GC opportunistico: le tabelle non crescono all'infinito
  const base = MAILER_CONFIG.baseUrl;
  return kind === "reset" ? resetLink(base, token) : verifyLink(base, token);
}

/**
 * Spedisce (o logga) un link. **Non lancia mai**: un SMTP che non risponde non deve far
 * fallire una registrazione o trasformare un "forgot" in un 500 che rivela quali email
 * esistono. L'errore finisce nei log, dove chi ospita lo può vedere.
 */
async function deliver(user: User, kind: "reset" | "verify", link: string): Promise<void> {
  const msg = kind === "reset" ? renderResetEmail(user.name, link) : renderVerifyEmail(user.name, link);
  try {
    await mailer.send({ ...msg, to: user.email });
  } catch (err) {
    log.error("Invio email fallito", { kind, to: user.email, err: String(err) });
  }
}

/**
 * "Password dimenticata". Risponde **sempre 204**, esista o no l'account: se rispondesse
 * 404 per le email sconosciute, chiunque potrebbe usarlo per scoprire chi ha un account.
 */
app.post("/api/auth/forgot", async (req: Request, res: Response) => {
  if (!authLimiter.hit(identityKey("", req.ip))) { res.status(429).json({ error: "Troppi tentativi, riprova tra qualche minuto" }); return; }
  const email = normalizeEmail((req.body ?? {}).email);
  const user = isValidEmail(email) ? await getUserByEmail(db(), email) : null;
  if (user && VERIFICATION_ENFORCED) {
    const link = await issueLink(user, "reset");
    void deliver(user, "reset", link); // non attendiamo: la risposta non deve dipendere dall'SMTP
    log.info("Reset password richiesto", { email });
  } else if (user) {
    // Senza un canale che recapita, un link emesso qui non arriverebbe a nessuno, e
    // chiunque potrebbe farne emettere uno per qualsiasi account. Niente token: si rientra
    // col link che l'owner genera dal Profilo e consegna a mano.
    log.info("Reset password richiesto senza canale email: nessun link emesso", { email });
  }
  res.status(204).end();
});

/** Reimposta la password spendendo un token monouso. */
app.post("/api/auth/reset", async (req: Request, res: Response) => {
  if (!authLimiter.hit(identityKey("", req.ip))) { res.status(429).json({ error: "Troppi tentativi, riprova tra qualche minuto" }); return; }
  const body = (req.body ?? {}) as { token?: unknown; password?: unknown };
  const token = typeof body.token === "string" ? body.token : "";
  const database = db();
  const rec = await getToken(database, "password_resets", hashToken(token));
  if (!isTokenUsable(rec)) {
    const why = tokenRejection(rec);
    const error = why === "expired" ? "Il link è scaduto: richiedine uno nuovo"
      : why === "used" ? "Il link è già stato usato: richiedine uno nuovo"
      : "Link di reset non valido";
    res.status(400).json({ error, reason: why });
    return;
  }
  const pw = validatePassword(body.password);
  if (!pw.ok) { res.status(400).json({ error: pw.error }); return; }
  const user = await getUserById(database, rec!.userId);
  if (!user) { res.status(400).json({ error: "Link di reset non valido" }); return; }
  // Spendi il token **prima** di cambiare la password: se due richieste corrono con lo
  // stesso link, il DB ne lascia passare una sola (UPDATE … WHERE used_at IS NULL).
  if (!await consumeToken(database, "password_resets", rec!.tokenHash)) {
    res.status(400).json({ error: "Il link è già stato usato: richiedine uno nuovo", reason: "used" });
    return;
  }
  await updateUserPassword(database, user.id, hashPassword(body.password as string));
  // Chi era entrato con la vecchia password esce: un reset è anche un modo di cacciare
  // qualcuno che non dovrebbe più essere dentro.
  await deleteAllUserSessions(database, user.id);
  // Chi dimostra di controllare la casella ha, di fatto, verificato l'indirizzo.
  if (!user.emailVerified) await setEmailVerified(database, user.id, true);
  log.info("Password reimpostata", { email: user.email });
  res.status(204).end();
});

/** Conferma un indirizzo email spendendo il token del link di verifica. */
app.post("/api/auth/verify", async (req: Request, res: Response) => {
  if (!authLimiter.hit(identityKey("", req.ip))) { res.status(429).json({ error: "Troppi tentativi, riprova tra qualche minuto" }); return; }
  const token = typeof (req.body ?? {}).token === "string" ? (req.body as { token: string }).token : "";
  const database = db();
  const rec = await getToken(database, "email_verifications", hashToken(token));
  if (!isTokenUsable(rec)) {
    const why = tokenRejection(rec);
    const error = why === "expired" ? "Il link di verifica è scaduto: chiedine uno nuovo"
      : why === "used" ? "Questo indirizzo è già stato confermato"
      : "Link di verifica non valido";
    res.status(400).json({ error, reason: why });
    return;
  }
  const user = await getUserById(database, rec!.userId);
  if (!user) { res.status(400).json({ error: "Link di verifica non valido" }); return; }
  if (!await consumeToken(database, "email_verifications", rec!.tokenHash)) {
    res.status(400).json({ error: "Questo indirizzo è già stato confermato", reason: "used" });
    return;
  }
  await setEmailVerified(database, user.id, true);
  log.info("Email verificata", { email: user.email });
  res.json({ user: publicUser({ ...user, emailVerified: true }) });
});

/** Rimanda il link di verifica al proprio indirizzo (serve una sessione). */
app.post("/api/auth/verify/resend", async (req: Request, res: Response) => {
  if (!authLimiter.hit(identityKey("", req.ip))) { res.status(429).json({ error: "Troppi tentativi, riprova tra qualche minuto" }); return; }
  const user = await getSessionUser(db(), bearerToken(req.headers.authorization));
  if (!user) { res.status(401).json({ error: "Non autenticato" }); return; }
  if (user.emailVerified) { res.status(409).json({ error: "Indirizzo già confermato" }); return; }
  void deliver(user, "verify", await issueLink(user, "verify"));
  res.status(204).end();
});

/**
 * Fallback owner-issued: l'owner genera un link di reset e lo consegna a mano. È la via
 * di rientro quando SAMS gira **senza canale email** (driver `console`) — senza, un utente
 * chiuso fuori richiederebbe un intervento a mano sul DB. Owner-only, ovviamente: emette
 * un link che cambia la password di un altro account.
 */
app.post("/api/auth/users/reset", requireRole("owner"), async (req: Request, res: Response) => {
  const email = normalizeEmail((req.body ?? {}).email);
  const user = await getUserByEmail(db(), email);
  if (!user) { res.status(404).json({ error: "Utente non trovato" }); return; }
  const link = await issueLink(user, "reset");
  log.info("Link di reset emesso dall'owner", { email, by: actorLabel(await roleOf(req), (req.body ?? {}).actor) });
  res.json({ link, expiresInMin: Math.round(RESET_TTL_MS / 60_000) });
});

app.post("/api/auth/users/role", requireRole("owner"), async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as { email?: unknown; role?: unknown };
  const email = normalizeEmail(body.email);
  const role = body.role;
  if (role !== "owner" && role !== "editor" && role !== "viewer") { res.status(400).json({ error: "Ruolo non valido" }); return; }
  // In coda alle altre operazioni sugli account: due declassamenti in corsa non devono
  // vedere entrambi "ci sono 2 owner" e lasciare il workspace senza nessuno.
  await accountsLock.run(async () => {
    const database = db();
    const target = await getUserByEmail(database, email);
    if (!target) { res.status(404).json({ error: "Utente non trovato" }); return; }
    // Non lasciare mai il workspace senza owner: l'ultimo owner non può declassarsi.
    if (target.role === "owner" && role !== "owner" && (await countOwners(database)) <= 1) {
      res.status(409).json({ error: "Non puoi declassare l'ultimo owner" });
      return;
    }
    await setUserRole(database, email, role);
    log.info("Ruolo utente aggiornato", { email, role });
    res.json({ user: { email: target.email, name: target.name, role } });
  });
});

// --- Inviti (D3-B) ------------------------------------------------------------

/**
 * L'owner invita un indirizzo con un ruolo (editor o viewer, mai owner). Con un canale
 * email reale l'invito parte da solo; il link torna comunque all'owner, che senza canale
 * lo consegna a mano (come il reset). Un nuovo invito alla stessa email sostituisce il
 * precedente non usato.
 */
app.post("/api/auth/invites", requireRole("owner"), async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as { email?: unknown; role?: unknown };
  const email = normalizeEmail(body.email);
  if (!isValidEmail(email)) { res.status(400).json({ error: "Email non valida" }); return; }
  if (!isInvitableRole(body.role)) { res.status(400).json({ error: "Si può invitare solo come editor o osservatore" }); return; }
  const database = db();
  if (await getUserByEmail(database, email)) { res.status(409).json({ error: "Esiste già un account con questa email" }); return; }
  const inviter = await getSessionUser(database, bearerToken(req.headers.authorization));
  const token = newToken();
  const now = Date.now();
  const id = randomUUID();
  await createInvite(database, {
    id,
    tokenHash: hashToken(token),
    email,
    role: body.role,
    invitedBy: inviter?.id ?? "",
    createdAt: now,
    expiresAt: tokenExpiry(INVITE_TTL_MS, now),
    usedAt: null,
  });
  await pruneInvites(database, now);
  const link = inviteLink(MAILER_CONFIG.baseUrl, token);
  // Senza canale reale non si "spedisce" nei log: il link lo consegna l'owner.
  const emailed = mailerCanDeliver(MAILER_CONFIG);
  if (emailed) {
    const msg = renderInviteEmail(inviter?.name ?? "", body.role, link);
    void mailer.send({ ...msg, to: email }).catch((err: unknown) => {
      log.error("Invio email fallito", { kind: "invite", to: email, err: String(err) });
    });
  }
  log.info("Invito creato", { email, role: body.role, emailed });
  res.status(201).json({
    invite: { id, email, role: body.role, createdAt: now, expiresAt: now + INVITE_TTL_MS },
    link,
    emailed,
  });
});

app.get("/api/auth/invites", requireRole("owner"), async (_req: Request, res: Response) => {
  res.json({ invites: await listPendingInvites(db()) });
});

app.delete("/api/auth/invites/:id", requireRole("owner"), async (req: Request, res: Response) => {
  if (!await revokeInvite(db(), String(req.params.id))) { res.status(404).json({ error: "Invito non trovato" }); return; }
  log.info("Invito revocato", { id: req.params.id });
  res.status(204).end();
});

/**
 * La pagina /invito legge per chi è l'invito (email e ruolo) prima di mostrare il form.
 * POST e non GET: il token viaggia nel corpo, non in un URL che finisce nei log.
 */
app.post("/api/auth/invites/lookup", async (req: Request, res: Response) => {
  if (!authLimiter.hit(identityKey("", req.ip))) { res.status(429).json({ error: "Troppi tentativi, riprova tra qualche minuto" }); return; }
  const token = typeof (req.body ?? {}).token === "string" ? (req.body as { token: string }).token : "";
  const rec = token ? await getInviteByHash(db(), hashToken(token)) : null;
  const why = rec ? inviteRejection(rec, rec.email) : "unknown";
  if (why) {
    const error = why === "expired" ? "L'invito è scaduto: chiedine uno nuovo a chi ti ha invitato"
      : why === "used" ? "L'invito è già stato usato"
      : "Invito non valido";
    res.status(400).json({ error, reason: why });
    return;
  }
  res.json({ email: rec!.email, role: rec!.role, expiresAt: rec!.expiresAt });
});

/** Runtime metrics: since-boot counters + cumulative (durable) task stats. */
app.get("/api/metrics", requireRole("viewer"), async (_req: Request, res: Response) => {
  let lifetime = { total: 0, completed: 0, tokens: 0 };
  try {
    lifetime = await taskStats(db());
  } catch {
    /* DB unavailable — report since-boot metrics only */
  }
  res.json({ ...metricsSnapshot({ clients: clients.size }), lifetime });
});

/** Recent finished tasks from the durable log (newest first). */
app.get("/api/history", requireRole("viewer"), async (_req: Request, res: Response) => {
  res.json(await recentTasks(db(), 20));
});

/**
 * Read-only public snapshot of the world (runtime + metrics + garden), for a
 * shareable dashboard. No mutating actions. Guarded by SAMS_READONLY_TOKEN when
 * set (?token=…); open otherwise.
 */
app.get("/api/public", async (req: Request, res: Response) => {
  const provided = typeof req.query.token === "string" ? req.query.token : undefined;
  if (!readonlyAuthorized(getSettings().readonlyToken, provided)) {
    res.status(401).json({ error: "Token di sola lettura mancante o non valido" });
    return;
  }
  let lifetime = { total: 0, completed: 0, tokens: 0 };
  try {
    lifetime = await taskStats(db());
  } catch {
    /* DB unavailable — since-boot metrics only */
  }
  let board: Awaited<ReturnType<ReturnType<typeof getStore>["top"]>> = [];
  try {
    board = await getStore().top(10);
  } catch {
    /* garden store unavailable — omit leaderboard */
  }
  let world = { agents: 0, working: 0, idle: 0 };
  try {
    world = summarizeWorld(await loadWorldSnapshot(db()));
  } catch {
    /* world snapshot unavailable — omit */
  }
  res.json(
    buildPublicSnapshot({
      status: publicStatus(),
      metrics: { ...metricsSnapshot({ clients: clients.size }), lifetime },
      board,
      world,
      viewers: clients.size,
    }),
  );
});

/**
 * Current content of a repo file (the "before" side of a staged diff). Gated "viewer":
 * it reads the repo with the server's GitHub token, so with roles enforced an anonymous
 * caller must not be able to read a private repo through it.
 */
app.get("/api/file", requireRole("viewer"), async (req: Request, res: Response) => {
  const filePath = String(req.query.path ?? "");
  if (!filePath) {
    res.status(400).json({ error: "path richiesto" });
    return;
  }
  // Il "prima" del diff di un task in attesa si legge dalla repo di quel task, col token di
  // chi l'ha assegnato, così chi approva vede il diff giusto. Solo per i file che l'agente
  // sta per cambiare e solo sul branch base del task: chi vede la workspace riceve già il
  // loro contenuto nuovo, ma non deve poter leggere nient'altro di quella repo.
  const agentId = typeof req.query.agentId === "string" ? req.query.agentId : "";
  const pending = agentId ? getPending(agentId) : undefined;
  const staged = pending?.github && pending.files.some((f) => f.path === filePath) ? pending.github : undefined;
  let ctx: Partial<GithubContext> = {};
  let ref = typeof req.query.ref === "string" ? req.query.ref : "";
  if (staged) {
    ctx = staged;
    ref = staged.baseBranch;
  } else {
    const ug = await userGithub(req);
    if (ug.kind === "missing") { res.json({ content: "", exists: false }); return; }
    if (ug.kind === "user") ctx = ug.ctx;
  }
  try {
    const content = await runWithGithub(ctx, () => readFile(filePath, ref || githubContext().baseBranch));
    res.json({ content, exists: true });
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) {
      res.json({ content: "", exists: false }); // new file → no "before"
      return;
    }
    res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

/** L'albero dei file del repo di lavoro, per la sidebar "Esplora risorse". Senza
 *  token GitHub risponde `connected:false` (la UI mostra un invito a collegarlo). */
app.get("/api/repo/tree", requireRole("viewer"), async (req: Request, res: Response) => {
  const ug = await userGithub(req);
  if (ug.kind === "missing") {
    res.json({ repo: "", branch: "", entries: [], truncated: false, connected: false, needsGithub: ug.error });
    return;
  }
  const ctx: Partial<GithubContext> = ug.kind === "user" ? ug.ctx : {};
  const g = runWithGithub(ctx, githubContext);
  if (!g.token) {
    res.json({ repo: g.repo, branch: g.baseBranch, entries: [], truncated: false, connected: false });
    return;
  }
  try {
    const { entries, truncated, branch } = await runWithGithub(ctx, () => getRepoTree(g.baseBranch));
    res.json({ repo: g.repo, branch, entries, truncated, connected: true });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : String(err), entries: [], connected: false });
  }
});

/** Save settings entered in the app (keys, repo, model…). */
app.post("/api/settings", requireRole("owner"), async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as SettingsPatch;
  const patch: SettingsPatch = {};
  if (body.provider === "gemini" || body.provider === "claude" || body.provider === "groq" || body.provider === "openrouter" || body.provider === "openai") patch.provider = body.provider;
  if (typeof body.groqApiKey === "string" && body.groqApiKey.trim()) patch.groqApiKey = body.groqApiKey.trim();
  if (typeof body.openrouterApiKey === "string" && body.openrouterApiKey.trim()) patch.openrouterApiKey = body.openrouterApiKey.trim();
  if (typeof body.openaiApiKey === "string" && body.openaiApiKey.trim()) patch.openaiApiKey = body.openaiApiKey.trim();
  if (typeof body.geminiApiKey === "string" && body.geminiApiKey.trim()) patch.geminiApiKey = body.geminiApiKey.trim();
  if (typeof body.anthropicApiKey === "string" && body.anthropicApiKey.trim()) patch.anthropicApiKey = body.anthropicApiKey.trim();
  if (typeof body.githubToken === "string" && body.githubToken.trim()) patch.githubToken = body.githubToken.trim();
  if (typeof body.githubRepo === "string" && body.githubRepo.trim()) patch.githubRepo = body.githubRepo.trim();
  if (typeof body.baseBranch === "string" && body.baseBranch.trim()) patch.baseBranch = body.baseBranch.trim();
  if (typeof body.model === "string" && body.model.trim()) patch.model = body.model.trim();
  if (typeof body.openPRs === "boolean") patch.openPRs = body.openPRs;
  if (typeof body.requireApproval === "boolean") patch.requireApproval = body.requireApproval;
  if (typeof body.notionToken === "string" && body.notionToken.trim()) patch.notionToken = body.notionToken.trim();
  if (typeof body.notionPageId === "string") patch.notionPageId = body.notionPageId.trim();
  // I campi impostati da variabili d'ambiente non si cambiano dalla UI: l'ambiente
  // vince al riavvio, quindi il cambio non durerebbe (e un token "ruotato" qui
  // tornerebbe valido in silenzio). Si risponde 409 e non si salva niente.
  const locked = envLockedChanges(patch, getSettings(), envManagedKeys());
  if (locked.length > 0) {
    log.warn("Impostazioni gestite dall'ambiente: cambio rifiutato", { fields: locked });
    res.status(409).json({
      error: `Questi campi sono impostati da variabili d'ambiente sul server e non si cambiano da qui: ${locked.join(", ")}. Cambiali sul server e riavvia.`,
      envManaged: locked,
    });
    return;
  }
  // Disco effimero (SAMS_EPHEMERAL_DISK): una chiave salvata qui sparirebbe al primo
  // riavvio, in silenzio. Meglio dirlo subito: i segreti si impostano sul server.
  const secrets = ephemeralDisk() ? secretChanges(patch, getSettings()) : [];
  if (secrets.length > 0) {
    const vars = secrets.map(secretEnvName);
    res.status(409).json({
      error: `Su questo server le chiavi non si salvano da qui (non c'è un disco che sopravvive ai riavvii): imposta ${vars.join(", ")} come ${vars.length === 1 ? "variabile" : "variabili"} d'ambiente sul server e riavvia.`,
      envRequired: vars,
    });
    return;
  }
  try {
    await updateSettings(patch);
  } catch (err) {
    log.error("Salvataggio impostazioni fallito", { err: String(err) });
    res.status(500).json({ error: "Impostazioni non salvate: il database non risponde. Riprova." });
    return;
  }
  res.json(await ownerStatus(req));
});

/** Create (or re-create) the managed Agent + Environment (Claude provider only). */
app.post("/api/provision", requireRole("owner"), async (req: Request, res: Response) => {
  if (getSettings().provider !== "claude") {
    res.json({ ...(await ownerStatus(req)), note: "Gemini non richiede provisioning" });
    return;
  }
  // Stessa regola delle impostazioni: se gli id vengono dall'ambiente, quelli nuovi
  // verrebbero scartati al riavvio (e si creerebbero risorse a pagamento per niente).
  const lockedIds = envManagedKeys().filter((k) => k === "agentId" || k === "environmentId");
  if (lockedIds.length > 0) {
    res.status(409).json({
      error: `Agente e ambiente sono impostati da variabili d'ambiente sul server (${lockedIds.join(", ")}): per rifarli cambiali lì.`,
      envManaged: lockedIds,
    });
    return;
  }
  try {
    const ids = await provision();
    res.json({ ...(await ownerStatus(req)), ...ids });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * Biglietto monouso per aprire lo stream eventi (D4-C). Un EventSource non manda
 * header, quindi il client autenticato chiede qui un biglietto e lo passa come `?t=`.
 */
const streamTickets = new StreamTickets();
/** Il client ne chiede uno a ogni (ri)connessione: 30 al minuto per identità bastano e avanzano. */
const ticketLimiter = createRateLimiter(30, 60_000);
app.post("/api/events/ticket", requireRole("viewer"), async (req: Request, res: Response) => {
  const provided = bearerToken(req.headers.authorization);
  if (!ticketLimiter.hit(identityKey(provided, req.ip))) {
    res.status(429).json({ error: "Troppe richieste, riprova tra poco" });
    return;
  }
  // Il biglietto ricorda chi l'ha chiesto: lo stream la ricontrolla finché resta aperto.
  // Tetto per account (tutte le sue sessioni insieme): vedi streamTickets.ts.
  const user = provided ? await getSessionUser(db(), provided) : null;
  const ticket = streamTickets.issue(provided, { user: user?.id });
  if (!ticket) {
    res.status(503).json({ error: "Troppi stream in apertura, riprova tra poco" });
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  res.json({ ticket });
});

/**
 * Lo stream può restare aperto? In dev aperto sempre. Con i ruoli attivi serve che la
 * credenziale del biglietto valga **ancora**: una sessione chiusa col logout, scaduta o
 * revocata, o un token statico cambiato, chiudono lo stream al primo heartbeat.
 * `credential === null` = stream aperto senza biglietto (in dev) e poi i ruoli si sono
 * attivati, per esempio alla prima registrazione: anche quello va chiuso.
 */
async function streamStillAllowed(credential: string | null): Promise<boolean> {
  const tokens = roleTokens();
  const exist = await accountsExist();
  if (!rolesEnforced(tokens, exist)) return true;
  if (credential === null) return false;
  const hasSession = credential ? (await getSessionUser(db(), credential)) !== null : false;
  return !isAnonymousWhenEnforced(tokens, credential, hasSession, exist);
}

app.get("/api/events", async (req: Request, res: Response) => {
  // Con i ruoli attivi lo stream vuole un biglietto valido (D4-C); in dev aperto no.
  // Il biglietto si consuma comunque, se c'è: non deve restare valido in un log.
  const credential = streamTickets.consume(req.query.t);
  if (!(await streamStillAllowed(credential))) {
    log.warn("Stream eventi senza biglietto valido respinto", { ip: req.ip });
    res.status(401).json({ error: "Biglietto dello stream mancante o scaduto" });
    return;
  }
  // Tutte le letture dal DB prima di registrare la vista: da `clients.set` in poi il
  // codice resta sincrono fino all'aggancio di `cleanup`, così una vista chiusa nel
  // frattempo non resta orfana nelle mappe.
  const viewKey = await viewIdentity(credential ?? "");
  if (res.writableEnded || res.destroyed || req.destroyed) return;
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });
  res.write(": connected\n\n");
  // Identità dichiarata dalla vista al connect (canale bidirezionale, primo pezzo
  // concreto della frontiera #1): `v` = id stabile persistito, `n` = nome.
  const observer = sanitizeObserverIdentity(req.query.v, req.query.n);
  clients.set(res, observer);
  clientKeys.set(res, viewKey);
  log.info("Vista connessa", { views: clients.size, name: observer.name });
  broadcastPresence(); // tell everyone (incl. the new view) the updated count

  // Single cleanup path: a dead socket does NOT make res.write throw in Node, so
  // we must not rely on a throw — react to close/error and guard every write.
  let closed = false;
  function cleanup() {
    if (closed) return; // close + error can both fire — count the drop once
    closed = true;
    clearInterval(heartbeat);
    clients.delete(res);
    clientKeys.delete(res);
    log.info("Vista disconnessa", { views: clients.size, name: observer.name });
    broadcastPresence();
    // Se il driver se ne va, rilascia subito il lease (handover immediato, senza
    // aspettare la scadenza) e avvisa le altre viste.
    if (driverLease && driverLease.holderId === observer.id && (driverLease.holderKey ?? "") === viewKey) {
      driverLease = releaseDriver(driverLease, observer.id, viewKey);
      broadcastDriver();
    }
  }
  // Logout, sessione revocata o ruoli appena attivati chiudono lo stream: il client riprova,
  // riceve 401 sul biglietto e mostra "Accesso richiesto". Il ping (evento con nome) evita che
  // un proxy tenga la UI "connessa" a uno stream muto. `heartbeatTick` non lancia mai: siamo
  // in un setInterval, dove un'eccezione (es. SQLITE_BUSY) farebbe cadere il runtime.
  const heartbeat = setInterval(() => {
    void heartbeatTick({
      isGone: () => res.writableEnded || res.destroyed,
      stillAllowed: async () => {
        const ok = await streamStillAllowed(credential);
        if (!ok) log.info("Stream chiuso: credenziale non più valida", { name: observer.name });
        return ok;
      },
      write: (chunk) => res.write(chunk),
      end: () => res.end(),
      cleanup,
      onCheckError: (err) => log.warn("Stream chiuso: controllo della credenziale fallito", { name: observer.name, err: String(err) }),
    });
  }, HEARTBEAT_MS);
  res.on("error", cleanup);
  req.on("close", cleanup);
});

// Per-agent cooldown: prevent hammering an agent with rapid task submissions.
const ASSIGN_COOLDOWN_MS = 20_000; // 20 s between task starts per agent
const lastAssign = new Map<string, number>();

// Quota per-utente (Roadmap 4): con un workspace condiviso il cooldown per-agente
// non basta — un utente potrebbe saturare il runtime spargendo task su molti
// agenti. Questo limite è per *utente* (token, o IP in mancanza), non per agente.
const assignQuota = createRateLimiter(15, 60_000); // max 15 assegnazioni / minuto

app.post("/api/assign", requireRole("editor"), async (req: Request, res: Response) => {
  const body = req.body as AssignBody;
  if (!body?.agentId || !body?.title) {
    res.status(400).json({ error: "agentId and title are required" });
    return;
  }
  if (!isReady()) {
    res.status(503).json({ error: "Runtime non pronto — apri le Impostazioni, salva le chiavi e premi 'Provisiona agenti'." });
    return;
  }

  // Con "Accedi con GitHub" attivo il task lavora sul GitHub di chi lo assegna: se non
  // l'ha ancora collegato (o non ha scelto la repo) glielo si dice subito.
  const ug = await userGithub(req);
  if (ug.kind === "missing") {
    res.status(409).json({ error: ug.error, needsGithub: true });
    return;
  }

  const now = Date.now();
  const prev = lastAssign.get(body.agentId) ?? 0;
  const wait = Math.ceil((ASSIGN_COOLDOWN_MS - (now - prev)) / 1000);
  if (wait > 0) {
    res.status(429).json({ error: `Agente occupato — riprova tra ${wait}s`, retryAfterSec: wait });
    return;
  }

  // Quota per-utente: verificata *dopo* il cooldown per-agente (così un utente non
  // "spende" la quota se comunque l'agente è occupato) e prima di avviare il lavoro.
  const userKey = identityKey(bearerToken(req.headers.authorization), req.ip);
  if (!assignQuota.hit(userKey, now)) {
    const qWait = Math.ceil(assignQuota.retryAfterMs(userKey, now) / 1000);
    res.status(429).json({ error: `Troppe assegnazioni — riprova tra ${qWait}s`, retryAfterSec: qWait });
    return;
  }
  lastAssign.set(body.agentId, now);

  res.json({ ok: true });

  // Attribuzione: chi ha avviato il lavoro (nome della vista + ruolo).
  log.info("Task assegnato", { by: actorLabel(await roleOf(req), body.actor), agent: body.agentName || body.agentId, title: body.title });

  const { provider } = getSettings();
  const runner =
    provider === "gemini" ? runGeminiTask
    : provider === "groq" ? runGroqTask
    : provider === "openrouter" ? runOpenrouterTask
    : provider === "openai" ? runOpenaiTask
    : runTask;
  // A meta-agente task carries a repo override (owner/repo). Run the whole task
  // inside that repo context so every GitHub call targets it instead of the
  // global repository. Invalid overrides are ignored (fall back to global).
  const repo = typeof body.repo === "string" && /^[\w.-]+\/[\w.-]+$/.test(body.repo) ? body.repo : null;
  const start = () => runner(body, broadcast);
  const inRepo = () => (repo ? runWithRepo(repo, start) : start());
  const work = ug.kind === "user" ? runWithGithub(ug.ctx, inRepo) : inRepo();
  work.catch((err: unknown) => {
    lastAssign.delete(body.agentId); // release on error so the user can retry
    broadcast({
      agentId: body.agentId,
      agentName: body.agentName || body.agentId,
      status: "blocked",
      level: "ERROR",
      message: `Errore: ${err instanceof Error ? err.message : String(err)}`,
    });
  });
});

/** Agent memory — read all memories for an agent (may hold repo context → "viewer"). */
app.get("/api/memory/:agentId", requireRole("viewer"), async (req: Request, res: Response) => {
  const agentId = req.params.agentId as string;
  res.json(await listMemory(db(), agentId));
});

/** Agent memory — clear all memories for an agent. */
app.delete("/api/memory/:agentId", requireRole("editor"), async (req: Request, res: Response) => {
  const agentId = req.params.agentId as string;
  await clearMemory(db(), agentId);
  res.json({ ok: true });
});

/** Approve staged files: create branch, commit each file, optionally open a PR. */
app.post("/api/approve/:agentId", requireRole("editor"), async (req: Request, res: Response) => {
  const agentId = req.params.agentId as string;
  const work = getPending(agentId);
  if (!work) {
    res.status(404).json({ error: "Nessun file in attesa per questo agente" });
    return;
  }
  clearPending(agentId);
  res.json({ ok: true }); // respond immediately; commit happens in background

  const actor = (req.body as { actor?: string } | undefined)?.actor;
  log.info("Modifiche approvate", { by: actorLabel(await roleOf(req), actor), agent: work.agentName, title: work.title });

  const s = getSettings();
  const agentName = work.agentName;
  // Si committa sulla repo del task, con il token di chi l'ha assegnato (salvati quando
  // i file sono stati messi in attesa), non sulla repo del server.
  await runWithGithub(work.github ?? {}, async () => {
    const baseBranch = githubContext().baseBranch;
    try {
      await createBranch(work.branch, baseBranch);
      broadcast({ agentId, agentName, level: "INFO", message: `Branch ${work.branch} creato` });
      // Atomic commit: all staged files in a single tree+commit (no partial-commit risk)
      const commitMsg = work.files.length === 1
        ? work.files[0].message
        : `SAMS(${agentName}): ${work.title} — ${work.files.length} file`;
      await writeFilesAtomic(work.files.map((f) => ({ path: f.path, content: f.content })), work.branch, commitMsg);
      broadcast({ agentId, agentName, level: "SUCCESS", message: `${work.files.length} file committati su ${work.branch}` });
      if (s.openPRs) {
        const pr = await createPullRequest({
          branch: work.branch,
          title: work.title,
          body: `Automated by SAMS agent **${agentName}**.\n\n**Task:** ${work.title}\n\n_Branch \`${work.branch}\` → \`${baseBranch}\`._`,
        });
        broadcast({ agentId, agentName, level: "SUCCESS", message: `PR #${pr.number}: ${pr.html_url}` });
      }
      broadcast({ agentId, agentName, status: "review", progress: 100, level: "SUCCESS", message: "Lavoro completato" });
    } catch (err) {
      broadcast({ agentId, agentName, status: "blocked", level: "ERROR", message: `Commit fallito: ${(err as Error).message}` });
    }
  });
});

/** Reject staged files: discard buffer, agent returns to idle. */
app.post("/api/reject/:agentId", requireRole("editor"), async (req: Request, res: Response) => {
  const agentId = req.params.agentId as string;
  const actor = (req.body as { actor?: string } | undefined)?.actor;
  log.info("Modifiche rifiutate", { by: actorLabel(await roleOf(req), actor), agent: agentId });
  clearPending(agentId);
  broadcast({ agentId, agentName: "runtime", status: "idle", level: "WARN", message: "Diff rifiutato — nessuna modifica applicata" });
  res.json({ ok: true });
});

// --- Live Simulation mode ------------------------------------------------

app.get("/api/sim/status", requireRole("viewer"), async (_req: Request, res: Response) => {
  res.json(simStatus());
});

app.post("/api/sim/start", requireRole("editor"), async (req: Request, res: Response) => {
  const label =
    typeof req.body?.label === "string" && req.body.label.trim()
      ? req.body.label.trim()
      : "sams";
  startSim(label);
  broadcast({ agentId: "sim", agentName: "sim", level: "INFO", message: `🟢 Live Sim avviata · label: ${label}` });
  res.json(simStatus());
});

app.post("/api/sim/stop", requireRole("editor"), async (_req: Request, res: Response) => {
  stopSim();
  broadcast({ agentId: "sim", agentName: "sim", level: "WARN", message: "🔴 Live Sim fermata" });
  res.json(simStatus());
});

app.get("/api/sim/issues", requireRole("viewer"), async (_req: Request, res: Response) => {
  if (!isReady()) {
    res.status(503).json({ error: "Runtime non pronto" });
    return;
  }
  try {
    const issues = await listIssues(getSimLabel());
    const claims = getClaims();
    res.json(issues.map((i) => ({ ...i, claimedBy: claims.get(i.number)?.agentId })));
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Claim/release touch GitHub labels and precede an assignment (which needs "editor"):
// same gate, so a viewer can't claim an issue it could never work on.
app.post("/api/sim/claim/:issueNumber", requireRole("editor"), async (req: Request, res: Response) => {
  const issueNumber = Number(req.params.issueNumber);
  if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
    res.status(400).json({ error: "issueNumber non valido" });
    return;
  }
  const agentId = typeof req.body?.agentId === "string" ? req.body.agentId.trim() : "";
  if (!agentId) {
    res.status(400).json({ error: "agentId richiesto" });
    return;
  }
  if (!simEnabled()) {
    res.status(409).json({ error: "Sim non attiva" });
    return;
  }
  if (!claimIssue(issueNumber, agentId)) {
    res.status(409).json({ error: "Issue già reclamata" });
    return;
  }
  // Best-effort: add in-progress label in background (never blocks the response)
  void addIssueLabel(issueNumber, "sams:in-progress").catch(() => {});
  res.json({ ok: true, issueNumber, agentId });
});

app.post("/api/sim/release/:issueNumber", requireRole("editor"), async (req: Request, res: Response) => {
  const issueNumber = Number(req.params.issueNumber);
  if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
    res.status(400).json({ error: "issueNumber non valido" });
    return;
  }
  // Optional agentId makes the release owner-aware (won't steal another agent's claim).
  const agentId = typeof req.body?.agentId === "string" ? req.body.agentId.trim() : undefined;
  releaseIssue(issueNumber, agentId || undefined);
  void removeIssueLabel(issueNumber, "sams:in-progress").catch(() => {});
  res.json({ ok: true });
});

// Release whatever issue an agent currently holds — robust to the client having
// lost track of the issue number (e.g. the issue was closed on GitHub and dropped
// out of the polled list). This is the primary completion-driven release path.
app.post("/api/sim/release-by-agent/:agentId", requireRole("editor"), async (req: Request, res: Response) => {
  const agentId = (req.params.agentId as string)?.trim();
  if (!agentId) {
    res.status(400).json({ error: "agentId richiesto" });
    return;
  }
  const issueNumber = releaseByAgent(agentId);
  if (issueNumber !== undefined) {
    void removeIssueLabel(issueNumber, "sams:in-progress").catch(() => {});
  }
  res.json({ ok: true, issueNumber });
});

// --- Stato autorevole del mondo (Roadmap 4, primo slice) -----------------
// A durable, server-side copy of the world (agents + tasks). The client pushes
// a snapshot periodically (POST) and anyone can read it (GET) — the first step
// toward an authoritative server state, without yet reconciling back to the
// client. Survives runtime restarts.

app.get("/api/world", requireRole("viewer"), async (_req: Request, res: Response) => {
  try {
    res.json(await loadWorldSnapshot(db()));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post("/api/world", requireRole("editor"), async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as { agents?: unknown; baseVersion?: unknown };
  const agents = sanitizeWorldAgents(body.agents);
  const baseVersion = typeof body.baseVersion === "number" ? body.baseVersion : undefined;
  try {
    await worldLock.run(() => saveWorldCas(res, agents, baseVersion));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

async function saveWorldCas(res: Response, agents: ReturnType<typeof sanitizeWorldAgents>, baseVersion: number | undefined): Promise<void> {
  // Concorrenza ottimistica (compare-and-swap): con più scrittori, rifiuta una
  // scrittura la cui `baseVersion` non è più quella corrente e restituisce lo
  // snapshot autorevole, così il client concilia (adotta la versione remota) e
  // ripresenta. Load→check→save è atomico perché gira sotto `worldLock`: due POST
  // non possono leggere la stessa versione e salvare entrambe.
  const current = await loadWorldSnapshot(db());
  if (!isFreshWrite(current.version, baseVersion)) {
    res.status(409).json({
      ok: false,
      conflict: true,
      version: current.version,
      updatedAt: current.updatedAt,
      agents: current.agents,
    });
    return;
  }
  // Merge per-riga (non sostituzione del blob): create/update + tombstone per
  // gli agenti spariti da questo push CAS-fresco. Lo snapshot restituito porta i
  // tombstone, così le altre viste rimuovono in sicurezza gli agenti cancellati.
  const snapshot = await saveWorldAgents(db(), agents);
  // Propaga live lo snapshot autorevole a tutte le viste (presence realtime) —
  // **solo se qualcosa è cambiato**: un push no-op (vista che ha appena adottato e
  // rispinge il roster identico) non genera echo → niente ping-pong tra le viste.
  if (snapshot.changed) {
    broadcastWorld({ agents: snapshot.agents, version: snapshot.version, updatedAt: snapshot.updatedAt });
  }
  res.json({ ok: true, version: snapshot.version, updatedAt: snapshot.updatedAt, ...summarizeWorld(snapshot) });
}

// --- Chat di workspace (Roadmap 4, frontiera #2) -------------------------
// A human-to-human channel next to the scene, separate from the runtime event
// log. Messages live in SQLite and are broadcast over SSE to every connected
// view, so people watching the same office can talk live.

app.get("/api/chat", requireRole("viewer"), async (_req: Request, res: Response) => {
  try {
    res.json(await listChatMessages(db()));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Per-IP flood guard for the shared chat: at most 10 messages every 30s.
const chatLimiter = createRateLimiter(10, 30_000);

app.post("/api/chat", requireRole("editor"), async (req: Request, res: Response) => {
  const input = sanitizeChatInput(req.body);
  if (!input) {
    res.status(400).json({ error: "Messaggio vuoto" });
    return;
  }
  const key = req.ip ?? "?";
  if (!chatLimiter.hit(key)) {
    const wait = Math.ceil(chatLimiter.retryAfterMs(key) / 1000);
    res.status(429).json({ error: `Troppi messaggi — riprova tra ${wait}s`, retryAfterSec: wait });
    return;
  }
  const msg: ChatMessage = { id: randomUUID(), author: input.author, text: input.text, ts: Date.now() };
  try {
    await insertChatMessage(db(), msg);
    recordChatMessage();
    // Rimbalza a tutte le viste (fuori da recordEvent: non è un evento runtime).
    writeToClients(`data: ${JSON.stringify({ agentId: "chat", agentName: "chat", chat: msg })}\n\n`);
    res.json(msg);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// --- Presence: rinomina live (canale bidirezionale) ----------------------
// La vista dichiara la sua identità al connect (query param dell'EventSource);
// questo endpoint le permette di cambiare nome *senza riconnettersi* — primo
// pezzo concreto del canale client→server (frontiera #1). Aggiorna il nome di
// tutte le connessioni con lo stesso id (più schede) e ri-annuncia la presence.
// Da viewer: presentarsi col proprio nome non è "lavoro" (prima era editor e i viewer
// restavano "Ospite" per tutti).
const presenceLimiter = createRateLimiter(20, 30_000);

app.post("/api/presence", requireRole("viewer"), async (req: Request, res: Response) => {
  const { id, name } = sanitizeObserverIdentity((req.body as { id?: unknown })?.id, (req.body as { name?: unknown })?.name);
  if (!id) {
    res.status(400).json({ error: "id osservatore mancante" });
    return;
  }
  const key = req.ip ?? "?";
  if (!presenceLimiter.hit(key)) {
    const wait = Math.ceil(presenceLimiter.retryAfterMs(key) / 1000);
    res.status(429).json({ error: `Troppe modifiche — riprova tra ${wait}s`, retryAfterSec: wait });
    return;
  }
  // Solo le viste aperte con la stessa identità: l'id da solo è pubblico.
  const who = await viewIdentity(bearerToken(req.headers.authorization));
  let changed = 0;
  for (const [res2, obs] of clients) {
    if (obs.id === id && clientKeys.get(res2) === who && obs.name !== name) {
      clients.set(res2, { id, name });
      changed++;
    }
  }
  if (changed > 0) broadcastPresence();
  res.json({ ok: true, changed, people: distinctPeople([...clients.values()]) });
});

// --- Cursori live (Roadmap 4, frontiera #2) ------------------------------
// Ogni vista rimbalza la posizione del suo puntatore sul pavimento; le altre lo
// disegnano in scena. Effimero (niente DB), rimbalzato sul canale SSE esistente e
// tenuto fuori da `broadcast`/`recordEvent` (non è un evento runtime → non gonfia
// le metriche). Gated "viewer": anche un osservatore read-only mostra il cursore,
// ma con i token imposti serve comunque un token valido. Il rate-limit è per-vista
// (chiave = id del cursore) così più schede sullo stesso IP non si rubano il budget;
// oltre soglia si scarta in silenzio (204) — i cursori sono lossy per natura.
const cursorLimiter = createRateLimiter(20, 1000); // ~20 update/s per vista

app.post("/api/cursor", requireRole("viewer"), async (req: Request, res: Response) => {
  const c = sanitizeCursor(req.body);
  if (!c) {
    res.status(400).json({ error: "cursore non valido" });
    return;
  }
  if (!cursorLimiter.hit(c.id)) {
    res.status(204).end(); // troppo veloce → scarta senza rumore
    return;
  }
  writeToClients(
    `data: ${JSON.stringify({ agentId: "cursor", agentName: "cursor", cursor: { ...c, ts: Date.now() } })}\n\n`,
  );
  res.status(204).end();
});

// --- Presenza di selezione (Roadmap 4, frontiera #2) ---------------------
// Gemella dei cursori: ogni vista annuncia quale agente ha selezionato (o null);
// le altre lo mostrano con un'aura sull'agente. Il client rimanda la selezione
// corrente a bassa frequenza (heartbeat) così la staleness la ripulisce quando
// una vista si disconnette. Stesso stile dei cursori: effimero, fuori da
// `recordEvent`, gated "viewer", rate-limit per-vista.
const selectionLimiter = createRateLimiter(15, 5000); // ~3 update/s per vista

app.post("/api/selection", requireRole("viewer"), async (req: Request, res: Response) => {
  const sel = sanitizeSelection(req.body);
  if (!sel) {
    res.status(400).json({ error: "selezione non valida" });
    return;
  }
  if (!selectionLimiter.hit(sel.id)) {
    res.status(204).end();
    return;
  }
  writeToClients(
    `data: ${JSON.stringify({ agentId: "selection", agentName: "selection", selection: { ...sel, ts: Date.now() } })}\n\n`,
  );
  res.status(204).end();
});

// --- Driver lease (Roadmap 4, opzione B3) --------------------------------
// Elegge UNA vista come simulatore autorevole (primo mattone del mondo animato
// condiviso — non sposta ancora il game loop). Le viste rinnovano il lease su un
// heartbeat; il titolare vince sempre il rinnovo, gli altri solo se è scaduto →
// handover automatico se il driver sparisce. Leggere chi guida è da viewer;
// **prendere** la guida è da editor: chi guida salva il mondo, e un viewer non può
// (collaudo 2026-11-10: un viewer apriva per primo e guidava lui).
const driverLimiter = createRateLimiter(10, 5000); // heartbeat ~0.5/s, ampio margine

app.get("/api/driver", requireRole("viewer"), async (_req: Request, res: Response) => {
  res.json(currentDriver(Date.now()));
});

app.post("/api/driver", requireRole("editor"), async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as { id?: unknown; name?: unknown };
  const { id, name } = sanitizeObserverIdentity(body.id, body.name);
  if (!id) {
    res.status(400).json({ error: "id vista mancante" });
    return;
  }
  const now = Date.now();
  // Il lease ricorda anche chi lo tiene: con l'id altrui (pubblico) non si rinnova. Anche il
  // limite è per identità + id, così chi spamma l'id altrui non blocca i rinnovi del titolare.
  const who = await viewIdentity(bearerToken(req.headers.authorization));
  if (!driverLimiter.hit(`${who}|${id}`)) {
    const d = currentDriver(now);
    res.json({ ...d, youAreDriver: isLeaseHolder(driverLease, id, who, now) });
    return;
  }
  const { lease, changed } = claimDriver(driverLease, id, name, now, DRIVER_TTL, who);
  driverLease = lease;
  if (changed) broadcastDriver();
  res.json({ holderId: lease.holderId, name: lease.name, youAreDriver: isLeaseHolder(lease, id, who, now) });
});

// --- Movimento condiviso: snapshot cinematico (Roadmap 4, opzione B3) -----
// Il driver — e SOLO il driver — spinge le posizioni live degli agenti; le altre
// viste le adottano read-only e interpolano → tutti vedono lo stesso ufficio
// animarsi insieme. Effimero come i cursori (niente DB), broadcast SSE fuori da
// `recordEvent`. Gated "viewer", ma in più si accetta solo dal titolare corrente
// del lease: una vista non-driver che tentasse di spingere viene scartata in
// silenzio (204), così non esistono due simulatori che si contendono il movimento.
const worldSimLimiter = createRateLimiter(15, 1000); // fino a ~15 update/s dal driver

app.post("/api/worldsim", requireRole("viewer"), async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as { id?: unknown; agents?: unknown };
  const id = typeof body.id === "string" ? body.id : "";
  const now = Date.now();
  // Solo il driver in carica può spingere il mondo animato (evita la doppia simulazione).
  if (!id || !isLeaseHolder(driverLease, id, await viewIdentity(bearerToken(req.headers.authorization)), now)) {
    res.status(204).end();
    return;
  }
  if (!worldSimLimiter.hit(id)) {
    res.status(204).end(); // oltre soglia → scarta senza rumore (il movimento è lossy)
    return;
  }
  const agents = sanitizeWorldSim(body.agents);
  writeToClients(
    `data: ${JSON.stringify({ agentId: "worldsim", agentName: "worldsim", worldsim: { agents, ts: now } })}\n\n`,
  );
  res.status(204).end();
});

// --- Routine / trigger temporali ----------------------------------------
// Scheduled recurring tasks ("ogni mattina: riepilogo PR"). Stored durably in
// SQLite; a scheduler tick fires a `wake` (source: "routine") that the UI turns
// into an assignment to a free agent — reusing the same path as webhook wakes.

app.get("/api/routines", requireRole("viewer"), async (_req: Request, res: Response) => {
  try {
    res.json((await listRoutines(db())).map((r) => ({ ...r, schedule: describeSchedule(r) })));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post("/api/routines", requireRole("editor"), async (req: Request, res: Response) => {
  const input = sanitizeRoutine(req.body);
  if (!input) {
    res.status(400).json({ error: "Nome e titolo del task sono obbligatori" });
    return;
  }
  try {
    const routine = await insertRoutine(db(), randomUUID(), input);
    broadcast({ agentId: "routine", agentName: "Routine", level: "INFO", message: `⏰ Routine creata: ${routine.name} (${describeSchedule(routine)})` });
    res.json({ ...routine, schedule: describeSchedule(routine) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post("/api/routines/:id/toggle", requireRole("editor"), async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const enabled = req.body?.enabled !== false;
  try {
    await setRoutineEnabled(db(), id, enabled);
    res.json({ ok: true, id, enabled });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.delete("/api/routines/:id", requireRole("editor"), async (req: Request, res: Response) => {
  const id = req.params.id as string;
  try {
    await deleteRoutine(db(), id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * Scheduler tick: assign each due routine by broadcasting a `wake`. We only fire
 * when the runtime is ready (otherwise the assignment would 503 on the client)
 * and when at least one UI is connected to receive it — leaving `lastRun`
 * untouched so the routine fires as soon as those conditions hold, without a
 * burst. `markRoutineRun` stamps the time so a routine runs once per due window.
 */
const ROUTINE_TICK_MS = 30_000;
async function routineTick(): Promise<void> {
  if (!isReady() || clients.size === 0) return;
  let due;
  try {
    due = dueRoutines(await listRoutines(db()), Date.now());
  } catch {
    return; // DB unavailable — try again next tick
  }
  for (const r of due) {
    try {
      await markRoutineRun(db(), r.id, Date.now());
    } catch {
      return; // senza timbro la routine ripartirebbe a ogni giro: meglio riprovare dopo
    }
    broadcast({
      agentId: "routine",
      agentName: "Routine",
      level: "WARN",
      message: `⏰ Routine "${r.name}" → ${r.title}`,
      wake: { title: r.title, branch: r.branch || undefined, reason: `routine: ${r.name}`, source: "routine" },
    });
  }
}

// GitHub webhook — receives push / pull_request / workflow_run events. Verifies
// the HMAC signature (GITHUB_WEBHOOK_SECRET; without it, unsigned requests are
// accepted only outside production — in production they get 503), re-broadcasts a summary
// as a SAMS WireEvent, and on a CI failure attaches a "wake" suggestion so the
// frontend can assign a contextual fix task to a free agent.
// To connect: GitHub → Repo Settings → Webhooks → http://host/api/webhook/github
// (Content-Type: application/json; set a Secret = GITHUB_WEBHOOK_SECRET).
app.post("/api/webhook/github", async (req: Request, res: Response) => {
  const event = req.headers["x-github-event"] as string | undefined;
  if (!event) { res.status(400).json({ error: "x-github-event header missing" }); return; }

  const secret = getSettings().githubWebhookSecret;
  const signature = req.headers["x-hub-signature-256"] as string | undefined;
  const rawBody = (req as Request & { rawBody?: string }).rawBody ?? "";
  const auth = checkWebhookAuth(secret, rawBody, signature, process.env.NODE_ENV === "production");
  if (auth === "unconfigured") {
    // In produzione una richiesta non firmata non si accetta: manca il secret.
    log.warn("Webhook GitHub rifiutato: GITHUB_WEBHOOK_SECRET non impostato", { event });
    res.status(503).json({ error: "webhook non configurato: imposta GITHUB_WEBHOOK_SECRET" });
    return;
  }
  if (auth === "bad_signature") {
    log.warn("Webhook GitHub rifiutato: firma non valida", { event });
    res.status(401).json({ error: "firma non valida" });
    return;
  }
  res.json({ ok: true });

  // Auto-innaffiatura: un push reale fa crescere il giardino di chi ha spinto,
  // senza aspettare il refresh manuale. `latestSeen` = head commit, così il
  // polling (fetchPushActivity) non riconta gli stessi commit.
  if (event === "push") {
    const w = parsePushWatering(req.body as Record<string, unknown>);
    if (w) {
      void (async () => {
        try {
          const store = getStore();
          const prev = (await store.get(w.user)) ?? emptyGarden(w.user);
          const next = water(prev, w.waterings, w.latestSeen, new Date().toISOString().slice(0, 10));
          await store.put(next);
          broadcast({
            agentId: "github",
            agentName: "GitHub",
            level: "SUCCESS",
            message: `🌱 Giardino di ${w.user} innaffiato (+${w.waterings}) → ${next.stage}`,
          });
        } catch (err) {
          log.warn("Auto-innaffiatura fallita", { user: w.user, error: (err as Error).message });
        }
      })();
    }
  }

  const result = parseGithubEvent(event, req.body as Record<string, unknown>);
  if (!result) { log.debug("GitHub webhook ignorato", { event }); return; }

  broadcast({ agentId: "github", agentName: "GitHub", level: result.level, message: result.message });
  if (result.wake) {
    broadcast({
      agentId: "github",
      agentName: "GitHub",
      level: "WARN",
      message: `🔔 ${result.wake.reason} — suggerito un task contestuale`,
      wake: { ...result.wake, source: "webhook" },
    });
  }
});

// Commit Garden lives inside the SAMS runtime (no separate app/port).
registerGardenRoutes(app);

// In production (Docker), serve the Vite build as static files so the same
// Express process handles both the API and the SPA without a separate Nginx.
if (process.env.NODE_ENV === "production") {
  const __dir = dirname(fileURLToPath(import.meta.url));
  const publicDir = join(__dir, "../../dist");
  app.use(express.static(publicDir));
  app.use((_req: Request, res: Response) => {
    res.sendFile(join(publicDir, "index.html"));
  });
}

// Final error handler: turn body-parse / payload-size / unexpected throws into
// consistent JSON instead of Express's default HTML error page.
app.use((err: Error & { type?: string; status?: number }, _req: Request, res: Response, _next: NextFunction) => {
  if (res.headersSent) return;
  if (err?.type === "entity.parse.failed") {
    res.status(400).json({ error: "Corpo della richiesta JSON non valido" });
    return;
  }
  if (err?.type === "entity.too.large") {
    res.status(413).json({ error: "Payload troppo grande" });
    return;
  }
  log.error("Errore non gestito", { msg: err.message ?? String(err) });
  res.status(500).json({ error: "Errore interno del runtime" });
});

// Last-resort safety net so a stray rejection logs instead of crashing silently.
process.on("unhandledRejection", (reason) => log.error("UnhandledRejection", { reason: String(reason) }));

if (ephemeralWithoutDb()) {
  log.error(
    "SAMS_EPHEMERAL_DISK è attivo ma manca SAMS_DB_URL: i dati finirebbero su un disco che si azzera. Imposta SAMS_DB_URL (MySQL 8) e riavvia.",
  );
  process.exit(1);
}

// Il database si apre **prima** di accettare richieste: con MySQL (SAMS_DB_URL) è una
// connessione di rete, e se non risponde è meglio non partire che scrivere altrove.
try {
  await initDb();
  log.info("Database pronto", { backend: dbBackend() });
  // Le scelte di ⚙ (provider, modello, repo…) stanno nel database: si caricano qui,
  // prima di servire richieste. La prima volta si importano dal vecchio file.
  const { imported } = await initSettings(db());
  if (imported.length > 0) log.info("Impostazioni importate dal file nel database", { fields: imported });
  if (ephemeralDisk()) log.info("Disco effimero: le chiavi si leggono solo dalle variabili d'ambiente");
} catch (err) {
  log.error("Database non raggiungibile: il runtime non parte", { backend: dbBackend(), err: String(err) });
  process.exit(1);
}

const { port, githubRepo } = getSettings();
app.listen(port, () => {
  log.info(`SAMS runtime avviato`, { url: `http://localhost:${port}`, repo: githubRepo, ready: isReady() });
  void initGardenStore()
    .then((k) => log.info("Garden store pronto", { backend: k }))
    .catch((err) => log.error("Garden store init fallito", { error: (err as Error).message }));
  // Start the routine scheduler (checks for due recurring tasks every 30s).
  setInterval(() => void routineTick(), ROUTINE_TICK_MS);
  // Garbage-collect expired auth sessions: once at boot, then every 6 hours.
  const pruneSessions = async () => {
    try {
      const n = await pruneAuthSessions(db());
      if (n > 0) log.info("Sessioni scadute rimosse", { count: n });
    } catch {
      /* DB non disponibile → riprova al prossimo giro */
    }
  };
  void pruneSessions();
  setInterval(() => void pruneSessions(), 6 * 60 * 60 * 1000);
});
