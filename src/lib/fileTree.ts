import type { FileNode } from "../types";

export interface RepoEntry {
  path: string;
  type: "blob" | "tree";
}

/**
 * Annida i percorsi piatti (`a/b/c.ts`) del repo di lavoro in `FileNode[]` per la
 * sidebar. Le cartelle intermedie vengono create anche se non elencate; ordina
 * cartelle-prima poi per nome (case-insensitive). `id` stabili (`dir:`/`file:` + path).
 */
export function buildFileTree(entries: RepoEntry[]): FileNode[] {
  const root: FileNode[] = [];
  const folders = new Map<string, FileNode>(); // path cartella → nodo

  // children[] della cartella `path` ("" = radice), creandola (e i genitori) se serve
  const childrenOf = (path: string): FileNode[] => {
    if (!path) return root;
    const existing = folders.get(path);
    if (existing) return existing.children!;
    const parts = path.split("/");
    const node: FileNode = { id: `dir:${path}`, name: parts[parts.length - 1], kind: "folder", children: [] };
    folders.set(path, node);
    childrenOf(parts.slice(0, -1).join("/")).push(node);
    return node.children!;
  };

  for (const e of entries) {
    if (!e || typeof e.path !== "string") continue;
    const parts = e.path.split("/").filter(Boolean);
    if (parts.length === 0) continue;
    if (e.type === "tree") {
      childrenOf(parts.join("/"));
    } else {
      childrenOf(parts.slice(0, -1).join("/")).push({ id: `file:${e.path}`, name: parts[parts.length - 1], kind: "file" });
    }
  }

  const sort = (nodes: FileNode[]) => {
    nodes.sort((a, b) =>
      a.kind === b.kind
        ? a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
        : a.kind === "folder"
          ? -1
          : 1,
    );
    for (const n of nodes) if (n.children) sort(n.children);
  };
  sort(root);
  return root;
}

export interface BadgedFile {
  path: string;
  badge: string;
}

export interface FlatFile {
  id: string;
  name: string;
  path: string;
}

/** Walk a file tree and collect every file (leaf) with its full slash path. */
export function flattenFiles(nodes: FileNode[], prefix = ""): FlatFile[] {
  const out: FlatFile[] = [];
  for (const n of nodes) {
    const fullPath = prefix ? `${prefix}/${n.name}` : n.name;
    if (n.kind === "file") out.push({ id: n.id, name: n.name, path: fullPath });
    if (n.children) out.push(...flattenFiles(n.children, fullPath));
  }
  return out;
}

/**
 * Walk a file tree and collect every file that carries a git-style badge
 * (M / U / A), with its full slash-joined path. Used by the Source Control panel
 * to present a flat "changed files" list out of the nested Explorer tree.
 */
export function flattenBadgedFiles(nodes: FileNode[], prefix = ""): BadgedFile[] {
  const out: BadgedFile[] = [];
  for (const n of nodes) {
    const fullPath = prefix ? `${prefix}/${n.name}` : n.name;
    if (n.kind === "file" && n.badge) out.push({ path: fullPath, badge: n.badge });
    if (n.children) out.push(...flattenBadgedFiles(n.children, fullPath));
  }
  return out;
}
