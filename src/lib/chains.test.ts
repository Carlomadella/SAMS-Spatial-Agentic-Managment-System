import { describe, expect, it } from "vitest";
import { chainSummary, chainTitle, matchingChains, ruleMatches, type ChainRule } from "./chains";

function rule(over: Partial<ChainRule> & { id: string }): ChainRule {
  return {
    id: over.id,
    when: "",
    fromRole: "",
    target: "Reviewer",
    title: "Rivedi: {task}",
    branch: "",
    enabled: true,
    ...over,
  };
}

describe("chainTitle", () => {
  it("expands the {task} placeholder with the completed title", () => {
    expect(chainTitle({ title: "Rivedi: {task}" }, { title: "Aggiungi login" })).toBe(
      "Rivedi: Aggiungi login",
    );
  });

  it("expands every occurrence and trims", () => {
    expect(chainTitle({ title: "  {task} → test {task}  " }, { title: "X" })).toBe("X → test X");
  });

  it("leaves a title without a placeholder unchanged", () => {
    expect(chainTitle({ title: "Scrivi i test" }, { title: "Qualsiasi" })).toBe("Scrivi i test");
  });
});

describe("ruleMatches", () => {
  it("matches any completed task when `when` is empty", () => {
    expect(ruleMatches(rule({ id: "r" }), { title: "Qualcosa", role: "Dev" })).toBe(true);
  });

  it("respects the case-insensitive `when` substring filter", () => {
    const r = rule({ id: "r", when: "login" });
    expect(ruleMatches(r, { title: "Aggiungi LOGIN OAuth", role: "Dev" })).toBe(true);
    expect(ruleMatches(r, { title: "Aggiungi logout", role: "Dev" })).toBe(false);
  });

  it("respects the case-insensitive `fromRole` filter", () => {
    const r = rule({ id: "r", fromRole: "Backend" });
    expect(ruleMatches(r, { title: "X", role: "backend" })).toBe(true);
    expect(ruleMatches(r, { title: "X", role: "Frontend" })).toBe(false);
  });

  it("never fires when disabled, or without target/title", () => {
    expect(ruleMatches(rule({ id: "r", enabled: false }), { title: "X", role: "D" })).toBe(false);
    expect(ruleMatches(rule({ id: "r", target: "  " }), { title: "X", role: "D" })).toBe(false);
    expect(ruleMatches(rule({ id: "r", title: "  " }), { title: "X", role: "D" })).toBe(false);
  });

  it("guards against a direct self-loop (follow-up identical to the completed task)", () => {
    const r = rule({ id: "r", title: "{task}" });
    expect(ruleMatches(r, { title: "Deploy", role: "Ops" })).toBe(false);
  });
});

describe("matchingChains", () => {
  it("returns the matching rules preserving order", () => {
    const rules = [
      rule({ id: "a", when: "login" }),
      rule({ id: "b", when: "" }),
      rule({ id: "c", enabled: false }),
    ];
    expect(matchingChains(rules, { title: "Aggiungi login", role: "Dev" }).map((r) => r.id)).toEqual([
      "a",
      "b",
    ]);
    expect(matchingChains(rules, { title: "Fix bug", role: "Dev" }).map((r) => r.id)).toEqual(["b"]);
  });
});

describe("chainSummary", () => {
  it("reads as a human sentence", () => {
    expect(chainSummary({ when: "login", fromRole: "Backend", target: "QA" })).toBe(
      '"login" da Backend → QA',
    );
    expect(chainSummary({ when: "", fromRole: "", target: "Reviewer" })).toBe(
      "qualsiasi task → Reviewer",
    );
  });
});
