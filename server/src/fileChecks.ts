import { createRequire } from "node:module";

// Controlli che SAMS fa da sé sui file letti dagli agenti (simulazione del 22/11:
// Sim-Tester ha scritto «tutti i package.json sono JSON validi» dopo averli letti, ed era
// falso). Il giudizio del modello non basta: dove un controllo è certo e senza falsi
// allarmi, lo fa il server, e l'esito arriva sia all'agente sia a chi legge il riassunto.

/** File .json che per convenzione ammettono commenti e virgole finali (JSONC): non si controllano. */
function isJsonc(path: string): boolean {
  const p = path.toLowerCase();
  const name = p.slice(p.lastIndexOf("/") + 1);
  return (
    p.endsWith(".jsonc") ||
    /^(tsconfig|jsconfig)(\..+)?\.json$/.test(name) ||
    name === "devcontainer.json" ||
    p.startsWith(".vscode/") ||
    p.includes("/.vscode/")
  );
}

/** Riga e colonna (da 1) di una posizione nel testo. */
function lineCol(text: string, pos: number): { line: number; col: number } {
  const before = text.slice(0, Math.max(0, Math.min(pos, text.length)));
  const line = before.split("\n").length;
  return { line, col: pos - before.lastIndexOf("\n") };
}

function checkJson(text: string): string | null {
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text; // BOM iniziale
  try {
    JSON.parse(body);
    return null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const pos = /position (\d+)/.exec(msg);
    if (!pos) return "non è JSON valido";
    const { line, col } = lineCol(body, Number(pos[1]));
    return `non è JSON valido (riga ${line}, colonna ${col})`;
  }
}

// --- TypeScript / JavaScript (opzione B del doc di decisione del 22/11) -----------
// Due controlli certi, un file alla volta: errori di sintassi e nomi dichiarati due
// volte al primo livello del file (Sim-Tester: «nessun duplicato», ma roomService.ts
// aveva `const getRoomById` e `export function getRoomById`). Non vede import tra file,
// tipi o dipendenze: per quelli serve una build vera.

type TS = typeof import("typescript");
let tsModule: TS | null | undefined;

/** TypeScript caricato alla prima occorrenza (in memoria solo se serve); null se manca. */
function loadTs(): TS | null {
  if (tsModule === undefined) {
    try {
      tsModule = createRequire(import.meta.url)("typescript") as TS;
    } catch {
      tsModule = null;
    }
  }
  return tsModule;
}

const SCRIPT_EXT = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const MAX_PROBLEMS = 3;

function scriptKind(ts: TS, p: string): import("typescript").ScriptKind {
  if (p.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (/\.(ts|mts|cts)$/.test(p)) return ts.ScriptKind.TS;
  // nei .js si scrive spesso JSX (React): lo si accetta
  return p.endsWith(".jsx") ? ts.ScriptKind.JSX : ts.ScriptKind.JS;
}

function hasModifier(node: import("typescript").Node, ts: TS, kind: import("typescript").SyntaxKind): boolean {
  return (ts.canHaveModifiers(node) ? ts.getModifiers(node) ?? [] : []).some((m) => m.kind === kind);
}

/**
 * Nomi del livello più alto che finiscono nello spazio dei valori, con la riga. Solo i
 * casi che sono sempre un errore: let/const, class, import e funzioni con corpo. Restano
 * fuori le fusioni lecite (interface, namespace, enum, overload, var ripetuti) e le
 * dichiarazioni `declare`.
 */
function topLevelValueNames(ts: TS, sf: import("typescript").SourceFile): Array<{ name: string; line: number; kind: "var" | "other" }> {
  const out: Array<{ name: string; line: number; kind: "var" | "other" }> = [];
  const lineOf = (n: import("typescript").Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  for (const st of sf.statements) {
    if (hasModifier(st, ts, ts.SyntaxKind.DeclareKeyword)) continue;
    if (ts.isVariableStatement(st)) {
      const isVar = (st.declarationList.flags & (ts.NodeFlags.Let | ts.NodeFlags.Const)) === 0;
      for (const d of st.declarationList.declarations) {
        if (ts.isIdentifier(d.name)) out.push({ name: d.name.text, line: lineOf(d), kind: isVar ? "var" : "other" });
      }
    } else if (ts.isFunctionDeclaration(st) && st.name && st.body) {
      out.push({ name: st.name.text, line: lineOf(st), kind: "other" });
    } else if (ts.isClassDeclaration(st) && st.name) {
      out.push({ name: st.name.text, line: lineOf(st), kind: "other" });
    } else if (ts.isImportDeclaration(st) && st.importClause && !st.importClause.isTypeOnly) {
      const c = st.importClause;
      if (c.name) out.push({ name: c.name.text, line: lineOf(st), kind: "other" });
      const b = c.namedBindings;
      if (b && ts.isNamespaceImport(b)) out.push({ name: b.name.text, line: lineOf(st), kind: "other" });
      if (b && ts.isNamedImports(b)) {
        for (const el of b.elements) if (!el.isTypeOnly) out.push({ name: el.name.text, line: lineOf(st), kind: "other" });
      }
    }
  }
  return out;
}

function checkScript(path: string, text: string): string | null {
  const ts = loadTs();
  if (!ts) return null;
  const p = path.toLowerCase();
  const problems: string[] = [];

  const sf = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, scriptKind(ts, p));
  // diagnostica di sola sintassi, dall'API pubblica
  const syntax = ts.transpileModule(text, { fileName: path, reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.Preserve } }).diagnostics ?? [];
  for (const d of syntax) {
    const line = d.start != null ? sf.getLineAndCharacterOfPosition(d.start).line + 1 : null;
    const msg = ts.flattenDiagnosticMessageText(d.messageText, " ");
    problems.push(line ? `ha un errore di sintassi alla riga ${line}: ${msg}` : `ha un errore di sintassi: ${msg}`);
  }

  if (problems.length === 0) {
    const seen = new Map<string, { line: number; kind: "var" | "other" }>();
    for (const n of topLevelValueNames(ts, sf)) {
      const first = seen.get(n.name);
      if (!first) {
        seen.set(n.name, n);
      } else if (!(first.kind === "var" && n.kind === "var")) {
        problems.push(`dichiara due volte «${n.name}» (righe ${first.line} e ${n.line})`);
      }
    }
  }

  if (problems.length === 0) return null;
  const rest = problems.length - MAX_PROBLEMS;
  return problems.slice(0, MAX_PROBLEMS).join("; ") + (rest > 0 ? ` e altri ${rest}` : "");
}

/**
 * Il problema trovato da SAMS nel file, o null se non ce n'è (o se il tipo di file non
 * si controlla). Il testo è una frase da mettere dopo il nome del file.
 */
export function checkFile(path: string, text: string): string | null {
  const p = path.toLowerCase();
  if (p.endsWith(".json") && !isJsonc(p)) return checkJson(text);
  if (SCRIPT_EXT.test(p) && !/\.d\.(ts|mts|cts)$/.test(p)) return checkScript(path, text);
  return null;
}
