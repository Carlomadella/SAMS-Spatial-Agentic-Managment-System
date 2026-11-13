import { describe, expect, it } from "vitest";
import {
  authorizeUrl,
  callbackUrl,
  decryptToken,
  encryptToken,
  githubOAuthConfig,
  isValidBranchName,
  isValidRepoName,
  OAuthStates,
  oauthCookie,
  readOauthCookie,
} from "./githubAccounts";

describe("githubOAuthConfig", () => {
  it("è spento se manca anche una sola variabile", () => {
    expect(githubOAuthConfig({})).toBeNull();
    expect(githubOAuthConfig({ GITHUB_CLIENT_ID: "id", GITHUB_CLIENT_SECRET: "sec" })).toBeNull();
    expect(githubOAuthConfig({ GITHUB_CLIENT_ID: "id", SAMS_SECRET_KEY: "k" })).toBeNull();
    expect(githubOAuthConfig({ GITHUB_CLIENT_ID: " ", GITHUB_CLIENT_SECRET: "sec", SAMS_SECRET_KEY: "k" })).toBeNull();
  });
  it("è acceso con le tre variabili", () => {
    expect(githubOAuthConfig({ GITHUB_CLIENT_ID: " id ", GITHUB_CLIENT_SECRET: "sec", SAMS_SECRET_KEY: "k" })).toEqual({
      clientId: "id",
      clientSecret: "sec",
      secretKey: "k",
    });
  });
});

describe("cifratura del token", () => {
  it("andata e ritorno con la stessa chiave", () => {
    const enc = encryptToken("gho_segreto", "chiave-1");
    expect(enc.startsWith("v1:")).toBe(true);
    expect(enc).not.toContain("gho_segreto");
    expect(decryptToken(enc, "chiave-1")).toBe("gho_segreto");
  });
  it("ogni cifratura è diversa (iv casuale)", () => {
    expect(encryptToken("t", "k")).not.toBe(encryptToken("t", "k"));
  });
  it("con un'altra chiave o un testo manomesso non decifra", () => {
    const enc = encryptToken("gho_segreto", "chiave-1");
    expect(decryptToken(enc, "chiave-2")).toBeNull();
    const raw = Buffer.from(enc.slice(3), "base64");
    raw[raw.length - 1] ^= 1;
    expect(decryptToken("v1:" + raw.toString("base64"), "chiave-1")).toBeNull();
    expect(decryptToken("gho_in_chiaro", "chiave-1")).toBeNull();
    expect(decryptToken("v1:", "chiave-1")).toBeNull();
  });
});

describe("OAuthStates", () => {
  it("lega lo state all'utente e al browser, una volta sola", () => {
    const st = new OAuthStates();
    const { state, nonce } = st.create("u1", 1000);
    expect(st.consume(state, nonce, 2000)).toBe("u1");
    expect(st.consume(state, nonce, 2000)).toBeNull();
  });
  it("da un altro browser (nonce diverso o assente) non vale, e lo state si brucia", () => {
    const st = new OAuthStates();
    const { state, nonce } = st.create("u1", 1000);
    expect(st.consume(state, "nonce-di-un-altro", 2000)).toBeNull();
    expect(st.consume(state, nonce, 2000)).toBeNull();
    const second = st.create("u1", 1000);
    expect(st.consume(second.state, "", 2000)).toBeNull();
  });
  it("scade", () => {
    const st = new OAuthStates(100);
    const { state, nonce } = st.create("u1", 1000);
    expect(st.consume(state, nonce, 1100)).toBeNull();
  });
  it("uno state inventato non vale", () => {
    expect(new OAuthStates().consume("inventato", "x")).toBeNull();
  });
  it("rispetta il tetto togliendo il più vecchio", () => {
    const st = new OAuthStates(60_000, 2);
    const a = st.create("a", 0);
    const b = st.create("b", 0);
    const c = st.create("c", 0);
    expect(st.consume(a.state, a.nonce, 1)).toBeNull();
    expect(st.consume(b.state, b.nonce, 1)).toBe("b");
    expect(st.consume(c.state, c.nonce, 1)).toBe("c");
  });
});

describe("cookie del giro OAuth", () => {
  it("HttpOnly, SameSite=Lax, solo su /api/github; Secure in https", () => {
    expect(oauthCookie("abc", true)).toBe("sams_gh_oauth=abc; Path=/api/github; HttpOnly; SameSite=Lax; Max-Age=600; Secure");
    expect(oauthCookie("", false, 0)).toBe("sams_gh_oauth=; Path=/api/github; HttpOnly; SameSite=Lax; Max-Age=0");
  });
  it("si rilegge dall'header Cookie", () => {
    expect(readOauthCookie("a=1; sams_gh_oauth=xyz; b=2")).toBe("xyz");
    expect(readOauthCookie("a=1")).toBe("");
    expect(readOauthCookie(undefined)).toBe("");
  });
});

describe("indirizzi OAuth", () => {
  it("authorizeUrl porta client, callback, scope e state", () => {
    const u = new URL(authorizeUrl("cid", "https://sams.example/api/github/callback", "st4te"));
    expect(u.origin + u.pathname).toBe("https://github.com/login/oauth/authorize");
    expect(u.searchParams.get("client_id")).toBe("cid");
    expect(u.searchParams.get("redirect_uri")).toBe("https://sams.example/api/github/callback");
    expect(u.searchParams.get("scope")).toBe("repo");
    expect(u.searchParams.get("state")).toBe("st4te");
  });
  it("callbackUrl", () => {
    expect(callbackUrl("https://sams.example")).toBe("https://sams.example/api/github/callback");
  });
});

describe("validazione", () => {
  it("repo owner/repo", () => {
    expect(isValidRepoName("Carlomadella/gioco-rap")).toBe(true);
    expect(isValidRepoName("solo-nome")).toBe(false);
    expect(isValidRepoName("a/b/c")).toBe(false);
    expect(isValidRepoName("a/b c")).toBe(false);
    expect(isValidRepoName(42)).toBe(false);
  });
  it("branch", () => {
    expect(isValidBranchName("main")).toBe(true);
    expect(isValidBranchName("release/1.0")).toBe(true);
    expect(isValidBranchName("")).toBe(false);
    expect(isValidBranchName("a..b")).toBe(false);
    expect(isValidBranchName("con spazio")).toBe(false);
    expect(isValidBranchName("/inizio")).toBe(false);
  });
});
