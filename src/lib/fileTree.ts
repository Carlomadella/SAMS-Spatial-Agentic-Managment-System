import type { FileNode } from "../types";

export interface BadgedFile {
  path: string;
  badge: string;
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
