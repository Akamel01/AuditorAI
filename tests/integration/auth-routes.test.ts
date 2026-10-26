// M9 — the server-mediated sign-in surface. Offline: a fake Auth REST server
// (a stubbed global fetch) and an in-process Postgres for the invite gate.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { GET as configRoute } from "@/app/api/auth/config/route";
import { POST as emailRoute } from "@/app/api/auth/email/route";
import { GET as signinRoute } from "@/app/api/auth/signin/[provider]/route";
import { GET as callbackRoute } from "@/app/api/auth/callback/route";
import { POST as signoutRoute } from "@/app/api/auth/signout/route";
import { GET as meRoute } from "@/app/api/auth/me/route";
import { GET as seatsRoute } from "@/app/api/workspaces/seats/route";
import { createPgliteSqlClient, type PgliteLike } from "@/lib/db/pglite-client";
import { setSqlClientForTests } from "@/lib/db/sql";
import { MemoryStore, setDataStoreForTests, workspaceHash } from "@/lib/persistence/store";
import {
  authNoticeText,
  noInvitationNoticeText,
  providerNoticeText,
  tenantStoreNoticeText,
} from "@/lib/auth/notice";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 180_000 });

const WS = "44444444-4444-4444-4444-444444444444";
const OWNER = "owner-subject";
const OWNER_EMAIL = "owner@example.com";
const INVITEE_EMAIL = "invitee@example.com";
const KEY = "auth-route-workspace-key-0123456789";

const ENV = {
  SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_JWT_SECRET: "jwt-secret",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  SUPABASE_AUTH_ENABLED: "true",
  SUPABASE_AUTH_EMAIL_ENABLED: "true",
  SUPABASE_AUTH_GOOGLE_ENABLED: "false",
  SUPABASE_AUTH_MICROSOFT_ENABLED: "false",
  SUPABASE_AUTH_REDIRECT_ORIGIN: "",
} as const;

let db: PGlite;
let client: ReturnType<typeof createPgliteSqlClient>;
const savedEnv: Record<string, string | undefined> = {};
const originalFetch = globalThis.fetch;

function setAuthEnv(): void {
  for (const [k, v] of Object.entries(ENV)) process.env[k] = v;
}

function clearAuthEnv(): void {
  for (const k of Object.keys(ENV)) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
}

async function seed(): Promise<void> {
  await db.exec("truncate public.projects, public.workspace_members, public.workspace_credentials, public.workspaces cascade");
  await db.query(
    `insert into public.workspaces (id, name, seat_count, legacy_key_hash)
     values ($1, 'auth workspace', 5, $2)`,
    [WS, workspaceHash(KEY)],
  );
  await db.query(
    `insert into public.workspace_members (workspace_id, subject_id, role, status, email, accepted_at)
     values ($1, $2, 'owner', 'active', $3, now())`,
    [WS, OWNER, OWNER_EMAIL],
  );
  await db.query(
    `insert into public.workspace_members (workspace_id, subject_id, role, status, email, expires_at)
     values ($1, $2, 'member', 'pending', $3, now() + interval '14 days')`,
    [WS, `pending:${"0".repeat(16)}`, INVITEE_EMAIL],
  );
}

function jsonRequest(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function formRequest(url: string, body: Record<string, string>): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
}

interface FetchCall {
  url: string;
  body: unknown;
}

function stubAuthServer(opts: {
  passwordFails?: number;
  tokens?: { access_token: string; refresh_token: string; expires_in: number; user: { id: string; email: string } };
}): FetchCall[] {
  const calls: FetchCall[] = [];
  let passwordCalls = 0;
  const tokens = opts.tokens ?? {
    access_token: "access-token-value",
    refresh_token: "refresh-token-value",
    expires_in: 3600,
    user: { id: "invitee-subject", email: INVITEE_EMAIL },
  };
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input.toString();
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ url, body });

    if (url.includes("/auth/v1/token?grant_type=password")) {
      passwordCalls += 1;
      if (passwordCalls <= (opts.passwordFails ?? 0)) {
        return new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 });
      }
      return new Response(JSON.stringify(tokens), { status: 200 });
    }
    if (url.includes("/auth/v1/admin/users")) {
      return new Response(JSON.stringify({ user: { id: tokens.user.id, email: tokens.user.email } }), { status: 200 });
    }
    if (url.includes("/auth/v1/token?grant_type=pkce")) {
      return new Response(JSON.stringify(tokens), { status: 200 });
    }
    if (url.includes("/auth/v1/logout")) {
      return new Response(null, { status: 204 });
    }
    return new Response(JSON.stringify({ error: "unexpected upstream call" }), { status: 500 });
  }) as typeof fetch;
  return calls;
}

beforeAll(async () => {
  for (const k of Object.keys(ENV)) savedEnv[k] = process.env[k];
  db = new PGlite();
  const dir = path.join(process.cwd(), "supabase", "migrations");
  for (const file of readdirSync(dir).sort()) {
    await db.exec(readFileSync(path.join(dir, file), "utf8"));
  }
  client = createPgliteSqlClient(db as unknown as PgliteLike);
});

afterAll(async () => {
  globalThis.fetch = originalFetch;
  clearAuthEnv();
  setSqlClientForTests(null);
  setDataStoreForTests(null);
  await db.close();
});

beforeEach(async () => {
  await seed();
  setSqlClientForTests(client);
  setDataStoreForTests(new MemoryStore());
});

afterEach(() => {
  vi.restoreAllMocks();
  setSqlClientForTests(client);
});

describe("auth not configured (AC1 degrade)", () => {
  it("every auth route returns the plain 503 notice, never a crash", async () => {
    clearAuthEnv();

    const config = await configRoute();
    expect(config.status).toBe(503);
    expect(await config.json()).toMatchObject({ configured: false, error: authNoticeText() });

    const email = await emailRoute(
      jsonRequest("http://local/api/auth/email", "POST", { email: "a@b.c", password: "pw" }),
    );
    expect(email.status).toBe(503);
    expect(((await email.json()) as { error: string }).error).toBe(authNoticeText());

    const provider = await signinRoute(
      new Request("http://local/api/auth/signin/google"),
      { params: Promise.resolve({ provider: "google" }) },
    );
    expect(provider.status).toBe(503);
    expect(((await provider.json()) as { error: string }).error).toBe(authNoticeText());

    const callback = await callbackRoute(new Request("http://local/api/auth/callback?code=x"));
    expect(callback.status).toBe(503);

    const signout = await signoutRoute(new Request("http://local/api/auth/signout", { method: "POST" }));
    expect(signout.status).toBe(503);

    const me = await meRoute(new Request("http://local/api/auth/me"));
    expect(me.status).toBe(503);
  });
});

describe("configured providers (AC1/AC3)", () => {
  it("email appears with the master switch; Google needs its flag and the redirect origin", async () => {
    setAuthEnv();
    const config = await configRoute();
    expect(config.status).toBe(200);
    expect(await config.json()).toEqual({ configured: true, providers: ["email"] });

    process.env.SUPABASE_AUTH_GOOGLE_ENABLED = "true";
    const withoutOrigin = await configRoute();
    expect(await withoutOrigin.json()).toEqual({ configured: true, providers: ["email"] });

    const provider = await signinRoute(
      new Request("http://local/api/auth/signin/google"),
      { params: Promise.resolve({ provider: "google" }) },
    );
    expect(provider.status).toBe(503);
    expect(((await provider.json()) as { error: string }).error).toBe(providerNoticeText("google"));
  });

  it("a configured provider redirects to the authorize URL with a PKCE challenge", async () => {
    setAuthEnv();
    process.env.SUPABASE_AUTH_GOOGLE_ENABLED = "true";
    process.env.SUPABASE_AUTH_REDIRECT_ORIGIN = "https://app.example";

    const res = await signinRoute(
      new Request("http://local/api/auth/signin/google"),
      { params: Promise.resolve({ provider: "google" }) },
    );
    expect(res.status).toBe(302);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/auth/v1/authorize");
    expect(location).toContain("provider=google");
    expect(location).toContain("code_challenge_method=S256");
    expect(location).toContain("redirect_to=https%3A%2F%2Fapp.example%2Fapi%2Fauth%2Fcallback");
    expect(res.headers.get("set-cookie")).toContain("auditorai.pkce=");
  });
});

describe("email sign-in is invite-gated (AC5)", () => {
  it("no invitation: 401 plain notice and NO call to the Auth server", async () => {
    setAuthEnv();
    const calls = stubAuthServer({});

    const res = await emailRoute(
      jsonRequest("http://local/api/auth/email", "POST", {
        email: "stranger@example.com",
        password: "secret",
      }),
    );
    expect(res.status).toBe(401);
    expect(((await res.json()) as { error: string }).error).toBe(noInvitationNoticeText());
    expect(calls).toHaveLength(0);
  });

  it("a pending invitation creates the account (email_confirm) and sets an httpOnly session", async () => {
    setAuthEnv();
    const calls = stubAuthServer({ passwordFails: 1 });

    const res = await emailRoute(
      jsonRequest("http://local/api/auth/email", "POST", {
        email: INVITEE_EMAIL.toUpperCase(),
        password: "secret",
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain("access-token-value");
    expect(JSON.stringify(body)).not.toContain("refresh-token-value");

    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("auditorai.session=access-token-value");
    expect(setCookie.toLowerCase()).toContain("httponly");

    const adminCall = calls.find((c) => c.url.includes("/auth/v1/admin/users"));
    expect(adminCall?.body).toMatchObject({ email: INVITEE_EMAIL, email_confirm: true });

    const row = await db.query<{ subject_id: string; status: string }>(
      "select subject_id, status from public.workspace_members where workspace_id = $1 and email = $2",
      [WS, INVITEE_EMAIL],
    );
    expect(row.rows[0]).toEqual({ subject_id: "invitee-subject", status: "active" });
  });

  it("a form post redirects on success", async () => {
    setAuthEnv();
    stubAuthServer({ passwordFails: 0 });

    const res = await emailRoute(
      formRequest("http://local/api/auth/email", {
        email: INVITEE_EMAIL,
        password: "secret",
      }),
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/");
    expect(res.headers.get("set-cookie")).toContain("auditorai.session=");
  });
});

describe("tenant store required (409)", () => {
  it("sign-in refuses with the named notice while TENANT_STORE is not postgres", async () => {
    setAuthEnv();
    setSqlClientForTests(null);
    delete process.env.TENANT_STORE;

    const res = await emailRoute(
      jsonRequest("http://local/api/auth/email", "POST", {
        email: INVITEE_EMAIL,
        password: "secret",
      }),
    );
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toBe(tenantStoreNoticeText());
  });

  it("the seats route refuses with the named notice on the legacy path", async () => {
    setAuthEnv();
    setSqlClientForTests(null);
    delete process.env.TENANT_STORE;

    const res = await seatsRoute(
      new Request("http://local/api/workspaces/seats", {
        headers: { "x-workspace-key": KEY },
      }),
    );
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toBe(tenantStoreNoticeText());
  });
});

describe("OAuth callback", () => {
  it("exchanges the code and sets the session cookie", async () => {
    setAuthEnv();
    const calls = stubAuthServer({});
    const res = await callbackRoute(
      new Request("http://local/api/auth/callback?code=the-code", {
        headers: { cookie: "auditorai.pkce=the-verifier" },
      }),
    );
    expect(res.status).toBe(303);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("auditorai.session=access-token-value");
    expect(setCookie).toContain("auditorai.pkce=");
    const pkceCall = calls.find((c) => c.url.includes("grant_type=pkce"));
    expect(pkceCall?.body).toMatchObject({ auth_code: "the-code", code_verifier: "the-verifier" });
  });
});
