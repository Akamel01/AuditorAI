// POST /api/auth/email — server-mediated email + password sign-in.
//
// The browser never receives a token. The route is INVITE-GATED (OD12): an
// email with no invitation (and no accepted membership) gets the plain notice
// and the Auth server is never called. Account creation happens only when a
// pending invitation is being accepted (the Auth Admin API, email_confirm).
import { NextResponse } from "next/server";
import { badRequest, serverError } from "@/lib/api";
import { authConfigured } from "@/lib/auth/config";
import { authNoticeText, noInvitationNoticeText, tenantStoreNoticeText } from "@/lib/auth/notice";
import {
  acceptPendingInvite,
  listMembershipsByEmail,
  normalizeEmail,
  type EmailMembership,
} from "@/lib/db/seats";
import {
  AmbiguousInvitationError,
  AuthNotConfiguredError,
  InvalidCredentialsError,
  NoInvitationError,
  NotSignedInError,
  TenantStoreRequiredError,
  WorkspaceMembershipError,
} from "@/lib/db/errors";
import { isTenantDatabaseAvailable, tenantSqlClient } from "@/lib/db/identity";
import {
  AuthUpstreamError,
  createUserWithPassword,
  signInWithPassword,
  type AuthTokens,
} from "@/lib/auth/supabase";
import { applySessionCookies, sessionFromTokens } from "@/lib/auth/session";

interface Credentials {
  email: string;
  password: string;
  workspaceId: string | null;
  formPost: boolean;
}

function isExpired(m: EmailMembership, now = Date.now()): boolean {
  if (!m.expiresAt) return false;
  const ms = new Date(m.expiresAt).getTime();
  return Number.isFinite(ms) && ms <= now;
}

async function readCredentials(req: Request): Promise<Credentials | null> {
  const contentType = req.headers.get("content-type") ?? "";
  const formPost =
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data");
  if (formPost) {
    const form = await req.formData();
    return {
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      workspaceId: String(form.get("workspace_id") ?? "") || null,
      formPost: true,
    };
  }
  try {
    const body = (await req.json()) as Record<string, unknown>;
    return {
      email: typeof body.email === "string" ? body.email : "",
      password: typeof body.password === "string" ? body.password : "",
      workspaceId: typeof body.workspace_id === "string" ? body.workspace_id : null,
      formPost: false,
    };
  } catch {
    return null;
  }
}

/** Pick the membership the request is signing in for. More than one pending
 *  invitation without an explicit workspace is an error, never rows[0]. */
function selectMembership(rows: EmailMembership[], workspaceId: string | null): EmailMembership {
  if (workspaceId) {
    const chosen = rows.find((m) => m.workspaceId === workspaceId);
    if (!chosen) throw new NoInvitationError(noInvitationNoticeText());
    return chosen;
  }
  const livePending = rows.filter((m) => m.status === "pending" && !isExpired(m));
  if (livePending.length > 1) throw new AmbiguousInvitationError();
  if (livePending.length === 1) return livePending[0];
  const active = rows.filter((m) => m.status === "active");
  if (active.length > 1) throw new AmbiguousInvitationError();
  if (active.length === 1) return active[0];
  throw new NoInvitationError(noInvitationNoticeText());
}

export async function POST(req: Request) {
  try {
    if (!authConfigured()) throw new AuthNotConfiguredError(authNoticeText());
    if (!isTenantDatabaseAvailable()) {
      throw new TenantStoreRequiredError(tenantStoreNoticeText());
    }

    const credentials = await readCredentials(req);
    if (!credentials || !credentials.email.trim() || !credentials.password) {
      return badRequest("email and password are required");
    }
    const email = normalizeEmail(credentials.email);
    const client = tenantSqlClient();

    // The invite gate runs BEFORE any call to the Auth server (AC5).
    const memberships = await listMembershipsByEmail(client, email);
    if (!memberships.length) throw new NoInvitationError(noInvitationNoticeText());

    const selected = selectMembership(memberships, credentials.workspaceId);
    if (selected.status === "revoked") throw new WorkspaceMembershipError();
    if (selected.status === "pending" && isExpired(selected)) {
      throw new NoInvitationError(noInvitationNoticeText());
    }

    let tokens: AuthTokens;
    try {
      tokens = await signInWithPassword(email, credentials.password);
    } catch (e) {
      if (!(e instanceof AuthUpstreamError)) throw e;
      // Only accepting an invitation may create an account (OD12).
      if (selected.status !== "pending") throw new InvalidCredentialsError();
      const created = await createUserWithPassword(email, credentials.password);
      if (!created.subject) throw new AuthUpstreamError("auth upstream returned no subject");
      tokens = await signInWithPassword(email, credentials.password);
    }

    // A pending invitation is bound to the signed-in subject exactly once.
    if (selected.status === "pending") {
      const accepted = await acceptPendingInvite(client, tokens.subject, email, selected.workspaceId);
      if (!accepted) throw new NoInvitationError(noInvitationNoticeText());
    }
    if (!tokens.subject) throw new NotSignedInError();

    const res = credentials.formPost
      ? NextResponse.redirect(new URL("/", req.url), 303)
      : NextResponse.json({ ok: true });
    applySessionCookies(res, sessionFromTokens(tokens));
    return res;
  } catch (e) {
    return serverError(e);
  }
}
