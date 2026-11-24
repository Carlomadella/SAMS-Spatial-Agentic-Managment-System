import { describe, expect, it } from "vitest";
import { filesUnder } from "./github";

describe("filesUnder (elenco ricorsivo di gh_list_files)", () => {
  const tree = [
    { path: "package.json", type: "blob" as const },
    { path: "client", type: "tree" as const },
    { path: "client/src/App.tsx", type: "blob" as const },
    { path: "client/src/api/auth.ts", type: "blob" as const },
    { path: "clientele.md", type: "blob" as const },
    { path: "server/src/index.ts", type: "blob" as const },
  ];

  it("solo i file sotto la cartella, con il percorso completo", () => {
    expect(filesUnder(tree, "client", 100)).toEqual(["client/src/App.tsx", "client/src/api/auth.ts"]);
  });

  it("cartella vuota o radice = tutti i file", () => {
    expect(filesUnder(tree, "", 100)).toHaveLength(5);
    expect(filesUnder(tree, "/", 100)).toHaveLength(5);
  });

  it("oltre il tetto dice quanti ne restano", () => {
    expect(filesUnder(tree, "", 2)).toEqual(["package.json", "client/src/App.tsx", "… e altri 3 file: elenca una sottocartella"]);
  });
});
