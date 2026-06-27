import { describe, expect, it } from "vitest";
import { diffStat, lineDiff } from "./diff";

describe("lineDiff", () => {
  it("marks identical text as all context", () => {
    const ops = lineDiff("a\nb\nc", "a\nb\nc");
    expect(ops.every((o) => o.type === "ctx")).toBe(true);
    expect(diffStat(ops)).toEqual({ added: 0, removed: 0 });
  });

  it("treats a brand-new file as all additions", () => {
    const ops = lineDiff("", "x\ny");
    expect(ops.map((o) => o.type)).toEqual(["add", "add"]);
    expect(diffStat(ops)).toEqual({ added: 2, removed: 0 });
  });

  it("treats an emptied file as all deletions", () => {
    const ops = lineDiff("x\ny", "");
    expect(ops.map((o) => o.type)).toEqual(["del", "del"]);
    expect(diffStat(ops)).toEqual({ added: 0, removed: 2 });
  });

  it("captures a changed middle line as a del + add around shared context", () => {
    const ops = lineDiff("a\nb\nc", "a\nB\nc");
    expect(ops).toEqual([
      { type: "ctx", text: "a" },
      { type: "del", text: "b" },
      { type: "add", text: "B" },
      { type: "ctx", text: "c" },
    ]);
    expect(diffStat(ops)).toEqual({ added: 1, removed: 1 });
  });

  it("handles a pure insertion in the middle", () => {
    const ops = lineDiff("a\nc", "a\nb\nc");
    expect(diffStat(ops)).toEqual({ added: 1, removed: 0 });
    expect(ops.find((o) => o.type === "add")?.text).toBe("b");
  });
});
