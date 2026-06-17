import { getSettings } from "./config";

const API = "https://api.notion.com/v1";

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${getSettings().notionToken}`,
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json",
  };
}

async function notion(path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${API}${path}`, { ...init, headers: headers() });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Notion ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

export function notionConfigured(): boolean {
  return getSettings().notionToken.length > 0;
}

function pageId(input: string): string {
  const compact = input.replace(/-/g, "");
  const match = compact.match(/[0-9a-fA-F]{32}/);
  return match ? match[0] : compact;
}

// --- block helpers ----------------------------------------------------------

type Block = Record<string, unknown>;

function chunk(s: string, n = 1900): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length; i += n) out.push(s.slice(i, i + n));
  return out.length ? out : [""];
}

function richText(s: string) {
  return chunk(s).map((content) => ({ type: "text", text: { content } }));
}

const NOTION_LANG: Record<string, string> = {
  js: "javascript",
  javascript: "javascript",
  ts: "typescript",
  typescript: "typescript",
  py: "python",
  python: "python",
  sh: "bash",
  shell: "bash",
  bash: "bash",
  html: "html",
  css: "css",
  json: "json",
  sql: "sql",
  java: "java",
  go: "go",
  rust: "rust",
  ruby: "ruby",
  php: "php",
  c: "c",
  "c++": "c++",
  cpp: "c++",
  tsx: "typescript",
  jsx: "javascript",
};

function codeBlock(code: string, lang: string): Block {
  return {
    object: "block",
    type: "code",
    code: { rich_text: richText(code), language: NOTION_LANG[lang.toLowerCase()] ?? "plain text" },
  };
}

function textBlock(type: string, text: string): Block {
  return { object: "block", type, [type]: { rich_text: richText(text) } };
}

/** Convert a pragmatic markdown subset into Notion blocks. */
export function markdownToBlocks(md: string): Block[] {
  const blocks: Block[] = [];
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const fence = line.match(/^```(\w+)?\s*$/);
    if (fence) {
      const lang = fence[1] ?? "";
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) buf.push(lines[i++]);
      i++; // skip closing fence
      blocks.push(codeBlock(buf.join("\n"), lang));
      continue;
    }
    if (/^\s*$/.test(line)) {
      i++;
      continue;
    }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      blocks.push(textBlock(`heading_${level}`, h[2]));
      i++;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      blocks.push(textBlock("bulleted_list_item", line.replace(/^\s*[-*]\s+/, "")));
      i++;
      continue;
    }
    blocks.push(textBlock("paragraph", line));
    i++;
  }
  return blocks;
}

async function appendBlocks(id: string, children: Block[]): Promise<void> {
  // Notion accepts up to 100 children per call.
  for (let i = 0; i < children.length; i += 100) {
    await notion(`/blocks/${pageId(id)}/children`, {
      method: "PATCH",
      body: JSON.stringify({ children: children.slice(i, i + 100) }),
    });
  }
}

function titleOf(page: Record<string, unknown>): string {
  const props = (page.properties ?? {}) as Record<string, { type?: string; title?: Array<{ plain_text?: string }> }>;
  for (const key of Object.keys(props)) {
    const p = props[key];
    if (p?.type === "title" && Array.isArray(p.title)) return p.title.map((t) => t.plain_text ?? "").join("");
  }
  return "";
}

/** Find a page by (fuzzy) title. Returns its id and resolved title. */
export async function findPageByTitle(title: string): Promise<{ id: string; title: string }> {
  const data = (await notion(`/search`, {
    method: "POST",
    body: JSON.stringify({ query: title, filter: { value: "page", property: "object" }, page_size: 25 }),
  })) as { results?: Array<Record<string, unknown>> };
  const results = data.results ?? [];
  if (results.length === 0) throw new Error(`nessuna pagina trovata per "${title}"`);
  const want = title.trim().toLowerCase();
  const exact = results.find((p) => titleOf(p).trim().toLowerCase() === want);
  const chosen = exact ?? results.find((p) => titleOf(p).toLowerCase().includes(want)) ?? results[0];
  return { id: String(chosen.id), title: titleOf(chosen) || title };
}

/** Write markdown content into the page whose title matches `title`. */
export async function appendToPageByTitle(title: string, content: string): Promise<string> {
  const page = await findPageByTitle(title);
  await appendBlocks(page.id, markdownToBlocks(content));
  return page.title;
}

/** Append a one-line task-log bullet to the configured log page. */
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
  await appendBlocks(s.notionPageId, [textBlock("bulleted_list_item", text)]);
}
