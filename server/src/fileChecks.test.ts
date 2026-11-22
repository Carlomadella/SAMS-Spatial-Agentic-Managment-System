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

describe("checkFile — TypeScript e JavaScript (simulazione 22/11: getRoomById dichiarato due volte)", () => {
  it("const e function con lo stesso nome: nome e righe", () => {
    const text = [
      "import { db } from '../db'",
      "",
      "const getRoomById = db.prepare('SELECT * FROM rooms WHERE id = ?')",
      "",
      "export function getRoomById(roomId: number) {",
      "  return getRoomById.get(roomId)",
      "}",
    ].join("\n");
    expect(checkFile("server/src/services/roomService.ts", text)).toBe("dichiara due volte «getRoomById» (righe 3 e 5)");
  });

  it("errore di sintassi: la riga", () => {
    const err = checkFile("client/src/App.tsx", "export function App() {\n  return <div>ciao</div\n}\n");
    expect(err).toMatch(/^ha un errore di sintassi alla riga \d+/);
  });

  it("codice valido, anche con le fusioni lecite: nessun errore", () => {
    const text = [
      "import type { Room } from './types'",
      "export interface Options { a: number }",
      "export interface Options { b: number }",
      "export function load(id: number): Room",
      "export function load(id: string): Room",
      "export function load(id: unknown): Room { return id as Room }",
      "export class Store {}",
      "export namespace Store { export const x = 1 }",
      "enum Color { Red }",
      "enum Color { Blue = 1 }",
      "var legacy = 1",
      "var legacy = 2",
      "declare const ambient: number",
      "export default function () {}",
    ].join("\n");
    expect(checkFile("server/src/x.ts", text)).toBeNull();
  });

  it("JavaScript con JSX: valido", () => {
    expect(checkFile("client/src/main.jsx", "const App = () => <p>ciao</p>\nexport default App\n")).toBeNull();
  });

  it("import e dichiarazione locale con lo stesso nome", () => {
    const text = "import { readFile } from 'node:fs'\nexport async function readFile() {}\n";
    expect(checkFile("src/a.mjs", text)).toBe("dichiara due volte «readFile» (righe 1 e 2)");
  });

  it("file di dichiarazioni (.d.ts): nessun controllo", () => {
    expect(checkFile("src/types.d.ts", "declare const a: number\ndeclare const a: string\n")).toBeNull();
  });

  it("più problemi: al massimo tre, separati da punto e virgola", () => {
    const text = "const a = 1\nconst a = 2\nconst b = 1\nlet b = 2\nconst c = 1\nclass c {}\nconst d = 1\nconst d = 2\n";
    const err = checkFile("x.ts", text) ?? "";
    expect(err.split("; ")).toHaveLength(3);
    expect(err).toContain("e altri 1");
  });
});
