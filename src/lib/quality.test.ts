import { describe, it, expect } from "vitest";
import { gradeChanges } from "./quality";
import type { PendingFile } from "../types";

const file = (path: string, content = "riga", message = "msg"): PendingFile => ({ path, content, message });

describe("gradeChanges", () => {
  it("nessun file → voto D con motivo dedicato", () => {
    const r = gradeChanges([]);
    expect(r).toMatchObject({ grade: "D", score: 0, files: 0, hasTests: false });
    expect(r.reasons[0]).toMatch(/Nessun file/i);
  });

  it("codice + test + scope contenuto → voto alto (A)", () => {
    const r = gradeChanges([file("src/a.ts"), file("src/a.test.ts")]);
    expect(r.hasTests).toBe(true);
    expect(r.grade).toBe("A");
    expect(r.reasons).toContain("✓ Test inclusi");
  });

  it("codice senza test → penalità di 25", () => {
    const r = gradeChanges([file("src/a.ts")]);
    expect(r.score).toBe(75); // 100 - 25
    expect(r.grade).toBe("B");
    expect(r.reasons).toContain("− Codice senza test");
  });

  it("file senza messaggio → penalità per file", () => {
    const r = gradeChanges([file("src/a.ts", "x", ""), file("src/a.test.ts", "x", "")]);
    // ha i test (nessuna penalità test), ma 2 file senza messaggio → -20
    expect(r.score).toBe(80);
    expect(r.reasons.some((x) => /senza messaggio/.test(x))).toBe(true);
  });

  it("residui di debug abbassano il voto", () => {
    const clean = gradeChanges([file("src/a.ts"), file("src/a.test.ts")]).score;
    const dirty = gradeChanges([file("src/a.ts", "console.log(1)"), file("src/a.test.ts")]).score;
    expect(dirty).toBeLessThan(clean);
  });

  it("scope ampio (>8 file) penalizza; docs danno una nota positiva", () => {
    const many = Array.from({ length: 9 }, (_, i) => file(`src/f${i}.ts`, "x", "m"));
    many.push(file("README.md"));
    const r = gradeChanges(many);
    expect(r.reasons.some((x) => /Scope ampio/.test(x))).toBe(true);
    expect(r.reasons).toContain("✓ Documentazione aggiornata");
  });

  it("file molto grande (>400 righe) penalizza", () => {
    const big = "x\n".repeat(401);
    const r = gradeChanges([file("src/huge.ts", big), file("src/huge.test.ts")]);
    expect(r.reasons.some((x) => /molto grandi/.test(x))).toBe(true);
    expect(r.score).toBeLessThan(100);
  });

  it("il punteggio resta in 0..100 anche con molte penalità", () => {
    const bad = Array.from({ length: 10 }, (_, i) => file(`src/f${i}.ts`, "TODO console.log", ""));
    const r = gradeChanges(bad);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.grade).toBe("D");
  });
});
