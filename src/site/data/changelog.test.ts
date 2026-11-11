import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CHANGELOG_ENTRIES } from "./changelog";

// Collaudo 2026-11-10: il changelog del sito era rimasto al 15/07 mentre CHANGELOG.md andava
// avanti. Questo test lega le due cose: niente sezione nuova lì senza una voce qui.

const md = readFileSync(path.resolve(__dirname, "../../../CHANGELOG.md"), "utf8");

describe("changelog del sito", () => {
  it("la prima voce ha la data della sezione più recente di CHANGELOG.md", () => {
    const latest = md.match(/^### (\d{4}-\d{2}-\d{2})/m)?.[1];
    expect(latest).toBeDefined();
    expect(CHANGELOG_ENTRIES[0].date).toBe(latest);
  });

  it("le voci sono in ordine dalla più recente", () => {
    const dates = CHANGELOG_ENTRIES.map((e) => e.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });
});
