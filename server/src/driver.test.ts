import { describe, expect, it } from "vitest";
import { claimDriver, DRIVER_TTL, isLeaseValid, releaseDriver, type DriverLease } from "./driver";

describe("isLeaseValid", () => {
  it("is false for null and for an expired lease", () => {
    expect(isLeaseValid(null, 100)).toBe(false);
    expect(isLeaseValid({ holderId: "a", name: "A", expiresAt: 100 }, 100)).toBe(false);
    expect(isLeaseValid({ holderId: "a", name: "A", expiresAt: 200 }, 100)).toBe(true);
  });
});

describe("claimDriver", () => {
  it("grants the lease when there's no holder", () => {
    const { lease, changed } = claimDriver(null, "a", "Anna", 1000);
    expect(lease).toEqual({ holderId: "a", name: "Anna", expiresAt: 1000 + DRIVER_TTL });
    expect(changed).toBe(true);
  });

  it("lets the current holder renew without a 'changed' flag", () => {
    const cur: DriverLease = { holderId: "a", name: "Anna", expiresAt: 1000 + DRIVER_TTL };
    const { lease, changed } = claimDriver(cur, "a", "Anna", 2000);
    expect(lease.expiresAt).toBe(2000 + DRIVER_TTL);
    expect(changed).toBe(false);
  });

  it("marks changed when the holder renews with a new name", () => {
    const cur: DriverLease = { holderId: "a", name: "Anna", expiresAt: 1000 + DRIVER_TTL };
    const { lease, changed } = claimDriver(cur, "a", "Anna II", 2000);
    expect(lease.name).toBe("Anna II");
    expect(changed).toBe(true);
  });

  it("refuses a claim while someone else holds a valid lease", () => {
    const cur: DriverLease = { holderId: "a", name: "Anna", expiresAt: 5000 };
    const { lease, changed } = claimDriver(cur, "b", "Bruno", 1000);
    expect(lease.holderId).toBe("a");
    expect(changed).toBe(false);
  });

  it("hands over to a new claimant once the old lease has expired", () => {
    const cur: DriverLease = { holderId: "a", name: "Anna", expiresAt: 1000 };
    const { lease, changed } = claimDriver(cur, "b", "Bruno", 2000);
    expect(lease.holderId).toBe("b");
    expect(changed).toBe(true);
  });
});

describe("releaseDriver", () => {
  it("clears the lease only for the current holder", () => {
    const cur: DriverLease = { holderId: "a", name: "Anna", expiresAt: 5000 };
    expect(releaseDriver(cur, "a")).toBeNull();
    expect(releaseDriver(cur, "b")).toBe(cur);
    expect(releaseDriver(null, "a")).toBeNull();
  });
});
