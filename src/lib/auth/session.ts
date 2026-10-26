import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { supabaseUrl, supabaseJwtSecret } from "@/lib/db/config";
import { verifyAccessToken, pkceChallenge } from "./supabase";

export const SESSION_COOKIE = "auditorai.session";
export const REFRESH_COOKIE = "auditorai.refresh";
export const PKCE_COOKIE = "auditorai.pkce";

export interface AuthSession {
  subject: string;
  email: string | null;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

function isProd(): boolean {
  return process.env.NODE_ENV === "production";
}

function baseCookieOpts(maxAge?: number): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge?: number;
} {
  const opts: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: "lax";
    path: string;
    maxAge?: number;
  } = {
    httpOnly: true,
    secure: isProd(),
    sameSite: "lax",
    path: "/",
  };
  if (maxAge !== undefined) opts.maxAge = maxAge;
  return opts;
}

export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (key !== name) continue;
    const raw = trimmed.slice(eq + 1);
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return null;
}

export function readSession(req: Request): AuthSession | null {
  try {
    const accessToken = readCookie(req, SESSION_COOKIE);
    const refreshToken = readCookie(req, REFRESH_COOKIE);
    if (!accessToken || !refreshToken) return null;
    const secret = supabaseJwtSecret();
    if (!secret) return null;
    const url = supabaseUrl();
    const issuer = url ? `${url.replace(/\/$/, "")}/auth/v1` : "";
    const audience = "authenticated";
    const verified = verifyAccessToken(accessToken, {
      secret,
      issuer,
      audience,
    });
    if (!verified) return null;
    return {
      subject: verified.sub,
      email: verified.email,
      accessToken,
      refreshToken,
      expiresAt: verified.exp,
    };
  } catch {
    return null;
  }
}

export function applySessionCookies(
  res: NextResponse,
  session: AuthSession,
): void {
  res.cookies.set(SESSION_COOKIE, session.accessToken, baseCookieOpts());
  res.cookies.set(REFRESH_COOKIE, session.refreshToken, baseCookieOpts());
}

export function clearSessionCookies(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, "", baseCookieOpts(0));
  res.cookies.set(REFRESH_COOKIE, "", baseCookieOpts(0));
  res.cookies.set(PKCE_COOKIE, "", baseCookieOpts(0));
}

export function newPkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = pkceChallenge(verifier);
  return { verifier, challenge };
}

export function applyPkceCookie(res: NextResponse, verifier: string): void {
  res.cookies.set(PKCE_COOKIE, verifier, baseCookieOpts(600));
}

/** The verifier is single-use: expire it on the callback response. */
export function clearPkceCookie(res: NextResponse): void {
  res.cookies.set(PKCE_COOKIE, "", baseCookieOpts(0));
}

/** The browser never holds a token: the server turns the verified Auth tokens
 *  into the httpOnly session it stores in the cookie. */
export function sessionFromTokens(tokens: {
  accessToken: string;
  refreshToken: string;
  subject: string;
  email: string | null;
  expiresIn: number;
}): AuthSession {
  return {
    subject: tokens.subject,
    email: tokens.email,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: Math.floor(Date.now() / 1000) + tokens.expiresIn,
  };
}

export function pkceVerifierFromCookie(
  input: Request | string | null | undefined,
): string | null {
  if (input == null) return null;
  if (typeof input === "string") return input.length ? input : null;
  return readCookie(input, PKCE_COOKIE);
}

