import { getSettings } from "../config";

export interface PushActivity {
  newWaterings: number;
  latestSeen: string | null;
}

interface GitHubEvent {
  type: string;
  created_at: string;
  payload?: { size?: number; commits?: unknown[] };
}

/** Count commits the user pushed since `since` via the public Events API. */
export async function fetchPushActivity(user: string, since: string | null): Promise<PushActivity> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "sams-commit-garden",
  };
  const token = getSettings().githubToken;
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(
    `https://api.github.com/users/${encodeURIComponent(user)}/events/public?per_page=100`,
    { headers },
  );
  if (res.status === 404) throw new Error(`utente GitHub "${user}" non trovato`);
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${(await res.text()).slice(0, 160)}`);

  const events = (await res.json()) as GitHubEvent[];
  let newWaterings = 0;
  let latestSeen: string | null = since;

  for (const ev of events) {
    if (ev.type !== "PushEvent") continue;
    if (since && Date.parse(ev.created_at) <= Date.parse(since)) continue;
    const commits = ev.payload?.size ?? ev.payload?.commits?.length ?? 1;
    newWaterings += Math.max(1, commits);
    if (!latestSeen || Date.parse(ev.created_at) > Date.parse(latestSeen)) latestSeen = ev.created_at;
  }

  return { newWaterings, latestSeen };
}
