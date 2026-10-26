// POST /api/auth/email — server-mediated email + password sign-in.
//
// The browser never receives a token. The route is INVITE-GATED (OD12): an
// email with no invitation (and no accepted membership) gets the plain notice
// and the Auth server is never called. A pending invitation no longer creates
// an account here; instead the inbox is proven by sending a magic link, and the
// invitation is bound in /api/auth/callback only after the email is verified.
import { NextResponse } from "next/server";
import { badRequest, serverError } from "@/lib/api";
import { authConfigured, authEnv } from "@/lib/auth/config";
import {
  authNoticeText,
  invitationPendingNoticeText,
  noInvitationNoticeText,
  providerNoticeText,
  tenantStoreNoticeText,
} from "@/lib/auth/notice";
import {
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
  ProviderNotConfiguredError,
  TenantStoreRequiredError,
  WorkspaceMembershipError,
} from "@/lib/db/errors";
import { isTenantDatabaseAvailable, tenantSqlClient } from "@/lib/db/identity";
import {
  AuthUpstreamError,
  sendMagicLink,
  signInWithPassword,
  type AuthTokens,
} from "@/lib/auth/supabase";
import { applyPkceCookie, applySessionCookies, newPkce, sessionFromTokens } from "@/lib/auth/session";
import { authEmailRequest, readJsonBody } from "@/lib/request-schema";

interface Credentials {
  email: string;
  password: string;
  workspaceId: string | null;
}

function isExpired(m: EmailMembership, now = Date.now()): boolean {
  if (!m.expiresAt) return false;
  const ms = new Date(m.expiresAt).getTime();
  return Number.isFinite(ms) && ms <= now;
}

async function readCredentials(req: Request): Promise<Credentials> {
  const body = await readJsonBody<{ email: string; password: string; workspace_id?: string }>(
    req,
    authEmailRequest,
  );
  return {
    email: body.email,
    password: body.password,
    workspaceId: body.workspace_id ?? null,
  };
}

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
    if (!authEnv().emailEnabled) {
      throw new ProviderNotConfiguredError(providerNoticeText("email"));
    }
    if (!isTenantDatabaseAvailable()) {
      throw new TenantStoreRequiredError(tenantStoreNoticeText());
    }

    const credentials = await readCredentials(req);
    if (!credentials.email.trim() || !credentials.password) {
      return badRequest("email and password are required");
    }
    const email = normalizeEmail(credentials.email);
    const client = tenantSqlClient();

    const memberships = await listMembershipsByEmail(client, email);
    if (!memberships.length) throw new NoInvitationError(noInvitationNoticeText());

    const selected = selectMembership(memberships, credentials.workspaceId);
    if (selected.status === "revoked") throw new WorkspaceMembershipError();
    if (selected.status === "pending" && isExpired(selected)) {
      throw new NoInvitationError(noInvitationNoticeText());
    }

    // Pending invitation: prove inbox ownership via magic link instead of
    // creating an account. Binding happens in /api/auth/callback.
    if (selected.status === "pending") {
      const origin = authEnv().redirectOrigin;
      if (!origin) throw new ProviderNotConfiguredError(providerNoticeText("email"));
      const redirectTo = `${origin.replace(/\/$/, "")}/api/auth/callback`;
      const { verifier, challenge } = newPkce();
      await sendMagicLink(email, { redirectTo, codeChallenge: challenge });
      const res = NextResponse.json(
        { ok: true, notice: invitationPendingNoticeText() },
        { status: 202 },
      );
      applyPkceCookie(res, verifier, 3600);
      return res;
    }

    // Active membership: password sign-in only.
    let tokens: AuthTokens;
    try {
      tokens = await signInWithPassword(email, credentials.password);
    } catch (e) {
      if (!(e instanceof AuthUpstreamError)) throw e;
      throw new InvalidCredentialsError();
    }
    if (!tokens.subject) throw new NotSignedInError();

    const res = NextResponse.json({ ok: true });
    applySessionCookies(res, sessionFromTokens(tokens));
    return res;
  } catch (e) {
    return serverError(e);
  }
}
