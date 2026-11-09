import { afterEach, describe, expect, it, vi } from "vitest";
import { storageGet, storageRemove, storageSet } from "./safeStorage";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("safeStorage", () => {
  it("legge, scrive e rimuove come localStorage", () => {
    storageSet("k", "v");
    expect(storageGet("k")).toBe("v");
    storageRemove("k");
    expect(storageGet("k")).toBeNull();
  });

  it("non lancia se lo storage è bloccato (SecurityError)", () => {
    const boom = () => {
      throw new DOMException("blocked", "SecurityError");
    };
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(boom);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(boom);
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(boom);
    expect(storageGet("k")).toBeNull();
    expect(() => storageSet("k", "v")).not.toThrow();
    expect(() => storageRemove("k")).not.toThrow();
  });
});
