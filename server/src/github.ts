import { getSettings } from "./config";
import { HttpError, jsonFetch } from "./http";

const API = "https://api.github.com";

function headers(): Record<string, string> {
  const s = getSettings();
  return {
    Authorization: `Bearer ${s.githubToken}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
    "User-Agent": "sams-runtime",
  };
}

function repoBase(): string {
  const repo = getSettings().githubRepo;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    throw new Error(`Repository GitHub non valido: "${repo}" (atteso owner/repo)`);
  }
  const [owner, name] = repo.split("/");
  return `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
}

/** Normalize a repo-relative path: strip leading slashes, reject `.`/`..`, encode each segment. */
function cleanPath(filePath: string): string {
  const parts = filePath.replace(/^\/+/, "").split("/").filter(Boolean);
  if (parts.some((p) => p === ".." || p === ".")) throw new Error(`Percorso non valido: "${filePath}"`);
  return parts.map(encodeURIComponent).join("/");
}

async function gh(pathSuffix: string, init?: RequestInit): Promise<unknown> {
  return jsonFetch(`${repoBase()}${pathSuffix}`, { ...init, headers: headers() }, "GitHub");
}

interface PullRequest {
  html_url: string;
  number: number;
}

/** Create `newBranch` from `fromBranch` (no-op if it already exists). */
export async function createBranch(newBranch: string, fromBranch: string): Promise<void> {
  const ref = (await gh(`/git/ref/heads/${encodeURIComponent(fromBranch)}`)) as {
    object: { sha: string };
  };
  try {
    await gh(`/git/refs`, {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${newBranch}`, sha: ref.object.sha }),
    });
  } catch (err) {
    // 422 "Reference already exists" is the expected no-op; rethrow anything else.
    if (err instanceof HttpError && err.status === 422 && /already exists/i.test(err.message)) return;
    throw err;
  }
}

export async function listFiles(dirPath: string, ref: string): Promise<string[]> {
  const clean = cleanPath(dirPath);
  const data = (await gh(`/contents/${clean}?ref=${encodeURIComponent(ref)}`)) as
    | Array<{ name: string; type: string }>
    | { name: string };
  if (Array.isArray(data)) return data.map((e) => `${e.type === "dir" ? "📁 " : ""}${e.name}`);
  return [(data as { name: string }).name];
}

export async function readFile(filePath: string, ref: string): Promise<string> {
  const clean = cleanPath(filePath);
  const data = (await gh(`/contents/${clean}?ref=${encodeURIComponent(ref)}`)) as {
    content?: string;
    encoding?: string;
  };
  if (!data.content) throw new Error("not a file");
  return Buffer.from(data.content, "base64").toString("utf8");
}

async function getSha(filePath: string, branch: string): Promise<string | undefined> {
  try {
    const data = (await gh(`/contents/${cleanPath(filePath)}?ref=${encodeURIComponent(branch)}`)) as {
      sha?: string;
    };
    return data.sha;
  } catch (err) {
    // Only a 404 means "file doesn't exist yet" — propagate transient errors so
    // we never silently overwrite (commit without the sha) on a network blip.
    if (err instanceof HttpError && err.status === 404) return undefined;
    throw err;
  }
}

/** Create or update a file on `branch`, committing the change. */
export async function writeFile(
  filePath: string,
  content: string,
  branch: string,
  message: string,
): Promise<void> {
  const clean = cleanPath(filePath);
  const sha = await getSha(filePath, branch);
  await gh(`/contents/${clean}`, {
    method: "PUT",
    body: JSON.stringify({
      message,
      content: Buffer.from(content, "utf8").toString("base64"),
      branch,
      ...(sha ? { sha } : {}),
    }),
  });
}

export async function createPullRequest(args: {
  branch: string;
  title: string;
  body: string;
}): Promise<PullRequest> {
  const s = getSettings();
  return (await gh(`/pulls`, {
    method: "POST",
    body: JSON.stringify({ title: args.title, head: args.branch, base: s.baseBranch, body: args.body }),
  })) as PullRequest;
}

/** Create a GitHub issue. Returns its number and URL. */
export async function createIssue(
  title: string,
  body: string,
  labels?: string[],
): Promise<{ number: number; html_url: string }> {
  return (await gh(`/issues`, {
    method: "POST",
    body: JSON.stringify({ title, body, labels: labels ?? [] }),
  })) as { number: number; html_url: string };
}

/** List up to 10 open pull requests (number, title, author, source branch). */
export async function listPullRequests(): Promise<string> {
  const data = (await gh(`/pulls?state=open&per_page=10`)) as Array<{
    number: number; title: string;
    user: { login: string }; head: { ref: string };
  }>;
  if (!data.length) return "nessuna PR aperta";
  return data.map((p) => `#${p.number} "${p.title}" — ${p.user.login} (${p.head.ref})`).join("\n");
}

/** Read a PR's title, body, and list of changed files. */
export async function readPullRequest(prNumber: number): Promise<string> {
  const [pr, filesRaw] = await Promise.all([
    gh(`/pulls/${prNumber}`) as Promise<{
      title: string; body: string | null; html_url: string;
      user: { login: string }; head: { ref: string }; base: { ref: string };
      comments: number; review_comments: number;
    }>,
    gh(`/pulls/${prNumber}/files?per_page=30`) as Promise<Array<{
      filename: string; status: string; additions: number; deletions: number;
    }>>,
  ]);
  const files = filesRaw
    .map((f) => `  ${f.status === "added" ? "+" : f.status === "removed" ? "-" : "M"} ${f.filename} (+${f.additions}/-${f.deletions})`)
    .join("\n");
  const body = pr.body ? pr.body.slice(0, 1000) : "(nessuna descrizione)";
  return [
    `PR #${prNumber}: ${pr.title}`,
    `Autore: ${pr.user.login} | ${pr.head.ref} → ${pr.base.ref}`,
    `Commenti: ${pr.comments} | Review: ${pr.review_comments}`,
    `URL: ${pr.html_url}`,
    `\nDescrizione:\n${body}`,
    `\nFile modificati (${filesRaw.length}):\n${files || "  (nessuno)"}`,
  ].join("\n");
}

/** Post a comment on a PR (uses the issues comments endpoint). */
export async function commentOnPullRequest(prNumber: number, body: string): Promise<{ html_url: string }> {
  return (await gh(`/issues/${prNumber}/comments`, {
    method: "POST",
    body: JSON.stringify({ body }),
  })) as { html_url: string };
}

/** List the 5 most recent CI workflow runs (optionally filtered to a branch). */
export async function listCIRuns(branch?: string): Promise<string> {
  const q = branch ? `?branch=${encodeURIComponent(branch)}&per_page=5` : `?per_page=5`;
  const data = (await gh(`/actions/runs${q}`)) as {
    total_count?: number;
    workflow_runs?: Array<{
      id: number; name: string; status: string; conclusion: string | null;
      html_url: string; head_branch: string; created_at: string;
    }>;
  };
  const runs = data.workflow_runs ?? [];
  if (!runs.length) return "nessuna run CI trovata";
  return runs
    .map((r) => {
      const icon = r.conclusion === "success" ? "✅" : r.conclusion === "failure" ? "❌" : r.status === "in_progress" ? "🔄" : "⏳";
      return `${icon} ${r.name} | ${r.status}${r.conclusion ? "/" + r.conclusion : ""} | ${r.head_branch} | ${r.created_at.slice(0, 10)}\n   ${r.html_url}`;
    })
    .join("\n");
}
