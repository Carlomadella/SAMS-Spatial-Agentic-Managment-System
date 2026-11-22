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

/**
 * Il problema trovato da SAMS nel file, o null se non ce n'è (o se il tipo di file non
 * si controlla). Il testo è una frase da mettere dopo il nome del file.
 */
export function checkFile(path: string, text: string): string | null {
  const p = path.toLowerCase();
  if (p.endsWith(".json") && !isJsonc(p)) return checkJson(text);
  return null;
}
