import { getSettings } from "./config";

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
  const [owner, repo] = getSettings().githubRepo.split("/");
  return `${API}/repos/${owner}/${repo}`;
}

async function gh(pathSuffix: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${repoBase()}${pathSuffix}`, { ...init, headers: headers() });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
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
    if (!String((err as Error).message).includes("422")) throw err; // 422 = already exists
  }
}

export async function listFiles(dirPath: string, ref: string): Promise<string[]> {
  const clean = dirPath.replace(/^\/+/, "");
  const data = (await gh(`/contents/${clean}?ref=${encodeURIComponent(ref)}`)) as
    | Array<{ name: string; type: string }>
    | { name: string };
  if (Array.isArray(data)) return data.map((e) => `${e.type === "dir" ? "📁 " : ""}${e.name}`);
  return [(data as { name: string }).name];
}

export async function readFile(filePath: string, ref: string): Promise<string> {
  const clean = filePath.replace(/^\/+/, "");
  const data = (await gh(`/contents/${clean}?ref=${encodeURIComponent(ref)}`)) as {
    content?: string;
    encoding?: string;
  };
  if (!data.content) throw new Error("not a file");
  return Buffer.from(data.content, "base64").toString("utf8");
}

async function getSha(filePath: string, branch: string): Promise<string | undefined> {
  try {
    const data = (await gh(`/contents/${filePath.replace(/^\/+/, "")}?ref=${encodeURIComponent(branch)}`)) as {
      sha?: string;
    };
    return data.sha;
  } catch {
    return undefined; // file doesn't exist yet
  }
}

/** Create or update a file on `branch`, committing the change. */
export async function writeFile(
  filePath: string,
  content: string,
  branch: string,
  message: string,
): Promise<void> {
  const clean = filePath.replace(/^\/+/, "");
  const sha = await getSha(clean, branch);
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
