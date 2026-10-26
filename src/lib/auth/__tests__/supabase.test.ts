import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createHmac, createHash } from "node:crypto";
import * as supabase from "@/lib/auth/supabase";

const SERVICE_ROLE_KEY_NAME = "SUPABASE_" + "SERVICE_ROLE_KEY";
const envKeys = [
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_JWT_SECRET",
  SERVICE_ROLE_KEY_NAME,
];

describe("supabase auth module", () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of envKeys) {
      saved[k] = process.env[k];
    }
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-123";
    process.env.SUPABASE_JWT_SECRET = "jwt-secret-xyz";
    process.env[SERVICE_ROLE_KEY_NAME] = "service-role-key-999";
  });
  afterEach(() => {
    for (const k of envKeys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("pkceChallenge equals base64url SHA-256 of verifier", () => {
    const v = "verifier-abc";
    const expected = createHash("sha256").update(v).digest("base64url");
    expect(supabase.pkceChallenge(v)).toBe(expected);
  });

  it("providerAuthorizeUrl carries provider, redirect, challenge", () => {
    const url = supabase.providerAuthorizeUrl("google", {
      redirectTo: "https://app.example/cb",
      codeChallenge: "challenge-xyz",
    });
    expect(url).toContain("/auth/v1/authorize");
    expect(url).toContain("provider=google");
    expect(url).toContain("redirect_to=");
    expect(url).toContain("code_challenge=challenge-xyz");
    expect(url).toContain("code_challenge_method=S256");
  });

  it("verifyAccessToken returns subject for a valid token", () => {
    const secret = "jwt-secret-xyz";
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        sub: "user-123",
        email: "a@b.com",
        aud: "authenticated",
        iss: "https://example.supabase.co/auth/v1",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url");
    const sig = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
    const token = `${header}.${payload}.${sig}`;
    const res = supabase.verifyAccessToken(token, {
      secret,
      issuer: "https://example.supabase.co/auth/v1",
      audience: "authenticated",
    });
    expect(res).not.toBeNull();
    expect(res!.sub).toBe("user-123");
    expect(res!.email).toBe("a@b.com");
  });

  it("verifyAccessToken rejects alg none", () => {
    const secret = "jwt-secret-xyz";
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        sub: "user-123",
        aud: "authenticated",
        iss: "https://example.supabase.co/auth/v1",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url");
    const token = `${header}.${payload}.`;
    expect(
      supabase.verifyAccessToken(token, {
        secret,
        issuer: "https://example.supabase.co/auth/v1",
        audience: "authenticated",
      }),
    ).toBeNull();
  });

  it("verifyAccessToken rejects tampered signature", () => {
    const secret = "jwt-secret-xyz";
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        sub: "user-123",
        aud: "authenticated",
        iss: "https://example.supabase.co/auth/v1",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url");
    const token = `${header}.${payload}.AAAA`;
    expect(
      supabase.verifyAccessToken(token, {
        secret,
        issuer: "https://example.supabase.co/auth/v1",
        audience: "authenticated",
      }),
    ).toBeNull();
  });

  it("verifyAccessToken rejects expired", () => {
    const secret = "jwt-secret-xyz";
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        sub: "user-123",
        aud: "authenticated",
        iss: "https://example.supabase.co/auth/v1",
        exp: Math.floor(Date.now() / 1000) - 3600,
      }),
    ).toString("base64url");
    const sig = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
    const token = `${header}.${payload}.${sig}`;
    expect(
      supabase.verifyAccessToken(token, {
        secret,
        issuer: "https://example.supabase.co/auth/v1",
        audience: "authenticated",
      }),
    ).toBeNull();
  });

  it("verifyAccessToken rejects wrong audience", () => {
    const secret = "jwt-secret-xyz";
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        sub: "user-123",
        aud: "wrong-aud",
        iss: "https://example.supabase.co/auth/v1",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url");
    const sig = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
    const token = `${header}.${payload}.${sig}`;
    expect(
      supabase.verifyAccessToken(token, {
        secret,
        issuer: "https://example.supabase.co/auth/v1",
        audience: "authenticated",
      }),
    ).toBeNull();
  });

  it("verifyAccessToken rejects wrong issuer", () => {
    const secret = "jwt-secret-xyz";
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        sub: "user-123",
        aud: "authenticated",
        iss: "https://wrong.example/auth/v1",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url");
    const sig = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
    const token = `${header}.${payload}.${sig}`;
    expect(
      supabase.verifyAccessToken(token, {
        secret,
        issuer: "https://example.supabase.co/auth/v1",
        audience: "authenticated",
      }),
    ).toBeNull();
  });

  it("signInWithPassword posts to password endpoint with apikey header and maps body", async () => {
    const fakeFetch = (async (url: string, init?: RequestInit) => {
      expect(String(url)).toContain("/auth/v1/token?grant_type=password");
      const headers = init?.headers as Record<string, string>;
      expect(headers.apikey).toBe("anon-key-123");
      return new Response(
        JSON.stringify({
          access_token: "at-1",
          refresh_token: "rt-1",
          expires_in: 3600,
          user: { id: "subj-1", email: "u@example.com" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as unknown as typeof fetch;
    const res = await supabase.signInWithPassword("u@example.com", "pw", {
      fetchImpl: fakeFetch,
    });
    expect(res.accessToken).toBe("at-1");
    expect(res.refreshToken).toBe("rt-1");
    expect(res.expiresIn).toBe(3600);
    expect(res.subject).toBe("subj-1");
    expect(res.email).toBe("u@example.com");
  });

  it("refreshSession and revokeSession hit their endpoints", async () => {
    const calls: string[] = [];
    const fakeFetch = (async (url: string, _init?: RequestInit) => {
      calls.push(String(url));
      return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as unknown as typeof fetch;
    await supabase.refreshSession("rt-x", { fetchImpl: fakeFetch });
    await supabase.revokeSession("rt-x", { fetchImpl: fakeFetch });
    expect(calls.some((u) => u.includes("/auth/v1/token?grant_type=refresh_token"))).toBe(true);
    expect(calls.some((u) => u.includes("/auth/v1/logout"))).toBe(true);
  });

  it("sendMagicLink posts to /auth/v1/otp with redirect_to, body, and service-role key", async () => {
    let captured: { url: string; body: unknown; headers: Record<string, string> } | null = null;
    const fakeFetch = (async (url: string, init?: RequestInit) => {
      captured = {
        url: String(url),
        body: JSON.parse(String(init?.body)),
        headers: init?.headers as Record<string, string>,
      };
      return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as unknown as typeof fetch;
    await supabase.sendMagicLink("new@example.com", { redirectTo: "https://app.example/api/auth/callback", codeChallenge: "challenge-xyz" }, { fetchImpl: fakeFetch });
    expect(captured!.url).toContain("/auth/v1/otp?redirect_to=");
    expect(captured!.url).toContain("redirect_to=https%3A%2F%2Fapp.example%2Fapi%2Fauth%2Fcallback");
    expect((captured!.body as Record<string, unknown>).email).toBe("new@example.com");
    expect((captured!.body as Record<string, unknown>).create_user).toBe(true);
    expect((captured!.body as Record<string, unknown>).code_challenge_method).toBe("S256");
    expect((captured!.body as Record<string, unknown>).code_challenge).toBe("challenge-xyz");
    expect(captured!.headers.Authorization).toBe("Bearer service-role-key-999");
  });

  it("has no signUpWithPassword export", () => {
    expect((supabase as Record<string, unknown>).signUpWithPassword).toBeUndefined();
  });

  it("maps upstream error to a named error", async () => {
    const fakeFetch = (async () =>
      new Response("boom", { status: 400 })) as unknown as typeof fetch;
    await expect(
      supabase.signInWithPassword("u@example.com", "pw", { fetchImpl: fakeFetch }),
    ).rejects.toBeInstanceOf(supabase.AuthUpstreamError);
  });

  it("exchangeCodeForTokens maps body", async () => {
    const fakeFetch = (async () =>
      new Response(
        JSON.stringify({
          access_token: "at-2",
          refresh_token: "rt-2",
          expires_in: 1800,
          user: { id: "subj-2", email: "x@example.com" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )) as unknown as typeof fetch;
    const res = await supabase.exchangeCodeForTokens("code-1", "verifier-1", {
      fetchImpl: fakeFetch,
    });
    expect(res.accessToken).toBe("at-2");
    expect(res.subject).toBe("subj-2");
  });
});
