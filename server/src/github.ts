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

/** Merge-readiness + CI check rollup for a PR (read-only — supports a "gate on green" flow). */
export async function pullRequestStatus(prNumber: number): Promise<string> {
  const pr = (await gh(`/pulls/${prNumber}`)) as {
    state: string; mergeable: boolean | null; mergeable_state: string;
    head: { sha: string }; draft?: boolean;
  };
  const checks = (await gh(`/commits/${encodeURIComponent(pr.head.sha)}/check-runs`)) as {
    total_count?: number;
    check_runs?: Array<{ name: string; status: string; conclusion: string | null }>;
  };
  const runs = checks.check_runs ?? [];
  const summary = runs.length
    ? runs
        .map((c) => {
          const icon = c.conclusion === "success" ? "✅" : c.conclusion === "failure" ? "❌" : c.status === "completed" ? "•" : "🔄";
          return `  ${icon} ${c.name}${c.conclusion ? ` (${c.conclusion})` : ` (${c.status})`}`;
        })
        .join("\n")
    : "  (nessun check)";
  const mergeable = pr.mergeable === null ? "in calcolo" : pr.mergeable ? "sì" : "no";
  return [
    `PR #${prNumber}: stato ${pr.state}${pr.draft ? " (draft)" : ""}`,
    `Mergeable: ${mergeable} | stato: ${pr.mergeable_state}`,
    `Check CI (${runs.length}):\n${summary}`,
  ].join("\n");
}

/** Merge a PR (default squash). Throws (→ caught upstream) if GitHub refuses. */
export async function mergePullRequest(
  prNumber: number,
  method: "merge" | "squash" | "rebase" = "squash",
): Promise<string> {
  const data = (await gh(`/pulls/${prNumber}/merge`, {
    method: "PUT",
    body: JSON.stringify({ merge_method: method }),
  })) as { merged?: boolean; message?: string; sha?: string };
  return data.merged
    ? `PR #${prNumber} mergiata (${method}) — ${data.sha?.slice(0, 7) ?? ""}`
    : `PR #${prNumber} non mergiata: ${data.message ?? "motivo sconosciuto"}`;
}

/** Post a comment on a PR (uses the issues comments endpoint). */
export async function commentOnPullRequest(prNumber: number, body: string): Promise<{ html_url: string }> {
  return (await gh(`/issues/${prNumber}/comments`, {
    method: "POST",
    body: JSON.stringify({ body }),
  })) as { html_url: string };
}

/** A GitHub issue (not a PR). */
export interface GithubIssue {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  labels: string[];
}

/** List open issues (not PRs) with an optional label filter (up to 10). */
export async function listIssues(label?: string): Promise<GithubIssue[]> {
  const q = label
    ? `?state=open&labels=${encodeURIComponent(label)}&per_page=10`
    : `?state=open&per_page=10`;
  const data = (await gh(`/issues${q}`)) as Array<{
    number: number;
    title: string;
    body: string | null;
    html_url: string;
    pull_request?: unknown;
    labels: Array<{ name: string }>;
  }>;
  return data
    .filter((i) => !i.pull_request)
    .map((i) => ({
      number: i.number,
      title: i.title,
      body: i.body,
      html_url: i.html_url,
      labels: i.labels.map((l) => l.name),
    }));
}

/** Add a label to an issue (best-effort). */
export async function addIssueLabel(issueNumber: number, label: string): Promise<void> {
  await gh(`/issues/${issueNumber}/labels`, {
    method: "POST",
    body: JSON.stringify({ labels: [label] }),
  });
}

/** Remove a label from an issue (silent on 404). */
export async function removeIssueLabel(issueNumber: number, label: string): Promise<void> {
  try {
    await gh(`/issues/${issueNumber}/labels/${encodeURIComponent(label)}`, { method: "DELETE" });
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) return;
    throw err;
  }
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
