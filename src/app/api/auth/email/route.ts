// POST /api/auth/email — server-mediated email + password sign-in.
//
// The browser never receives a token. The route is INVITE-GATED (OD12): an
// email with no invitation (and no accepted membership) gets the plain notice
// and the Auth server is never called. Account creation happens only when a
// pending invitation is being accepted (the Auth Admin API, email_confirm).
import { NextResponse } from "next/server";
import { badRequest, serverError } from "@/lib/api";
import { authConfigured, authEnv } from "@/lib/auth/config";
import {
  authNoticeText,
  noInvitationNoticeText,
  providerNoticeText,
  tenantStoreNoticeText,
} from "@/lib/auth/notice";
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
  ProviderNotConfiguredError,
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
  // The shared validator owns the body shape (422); the domain keeps the
  // credential and invite rules. There is no second body reader.
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
      let created: { subject: string; email: string | null };
      try {
        created = await createUserWithPassword(email, credentials.password);
      } catch (createError) {
        // An existing account plus a wrong password is bad credentials, not a
        // gateway fault (the Admin API refuses the duplicate).
        if (
          createError instanceof AuthUpstreamError &&
          createError.status !== undefined &&
          createError.status >= 400 &&
          createError.status < 500
        ) {
          throw new InvalidCredentialsError();
        }
        throw createError;
      }
      if (!created.subject) throw new AuthUpstreamError("auth upstream returned no subject");
      tokens = await signInWithPassword(email, credentials.password);
    }

    // A pending invitation is bound to the signed-in subject exactly once.
    if (selected.status === "pending") {
      const accepted = await acceptPendingInvite(client, tokens.subject, email, selected.workspaceId);
      if (!accepted) throw new NoInvitationError(noInvitationNoticeText());
    }
    if (!tokens.subject) throw new NotSignedInError();

    const res = NextResponse.json({ ok: true });
    applySessionCookies(res, sessionFromTokens(tokens));
    return res;
  } catch (e) {
    return serverError(e);
  }
}
