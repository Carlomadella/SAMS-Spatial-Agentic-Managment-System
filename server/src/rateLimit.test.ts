import { describe, expect, it } from "vitest";
import { createRateLimiter, identityKey } from "./rateLimit";

describe("identityKey", () => {
  it("individua per token quando presente", () => {
    expect(identityKey("secret", "1.2.3.4")).toBe("t:secret");
    expect(identityKey("  secret  ", undefined)).toBe("t:secret");
  });
  it("ricade sull'IP senza token", () => {
    expect(identityKey("", "1.2.3.4")).toBe("ip:1.2.3.4");
  });
  it("chiave anonima senza token né IP", () => {
    expect(identityKey("", "")).toBe("anon");
    expect(identityKey("", null)).toBe("anon");
  });
});

describe("createRateLimiter", () => {
  it("allows up to `max` hits inside the window, then blocks", () => {
    const rl = createRateLimiter(3, 1000);
    expect(rl.hit("a", 0)).toBe(true);
    expect(rl.hit("a", 100)).toBe(true);
    expect(rl.hit("a", 200)).toBe(true);
    expect(rl.hit("a", 300)).toBe(false);
  });

  it("keeps keys independent", () => {
    const rl = createRateLimiter(1, 1000);
    expect(rl.hit("a", 0)).toBe(true);
    expect(rl.hit("b", 0)).toBe(true);
    expect(rl.hit("a", 0)).toBe(false);
  });

  it("frees a slot once the oldest hit leaves the window", () => {
    const rl = createRateLimiter(2, 1000);
    expect(rl.hit("a", 0)).toBe(true);
    expect(rl.hit("a", 500)).toBe(true);
    expect(rl.hit("a", 900)).toBe(false); // window still full
    expect(rl.hit("a", 1001)).toBe(true); // t=0 hit expired
  });

  it("reports how long to wait before the next slot", () => {
    const rl = createRateLimiter(2, 1000);
    rl.hit("a", 0);
    rl.hit("a", 200);
    expect(rl.retryAfterMs("a", 200)).toBe(800); // wait for the t=0 hit to expire
    expect(rl.retryAfterMs("a", 1001)).toBe(0); // free again
  });

  it("returns 0 wait when under the limit", () => {
    const rl = createRateLimiter(5, 1000);
    rl.hit("a", 0);
    expect(rl.retryAfterMs("a", 100)).toBe(0);
  });
});
