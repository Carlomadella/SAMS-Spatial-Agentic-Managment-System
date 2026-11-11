import { describe, expect, it } from "vitest";
import { claimDriver, DRIVER_TTL, isLeaseHolder, isLeaseValid, releaseDriver, type DriverLease } from "./driver";

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
    expect(lease).toEqual({ holderId: "a", name: "Anna", expiresAt: 1000 + DRIVER_TTL, holderKey: "" });
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

// Ultrareview 2026-11-11: l'id di una vista è pubblico (arriva a tutti con la presenza).
// Bastava rimandarlo per "rinnovare" il lease altrui e spingere il mondo al suo posto.
describe("lease legato a chi lo tiene", () => {
  it("un altro con lo stesso id non rinnova e non ruba il lease", () => {
    const { lease } = claimDriver(null, "v1", "Ada", 0, DRIVER_TTL, "u:ada");
    const r = claimDriver(lease, "v1", "Intruso", 100, DRIVER_TTL, "u:eve");
    expect(r.lease).toBe(lease);
    expect(r.changed).toBe(false);
  });

  it("il titolare rinnova col suo id e la sua identità", () => {
    const { lease } = claimDriver(null, "v1", "Ada", 0, DRIVER_TTL, "u:ada");
    const r = claimDriver(lease, "v1", "Ada", 100, DRIVER_TTL, "u:ada");
    expect(r.lease.expiresAt).toBe(100 + DRIVER_TTL);
    expect(r.lease.holderKey).toBe("u:ada");
  });

  it("isLeaseHolder vuole sia l'id sia l'identità", () => {
    const { lease } = claimDriver(null, "v1", "Ada", 0, DRIVER_TTL, "u:ada");
    expect(isLeaseHolder(lease, "v1", "u:ada", 10)).toBe(true);
    expect(isLeaseHolder(lease, "v1", "u:eve", 10)).toBe(false);
    expect(isLeaseHolder(lease, "v2", "u:ada", 10)).toBe(false);
    expect(isLeaseHolder(lease, "v1", "u:ada", DRIVER_TTL + 1)).toBe(false);
  });

  it("releaseDriver con l'identità sbagliata non rilascia", () => {
    const { lease } = claimDriver(null, "v1", "Ada", 0, DRIVER_TTL, "u:ada");
    expect(releaseDriver(lease, "v1", "u:eve")).toBe(lease);
    expect(releaseDriver(lease, "v1", "u:ada")).toBeNull();
  });
});
