import { describe, expect, it } from "vitest";
import { buildFileTree, flattenBadgedFiles, flattenFiles } from "./fileTree";
import type { FileNode } from "../types";

describe("buildFileTree", () => {
  it("annida i percorsi piatti in cartelle e file", () => {
    const tree = buildFileTree([
      { path: "src", type: "tree" },
      { path: "src/app.ts", type: "blob" },
      { path: "src/lib", type: "tree" },
      { path: "src/lib/util.ts", type: "blob" },
      { path: "README.md", type: "blob" },
    ]);
    // cartelle prima, poi file; a livello radice: src/ poi README.md
    expect(tree.map((n) => n.name)).toEqual(["src", "README.md"]);
    const src = tree[0];
    expect(src.kind).toBe("folder");
    // dentro src: lib/ (cartella) prima di app.ts (file)
    expect(src.children!.map((n) => `${n.kind}:${n.name}`)).toEqual(["folder:lib", "file:app.ts"]);
    expect(src.children![0].children!.map((n) => n.name)).toEqual(["util.ts"]);
  });

  it("crea le cartelle intermedie anche se non elencate", () => {
    const tree = buildFileTree([{ path: "a/b/c.txt", type: "blob" }]);
    expect(tree.map((n) => n.name)).toEqual(["a"]);
    expect(tree[0].children![0].name).toBe("b");
    expect(tree[0].children![0].children![0].name).toBe("c.txt");
  });

  it("id stabili e distinti per file e cartelle", () => {
    const tree = buildFileTree([{ path: "src/app.ts", type: "blob" }]);
    expect(tree[0].id).toBe("dir:src");
    expect(tree[0].children![0].id).toBe("file:src/app.ts");
  });

  it("gestisce input vuoto e voci malformate", () => {
    expect(buildFileTree([])).toEqual([]);
    expect(buildFileTree([{ path: "", type: "blob" }])).toEqual([]);
  });
});

describe("flattenBadgedFiles", () => {
  it("returns nothing for an empty tree", () => {
    expect(flattenBadgedFiles([])).toEqual([]);
  });

  it("collects only files that carry a badge", () => {
    const tree: FileNode[] = [
      { id: "1", name: "a.ts", kind: "file", badge: "M" },
      { id: "2", name: "b.ts", kind: "file" }, // no badge → excluded
      { id: "3", name: "c.ts", kind: "file", badge: "U" },
    ];
    expect(flattenBadgedFiles(tree)).toEqual([
      { path: "a.ts", badge: "M" },
      { path: "c.ts", badge: "U" },
    ]);
  });

  it("joins nested paths with slashes", () => {
    const tree: FileNode[] = [
      {
        id: "dir",
        name: "src",
        kind: "folder",
        children: [
          { id: "f", name: "index.ts", kind: "file", badge: "A" },
          {
            id: "sub",
            name: "lib",
            kind: "folder",
            children: [{ id: "g", name: "util.ts", kind: "file", badge: "M" }],
          },
        ],
      },
    ];
    expect(flattenBadgedFiles(tree)).toEqual([
      { path: "src/index.ts", badge: "A" },
      { path: "src/lib/util.ts", badge: "M" },
    ]);
  });

  it("does not emit folders even when they would have a badge", () => {
    const tree: FileNode[] = [
      { id: "d", name: "pkg", kind: "folder", badge: "M", children: [] },
    ];
    expect(flattenBadgedFiles(tree)).toEqual([]);
  });
});

describe("flattenFiles", () => {
  it("collects every file (badged or not) with its full path", () => {
    const tree: FileNode[] = [
      {
        id: "dir",
        name: "src",
        kind: "folder",
        children: [
          { id: "a", name: "index.ts", kind: "file" },
          { id: "b", name: "util.ts", kind: "file", badge: "M" },
        ],
      },
      { id: "c", name: "README.md", kind: "file" },
    ];
    expect(flattenFiles(tree)).toEqual([
      { id: "a", name: "index.ts", path: "src/index.ts" },
      { id: "b", name: "util.ts", path: "src/util.ts" },
      { id: "c", name: "README.md", path: "README.md" },
    ]);
  });

  it("returns nothing for an empty tree", () => {
    expect(flattenFiles([])).toEqual([]);
  });
});
