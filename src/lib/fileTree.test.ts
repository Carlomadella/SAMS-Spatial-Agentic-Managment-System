import { describe, expect, it } from "vitest";
import { flattenBadgedFiles, flattenFiles } from "./fileTree";
import type { FileNode } from "../types";

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
