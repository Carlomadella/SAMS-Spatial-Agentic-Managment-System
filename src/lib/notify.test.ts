import { describe, expect, it } from "vitest";
import { notificationBody, notificationTitle, shouldNotify } from "./notify";

describe("shouldNotify", () => {
  it("notifies on SUCCESS and ERROR", () => {
    expect(shouldNotify({ level: "SUCCESS", message: "fatto" })).toBe(true);
    expect(shouldNotify({ level: "ERROR", message: "crash" })).toBe(true);
  });

  it("notifies on WARN only when it asks for attention", () => {
    expect(shouldNotify({ level: "WARN", message: "2 file pronti — approva o rifiuta" })).toBe(true);
    expect(shouldNotify({ level: "WARN", message: "Task bloccato dall'utente" })).toBe(true);
    expect(shouldNotify({ level: "WARN", message: "qualcosa di generico" })).toBe(false);
  });

  it("stays quiet on INFO and IDLE", () => {
    expect(shouldNotify({ level: "INFO", message: "sto lavorando" })).toBe(false);
    expect(shouldNotify({ level: "IDLE", message: "in pausa" })).toBe(false);
  });

  it("is case-insensitive on the attention hints", () => {
    expect(shouldNotify({ level: "WARN", message: "FILE PRONTI" })).toBe(true);
  });
});

describe("notificationTitle", () => {
  it("uses the agent name when present", () => {
    expect(notificationTitle({ agentName: "blue-agent" })).toBe("blue-agent");
  });
  it("falls back to SAMS", () => {
    expect(notificationTitle({ agentName: "" })).toBe("SAMS");
    expect(notificationTitle({})).toBe("SAMS");
  });
});

describe("notificationBody", () => {
  it("trims and passes short messages through", () => {
    expect(notificationBody({ message: "  ciao  " })).toBe("ciao");
  });
  it("truncates long messages with an ellipsis", () => {
    const long = "a".repeat(200);
    const out = notificationBody({ message: long }, 20);
    expect(out).toHaveLength(20);
    expect(out.endsWith("…")).toBe(true);
  });
});
