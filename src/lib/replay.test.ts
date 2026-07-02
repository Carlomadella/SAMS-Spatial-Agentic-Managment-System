import { describe, expect, it } from "vitest";
import type { LogEvent } from "../types";
import {
  agentReplays,
  buildReplay,
  frameEmoji,
  frameIndexAt,
  formatOffset,
} from "./replay";

function ev(over: Partial<LogEvent> & { id: string; ts: number }): LogEvent {
  return {
    id: over.id,
    ts: over.ts,
    agentId: "a1",
    agentName: "blue",
    color: "blue",
    level: "INFO",
    message: "",
    ...over,
  };
}

describe("frameEmoji", () => {
  it("prefers keywords over level", () => {
    expect(frameEmoji({ level: "SUCCESS", message: "ha aperto una PR" })).toBe("🔀");
    expect(frameEmoji({ level: "INFO", message: "announce_plan: 3 passi" })).toBe("🧭");
    expect(frameEmoji({ level: "INFO", message: "relay a green" })).toBe("🤝");
  });

  it("falls back to a per-level emoji", () => {
    expect(frameEmoji({ level: "SUCCESS", message: "fatto" })).toBe("✅");
    expect(frameEmoji({ level: "ERROR", message: "boom" })).toBe("❌");
    expect(frameEmoji({ level: "WARN", message: "attento" })).toBe("⚠️");
    expect(frameEmoji({ level: "IDLE", message: "in pausa" })).toBe("😴");
    expect(frameEmoji({ level: "INFO", message: "ciao" })).toBe("💬");
  });
});

describe("buildReplay", () => {
  it("returns null for no events", () => {
    expect(buildReplay([])).toBeNull();
  });

  it("sorts by time and computes relative offsets", () => {
    const r = buildReplay([
      ev({ id: "b", ts: 5000, message: "secondo" }),
      ev({ id: "a", ts: 1000, message: "primo" }),
      ev({ id: "c", ts: 9000, message: "terzo" }),
    ])!;
    expect(r.frames.map((f) => f.id)).toEqual(["a", "b", "c"]);
    expect(r.frames.map((f) => f.tMs)).toEqual([0, 4000, 8000]);
    expect(r.startTs).toBe(1000);
    expect(r.endTs).toBe(9000);
    expect(r.durationMs).toBe(8000);
  });
});

describe("agentReplays", () => {
  it("groups by agent, drops agent-less noise, newest first", () => {
    const rs = agentReplays([
      ev({ id: "1", ts: 1000, agentId: "a1" }),
      ev({ id: "2", ts: 8000, agentId: "a2", agentName: "green" }),
      ev({ id: "3", ts: 2000, agentId: "a1" }),
      ev({ id: "4", ts: 3000, agentId: null, agentName: "system" }),
    ]);
    expect(rs).toHaveLength(2);
    expect(rs[0].agentId).toBe("a2"); // ends at 8000 → newest
    expect(rs[1].frames).toHaveLength(2);
  });
});

describe("frameIndexAt", () => {
  const frames = [{ tMs: 0 }, { tMs: 4000 }, { tMs: 8000 }];

  it("returns -1 before the first frame", () => {
    expect(frameIndexAt(frames, -1)).toBe(-1);
  });

  it("returns the last frame at or before the cursor", () => {
    expect(frameIndexAt(frames, 0)).toBe(0);
    expect(frameIndexAt(frames, 3999)).toBe(0);
    expect(frameIndexAt(frames, 4000)).toBe(1);
    expect(frameIndexAt(frames, 100000)).toBe(2);
  });
});

describe("formatOffset", () => {
  it("formats ms as m:ss, clamping negatives", () => {
    expect(formatOffset(0)).toBe("0:00");
    expect(formatOffset(5000)).toBe("0:05");
    expect(formatOffset(65000)).toBe("1:05");
    expect(formatOffset(-500)).toBe("0:00");
  });
});
