import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { supabaseUrl, supabaseAnonKey } from "@/lib/db/config";
import { supabaseServiceRoleKey } from "@/lib/db/admin";

export type AuthProvider = "email" | "google" | "microsoft";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  subject: string;
  email: string | null;
  emailVerified: boolean;
}

export class AuthUpstreamError extends Error {
  status?: number;
  constructor(message = "auth upstream error", status?: number) {
    super(message);
    this.name = "AuthUpstreamError";
    this.status = status;
  }
}

function baseUrl(): string {
  const url = supabaseUrl();
  if (!url) throw new AuthUpstreamError("auth not configured");
  return url.replace(/\/$/, "");
}

function anonKey(): string {
  const key = supabaseAnonKey();
  if (!key) throw new AuthUpstreamError("auth not configured");
  return key;
}

function fetchImplOf(opts?: { fetchImpl?: typeof fetch }): typeof fetch {
  return opts?.fetchImpl ?? fetch;
}

function emailVerifiedFromToken(accessToken: string): boolean {
  try {
    const parts = accessToken.split(".");
    if (parts.length !== 3) return false;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    const v = payload?.email_verified;
    return v === true || v === "true";
  } catch {
    return false;
  }
}

function mapTokens(body: Record<string, unknown>): AuthTokens {
  const user = (body.user ?? {}) as Record<string, unknown>;
  const accessToken = String(body.access_token ?? "");
  const confirmedAt = user.email_confirmed_at;
  const fromUser = typeof confirmedAt === "string" && confirmedAt.trim().length > 0;
  return {
    accessToken,
    refreshToken: String(body.refresh_token ?? ""),
    expiresIn: Number(body.expires_in ?? 0),
    subject: String(user.id ?? body.sub ?? ""),
    email: (user.email ?? body.email ?? null) as string | null,
    emailVerified: fromUser || emailVerifiedFromToken(accessToken),
  };
}

async function postJson(
  path: string,
  body: unknown,
  headers: Record<string, string>,
  f: typeof fetch,
): Promise<Record<string, unknown>> {
  const res = await f(`${baseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new AuthUpstreamError("auth upstream error", res.status);
  }
  return (await res.json()) as Record<string, unknown>;
}

export async function signInWithPassword(
  email: string,
  password: string,
  opts?: { fetchImpl?: typeof fetch },
): Promise<AuthTokens> {
  const f = fetchImplOf(opts);
  const body = await postJson(
    "/auth/v1/token?grant_type=password",
    { email, password },
    { apikey: anonKey() },
    f,
  );
  return mapTokens(body);
}

// GoTrue's /invite does not carry redirect_to or PKCE, so the magic link
// (/auth/v1/otp) is the mechanism that binds the invitation to a verified inbox.
export async function sendMagicLink(
  email: string,
  opts: { redirectTo: string; codeChallenge: string },
  reqOpts?: { fetchImpl?: typeof fetch },
): Promise<void> {
  const f = fetchImplOf(reqOpts);
  const serviceKey = supabaseServiceRoleKey();
  if (!serviceKey) throw new AuthUpstreamError("auth not configured");
  const res = await f(
    `${baseUrl()}/auth/v1/otp?redirect_to=${encodeURIComponent(opts.redirectTo)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey(),
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        email,
        create_user: true,
        code_challenge: opts.codeChallenge,
        code_challenge_method: "S256",
      }),
    },
  );
  if (!res.ok) throw new AuthUpstreamError("auth upstream error", res.status);
}

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  opts?: { fetchImpl?: typeof fetch },
): Promise<AuthTokens> {
  const f = fetchImplOf(opts);
  const body = await postJson(
    "/auth/v1/token?grant_type=pkce",
    { auth_code: code, code_verifier: codeVerifier },
    { apikey: anonKey() },
    f,
  );
  return mapTokens(body);
}

export async function refreshSession(
  refreshToken: string,
  opts?: { fetchImpl?: typeof fetch },
): Promise<AuthTokens> {
  const f = fetchImplOf(opts);
  const body = await postJson(
    "/auth/v1/token?grant_type=refresh_token",
    { refresh_token: refreshToken },
    { apikey: anonKey() },
    f,
  );
  return mapTokens(body);
}

export async function revokeSession(
  refreshToken: string,
  opts?: { fetchImpl?: typeof fetch },
): Promise<void> {
  const f = fetchImplOf(opts);
  const res = await f(`${baseUrl()}/auth/v1/logout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey(),
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) {
    throw new AuthUpstreamError("auth upstream error", res.status);
  }
}

export function providerAuthorizeUrl(
  provider: AuthProvider,
  opts: { redirectTo: string; codeChallenge: string },
): string {
  const url = baseUrl();
  const params = new URLSearchParams({
    provider,
    redirect_to: opts.redirectTo,
    code_challenge: opts.codeChallenge,
    code_challenge_method: "S256",
  });
  return `${url}/auth/v1/authorize?${params.toString()}`;
}

export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function verifyAccessToken(
  token: string,
  opts: { secret: string; issuer: string; audience: string; now?: number },
): { sub: string; email: string | null; exp: number } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [h, p, s] = parts;
    const header = JSON.parse(Buffer.from(h, "base64url").toString("utf8"));
    if (header?.alg !== "HS256") return null;
    const payload = JSON.parse(Buffer.from(p, "base64url").toString("utf8"));
    const expected = createHmac("sha256", opts.secret).update(`${h}.${p}`).digest();
    const provided = Buffer.from(s, "base64url");
    if (provided.length !== expected.length) return null;
    if (!timingSafeEqual(provided, expected)) return null;
    const now = opts.now ?? Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== "number" || payload.exp <= now) return null;
    const aud = payload.aud;
    const audOk = Array.isArray(aud)
      ? aud.includes(opts.audience)
      : aud === opts.audience;
    if (!audOk) return null;
    if (payload.iss !== opts.issuer) return null;
    return {
      sub: String(payload.sub ?? ""),
      email: (payload.email ?? null) as string | null,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}
