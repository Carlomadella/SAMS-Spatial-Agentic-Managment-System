import { describe, expect, it } from "vitest";
import { buildOutputLines } from "./output";
import type { LogEvent, LogLevel } from "../types";

let n = 0;
function ev(level: LogLevel, message: string, agentName = "blue-agent"): LogEvent {
  return { id: `e${n++}`, ts: 0, agentId: "agent-blue", agentName, color: "blue", level, message };
}

const READY = { backendOnline: true, runtimeReady: true, agentCount: 3 };

describe("buildOutputLines — header", () => {
  it("shows connected + slot count + ready when online", () => {
    const lines = buildOutputLines([], READY);
    expect(lines[0].text).toContain("connected");
    expect(lines[1].text).toContain("3 agent slots");
    expect(lines[2]).toMatchObject({ kind: "ok" });
    expect(lines[2].text).toContain("[ready]");
  });

  it("shows offline + waiting when not provisioned", () => {
    const lines = buildOutputLines([], { backendOnline: false, runtimeReady: false, agentCount: 1 });
    expect(lines[0].text).toContain("offline");
    expect(lines[1].text).toContain("1 agent slot"); // singular
    expect(lines[2]).toMatchObject({ kind: "warn" });
    expect(lines[2].text).toContain("[waiting]");
  });
});

describe("buildOutputLines — stream", () => {
  it("includes only SUCCESS / WARN / ERROR events, mapped to kinds", () => {
    const events = [
      ev("INFO", "started"),       // excluded
      ev("IDLE", "no tasks"),      // excluded
      ev("SUCCESS", "tests pass"),
      ev("WARN", "needs review"),
      ev("ERROR", "build failed"),
    ];
    const stream = buildOutputLines(events, READY).slice(3); // drop the 3 header lines
    expect(stream).toHaveLength(3);
    expect(stream.map((l) => l.kind)).toEqual(["ok", "warn", "err"]);
    expect(stream[0].text).toBe("[success] blue-agent: tests pass");
  });

  it("respects the stream limit (keeping the most recent)", () => {
    const events = Array.from({ length: 10 }, (_, i) => ev("SUCCESS", `msg ${i}`));
    const lines = buildOutputLines(events, READY, 4);
    const stream = lines.slice(3);
    expect(stream).toHaveLength(4);
    expect(stream[stream.length - 1].text).toContain("msg 9"); // newest kept
  });
});
