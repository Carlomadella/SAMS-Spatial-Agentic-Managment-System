import { describe, expect, it } from "vitest";
import { groupByAttempt, pendingComments, statusLabel, type TaskComment, type TaskEvent } from "./tasks";

const ev = (seq: number, attempt: number, kind: TaskEvent["kind"] = "log"): TaskEvent => ({ seq, attempt, ts: seq, kind, level: "INFO", message: `e${seq}`, data: null });
const cm = (id: string, deliveredAttempt: number | null): TaskComment => ({ id, author: "Anna", text: id, ts: 0, deliveredAttempt });

describe("scheda del task", () => {
  it("cronologia divisa per tentativo, con i commenti ricevuti", () => {
    const g = groupByAttempt({ events: [ev(1, 1, "attempt"), ev(2, 1), ev(3, 2, "attempt"), ev(4, 2)], comments: [cm("c1", 2), cm("c2", null)] });
    expect(g.map((x) => [x.attempt, x.events.length, x.comments.map((c) => c.id)])).toEqual([
      [1, 2, []],
      [2, 2, ["c1"]],
    ]);
  });

  it("commenti in attesa del prossimo tentativo", () => {
    expect(pendingComments({ comments: [cm("a", 1), cm("b", null)] }).map((c) => c.id)).toEqual(["b"]);
  });

  it("etichette degli stati", () => {
    expect(statusLabel("blocked")).toBe("bloccato");
    expect(statusLabel("strano")).toBe("strano");
  });
});
