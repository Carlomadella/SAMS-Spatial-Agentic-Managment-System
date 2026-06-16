import { config } from "./config";

interface PullRequest {
  html_url: string;
  number: number;
}

/** Open a PR from `branch` → base branch using the configured GitHub token. */
export async function createPullRequest(args: {
  branch: string;
  title: string;
  body: string;
}): Promise<PullRequest> {
  const [owner, repo] = config.githubRepo.split("/");
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.githubToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "sams-runtime",
    },
    body: JSON.stringify({
      title: args.title,
      head: args.branch,
      base: config.baseBranch,
      body: args.body,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as PullRequest;
}
