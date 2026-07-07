import type { PendingFile } from "../types";

// Voto di qualità *prima della PR*: dato l'insieme di file in staging di un
// agente (le modifiche in attesa di approvazione), calcola un voto A–D con i
// motivi che lo spingono su o giù. È un'euristica leggera e locale — nello
// spirito del gate CI, ma senza rete: gira sui `PendingFile` già presenti nello
// store e aiuta l'utente a decidere se approvare. Logica pura e testabile.

export type QualityGrade = "A" | "B" | "C" | "D";

export interface QualityReport {
  grade: QualityGrade;
  /** Punteggio 0..100 da cui deriva il voto. */
  score: number;
  files: number;
  hasTests: boolean;
  /** Motivi in linguaggio naturale: `✓` positivo, `−` negativo. */
  reasons: string[];
}

const TEST_RE = /\.(test|spec)\.[jt]sx?$/i;
const DOC_RE = /\.mdx?$/i;
const CODE_RE = /\.[jt]sx?$/i;
// Residui che di solito non dovrebbero finire in una PR.
const SMELLS = ["TODO", "FIXME", "console.log", "debugger"];

function lineCount(text: string): number {
  return text.length === 0 ? 0 : text.split("\n").length;
}

/**
 * Valuta un insieme di modifiche in staging. Euristiche:
 * - codice senza test → penalità (test presenti → nota positiva);
 * - file senza messaggio di commit → penalità per file;
 * - residui di debug (TODO/FIXME/console.log/debugger) → penalità;
 * - file molto grandi (>400 righe) o scope ampio (>8 file) → penalità;
 * - scope contenuto (≤4 file) o docs aggiornate → nota positiva.
 */
export function gradeChanges(files: PendingFile[]): QualityReport {
  const n = files.length;
  if (n === 0) {
    return { grade: "D", score: 0, files: 0, hasTests: false, reasons: ["Nessun file in staging"] };
  }

  const hasTests = files.some((f) => TEST_RE.test(f.path));
  const hasDocs = files.some((f) => DOC_RE.test(f.path));
  const codeFiles = files.filter((f) => CODE_RE.test(f.path) && !TEST_RE.test(f.path));
  const missingMsg = files.filter((f) => f.message.trim().length === 0).length;
  const smellFiles = files.filter((f) => SMELLS.some((s) => f.content.includes(s)));
  const bigFiles = files.filter((f) => lineCount(f.content) > 400);

  let score = 100;
  const reasons: string[] = [];

  if (hasTests) {
    reasons.push("✓ Test inclusi");
  } else if (codeFiles.length > 0) {
    score -= 25;
    reasons.push("− Codice senza test");
  }
  if (hasDocs) reasons.push("✓ Documentazione aggiornata");
  if (missingMsg > 0) {
    score -= 10 * missingMsg;
    reasons.push(`− ${missingMsg} file senza messaggio`);
  }
  if (smellFiles.length > 0) {
    score -= 8 * smellFiles.length;
    reasons.push(`− Residui di debug (${smellFiles.length})`);
  }
  if (bigFiles.length > 0) {
    score -= 12 * bigFiles.length;
    reasons.push(`− File molto grandi (${bigFiles.length})`);
  }
  if (n > 8) {
    score -= 15;
    reasons.push(`− Scope ampio (${n} file)`);
  } else if (n <= 4) {
    reasons.push("✓ Scope contenuto");
  }

  score = Math.max(0, Math.min(100, score));
  const grade: QualityGrade = score >= 85 ? "A" : score >= 70 ? "B" : score >= 50 ? "C" : "D";
  return { grade, score, files: n, hasTests, reasons };
}
