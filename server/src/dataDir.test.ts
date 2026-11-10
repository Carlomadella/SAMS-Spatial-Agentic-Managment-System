import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { dataFile, resolveDataDir } from "./dataDir";

describe("resolveDataDir", () => {
  const cwd = path.resolve("/srv/sams/server");

  it("senza SAMS_DATA_DIR usa la cartella di lavoro (come prima)", () => {
    expect(resolveDataDir({}, cwd)).toBe(cwd);
    expect(resolveDataDir({ SAMS_DATA_DIR: "   " }, cwd)).toBe(cwd);
  });

  it("un percorso assoluto resta quello", () => {
    const abs = path.resolve("/var/data");
    expect(resolveDataDir({ SAMS_DATA_DIR: abs }, cwd)).toBe(abs);
  });

  it("un percorso relativo si risolve rispetto alla cartella di lavoro", () => {
    expect(resolveDataDir({ SAMS_DATA_DIR: "data" }, cwd)).toBe(path.join(cwd, "data"));
  });
});

describe("dataFile", () => {
  it("crea la cartella se manca e ritorna il percorso del file dentro", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "sams-data-"));
    const dir = path.join(root, "nested", "data");
    const file = dataFile("x.db", { SAMS_DATA_DIR: dir }, root);
    expect(file).toBe(path.join(dir, "x.db"));
    expect(fs.statSync(dir).isDirectory()).toBe(true);
    fs.rmSync(root, { recursive: true, force: true });
  });
});
