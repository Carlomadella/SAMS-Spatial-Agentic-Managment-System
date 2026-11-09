import { describe, expect, it } from "vitest";
import { blockedUrlReason, isPrivateAddress } from "./netGuard";

const publicDns = async () => [{ address: "93.184.216.34" }];

describe("isPrivateAddress", () => {
  it("riconosce loopback, reti private, link-local e metadata cloud", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "0.0.0.0", "100.64.0.1", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });

  it("non si fa aggirare dalle forme equivalenti di IPv4 dentro IPv6", () => {
    for (const ip of [
      "::ffff:7f00:1", // come new URL normalizza [::ffff:127.0.0.1]
      "::ffff:a9fe:a9fe", // 169.254.169.254
      "0:0:0:0:0:ffff:127.0.0.1",
      "::7f00:1", // IPv4-compatibile
      "64:ff9b::a9fe:a9fe", // NAT64 verso il metadata
      "2002:7f00:1::", // 6to4 di 127.0.0.1
      "::",
      "FE80::1",
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    expect(isPrivateAddress("::ffff:5db8:d822")).toBe(false); // 93.184.216.34
  });

  it("lascia passare gli indirizzi pubblici", () => {
    for (const ip of ["93.184.216.34", "8.8.8.8", "172.32.0.1", "2606:4700::1111"]) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });

  it("rifiuta ciò che non è un IP", () => {
    expect(isPrivateAddress("not-an-ip")).toBe(true);
  });
});

describe("blockedUrlReason", () => {
  it("accetta un host pubblico", async () => {
    expect(await blockedUrlReason("https://example.com/x", publicDns)).toBeNull();
  });

  it("rifiuta localhost e IP privati scritti nell'URL, senza interrogare il DNS", async () => {
    const neverCalled = async () => {
      throw new Error("DNS non doveva essere chiamato");
    };
    expect(await blockedUrlReason("http://localhost:8787/api/status", neverCalled)).toMatch(/interno/);
    expect(await blockedUrlReason("http://169.254.169.254/latest/meta-data", neverCalled)).toMatch(/interno/);
    expect(await blockedUrlReason("http://[::1]/", neverCalled)).toMatch(/interno/);
    expect(await blockedUrlReason("http://[::ffff:127.0.0.1]:8787/", neverCalled)).toMatch(/interno/);
  });

  it("rifiuta un nome che risolve (anche solo in parte) a un indirizzo privato", async () => {
    const mixed = async () => [{ address: "93.184.216.34" }, { address: "10.0.0.5" }];
    expect(await blockedUrlReason("https://rebind.example", mixed)).toMatch(/interno/);
  });

  it("rifiuta protocolli diversi da http(s) e host non risolvibili", async () => {
    expect(await blockedUrlReason("ftp://example.com", publicDns)).toMatch(/URL non valida/);
    expect(await blockedUrlReason("file:///etc/passwd", publicDns)).toMatch(/URL non valida/);
    const nx = async () => {
      throw new Error("ENOTFOUND");
    };
    expect(await blockedUrlReason("https://nope.invalid", nx)).toMatch(/non risolvibile/);
  });
});
