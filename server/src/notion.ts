import { getSettings } from "./config";

/** Extract a 32-char Notion id from a URL or raw id. */
function pageId(input: string): string {
  const compact = input.replace(/-/g, "");
  const match = compact.match(/[0-9a-fA-F]{32}/);
  return match ? match[0] : compact;
}

export function notionConfigured(): boolean {
  const s = getSettings();
  return s.notionToken.length > 0 && s.notionPageId.length > 0;
}

/** Append a one-line task log entry (bulleted item) to the configured page. */
export async function appendTaskLog(entry: {
  agentName: string;
  title: string;
  branch: string;
  repo: string;
  prUrl?: string;
}): Promise<void> {
  const s = getSettings();
  if (!s.notionToken || !s.notionPageId) return;

  const date = new Date().toISOString().slice(0, 10);
  const text =
    `${date} — ${entry.agentName}: ${entry.title} ` +
    `(${entry.repo}@${entry.branch})${entry.prUrl ? ` · PR: ${entry.prUrl}` : ""}`;

  const res = await fetch(`https://api.notion.com/v1/blocks/${pageId(s.notionPageId)}/children`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${s.notionToken}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      children: [
        {
          object: "block",
          type: "bulleted_list_item",
          bulleted_list_item: {
            rich_text: [{ type: "text", text: { content: text } }],
          },
        },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Notion ${res.status}: ${detail.slice(0, 200)}`);
  }
}
