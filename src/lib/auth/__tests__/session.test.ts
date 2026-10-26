import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createHmac, createHash } from "node:crypto";
import { NextResponse } from "next/server";
import * as session from "@/lib/auth/session";


const envKeys = [
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_JWT_SECRET",
  "NODE_ENV",
];

describe("session cookie seam", () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of envKeys) saved[k] = process.env[k];
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_JWT_SECRET = "jwt-secret-xyz";
  });
  afterEach(() => {
    for (const k of envKeys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  function signToken(expOffset = 3600): string {
    const secret = "jwt-secret-xyz";
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        sub: "user-123",
        email: "a@b.com",
        aud: "authenticated",
        iss: "https://example.supabase.co/auth/v1",
        exp: Math.floor(Date.now() / 1000) + expOffset,
      }),
    ).toString("base64url");
    const sig = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
    return `${header}.${payload}.${sig}`;
  }

  it("readCookie returns null when absent", () => {
    const req = new Request("http://x/");
    expect(session.readCookie(req, session.SESSION_COOKIE)).toBeNull();
  });

  it("readCookie parses cookie", () => {
    const req = new Request("http://x/", { headers: { cookie: "auditorai.session=abc123" } });
    expect(session.readCookie(req, session.SESSION_COOKIE)).toBe("abc123");
  });

  it("readSession returns null on missing cookie", () => {
    const req = new Request("http://x/");
    expect(session.readSession(req)).toBeNull();
  });

  it("readSession returns null on tampered token", () => {
    const token = signToken() + "x";
    const req = new Request("http://x/", {
      headers: { cookie: `auditorai.session=${token}; auditorai.refresh=rt` },
    });
    expect(session.readSession(req)).toBeNull();
  });

  it("readSession returns null on expired token", () => {
    const token = signToken(-3600);
    const req = new Request("http://x/", {
      headers: { cookie: `auditorai.session=${token}; auditorai.refresh=rt` },
    });
    expect(session.readSession(req)).toBeNull();
  });

  it("readSession returns session for valid token", () => {
    const token = signToken();
    const req = new Request("http://x/", {
      headers: { cookie: `auditorai.session=${token}; auditorai.refresh=rt` },
    });
    const s = session.readSession(req);
    expect(s).not.toBeNull();
    expect(s!.subject).toBe("user-123");
    expect(s!.email).toBe("a@b.com");
    expect(s!.accessToken).toBe(token);
    expect(s!.refreshToken).toBe("rt");
  });

  it("applySessionCookies sets httpOnly, SameSite=Lax, Path=/", () => {
    const res = new NextResponse(null);
    session.applySessionCookies(res, {
      subject: "u",
      email: null,
      accessToken: "at",
      refreshToken: "rt",
      expiresAt: 0,
    });
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("auditorai.session=at");
    expect(setCookie.toLowerCase()).toContain("httponly");
    expect(setCookie.toLowerCase()).toContain("samesite=lax");
    expect(setCookie).toContain("Path=/");
  });

  it("applySessionCookies sets Secure in production", () => {
    const prev = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    const res = new NextResponse(null);
    session.applySessionCookies(res, {
      subject: "u",
      email: null,
      accessToken: "at",
      refreshToken: "rt",
      expiresAt: 0,
    });
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie.toLowerCase()).toContain("secure");
    (process.env as Record<string, string | undefined>).NODE_ENV = prev;
  });

  it("applySessionCookies writes no token into body", () => {
    const res = new NextResponse("hello");
    session.applySessionCookies(res, {
      subject: "u",
      email: null,
      accessToken: "at",
      refreshToken: "rt",
      expiresAt: 0,
    });
    // body unchanged
    expect(res.body).toBeTruthy();
  });

  it("clearSessionCookies expires cookies", () => {
    const res = new NextResponse(null);
    session.clearSessionCookies(res);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("auditorai.session=");
    expect(setCookie).toContain("Max-Age=0");
  });

  it("newPkce returns 43+ char verifier and matching challenge", () => {
    const { verifier, challenge } = session.newPkce();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    const expected = createHash("sha256").update(verifier).digest("base64url");
    expect(challenge).toBe(expected);
  });

  it("pkceVerifierFromCookie reads PKCE cookie", () => {
    const req = new Request("http://x/", { headers: { cookie: "auditorai.pkce=verifier-xyz" } });
    expect(session.pkceVerifierFromCookie(req)).toBe("verifier-xyz");
  });

  it("pkceVerifierFromCookie returns null when absent", () => {
    const req = new Request("http://x/");
    expect(session.pkceVerifierFromCookie(req)).toBeNull();
  });
});
