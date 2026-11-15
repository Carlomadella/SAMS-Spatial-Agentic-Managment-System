import { describe, expect, it } from "vitest";
import { buildFileTree, flattenFiles } from "./fileTree";
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

  it("nasconde i dotfile e le dot-cartelle (.gitignore, .github/…)", () => {
    const tree = buildFileTree([
      { path: ".gitignore", type: "blob" },
      { path: ".github", type: "tree" },
      { path: ".github/workflows/ci.yml", type: "blob" },
      { path: "src/.hidden", type: "blob" },
      { path: "src/app.ts", type: "blob" },
      { path: "README.md", type: "blob" },
    ]);
    // niente dotfile/dot-cartelle né file nascosti dentro le cartelle
    expect(tree.map((n) => n.name)).toEqual(["src", "README.md"]);
    expect(tree[0].children!.map((n) => n.name)).toEqual(["app.ts"]);
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
