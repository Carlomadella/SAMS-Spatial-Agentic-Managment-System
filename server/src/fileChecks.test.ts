import { describe, expect, it } from "vitest";
import { checkFile } from "./fileChecks";

describe("checkFile — JSON (simulazione 22/11: «package.json valido» ed era falso)", () => {
  it("package.json con virgolette non escapate: errore con riga e colonna", () => {
    const text = '{\n  "name": "x",\n  "scripts": {\n    "dev": "concurrently "npm run a" "npm run b""\n  }\n}\n';
    const err = checkFile("package.json", text);
    expect(err).toMatch(/^non è JSON valido \(riga 4, colonna \d+\)/);
  });

  it("JSON valido: nessun errore", () => {
    expect(checkFile("server/package.json", '{ "a": [1, 2] }')).toBeNull();
  });

  it("file JSON vuoto: errore", () => {
    expect(checkFile("data.json", "  \n")).toMatch(/non è JSON valido/);
  });

  it("BOM iniziale accettato (npm lo tollera)", () => {
    expect(checkFile("package.json", '﻿{"a":1}')).toBeNull();
  });

  it("file JSON con commenti per convenzione (tsconfig, jsconfig, .jsonc, .vscode) non si controllano", () => {
    const withComments = '{\n  // commento\n  "compilerOptions": {},\n}';
    expect(checkFile("tsconfig.json", withComments)).toBeNull();
    expect(checkFile("client/tsconfig.app.json", withComments)).toBeNull();
    expect(checkFile("jsconfig.json", withComments)).toBeNull();
    expect(checkFile("x/settings.jsonc", withComments)).toBeNull();
    expect(checkFile(".vscode/settings.json", withComments)).toBeNull();
    expect(checkFile(".devcontainer/devcontainer.json", withComments)).toBeNull();
  });

  it("altri tipi di file: nessun controllo", () => {
    expect(checkFile("README.md", "{ non json")).toBeNull();
    expect(checkFile("PACKAGE.JSON", "{ non json")).toMatch(/non è JSON valido/);
  });
});
