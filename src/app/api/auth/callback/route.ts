// GET /api/auth/callback — finish the PKCE exchange and set the httpOnly
// session. The browser never receives the tokens (AC2).
import { NextResponse } from "next/server";
import { badRequest, serverError } from "@/lib/api";
import { authConfigured } from "@/lib/auth/config";
import { authNoticeText } from "@/lib/auth/notice";
import { AuthNotConfiguredError } from "@/lib/db/errors";
import { exchangeCodeForTokens, AuthUpstreamError } from "@/lib/auth/supabase";
import {
  applySessionCookies,
  clearPkceCookie,
  pkceVerifierFromCookie,
  sessionFromTokens,
} from "@/lib/auth/session";
import { isTenantDatabaseAvailable, tenantSqlClient } from "@/lib/db/identity";
import { acceptPendingInvite, listMembershipsByEmail } from "@/lib/db/seats";

async function bindPendingInvite(subject: string, email: string): Promise<void> {
  if (!isTenantDatabaseAvailable()) return;
  const client = tenantSqlClient();
  const pending = (await listMembershipsByEmail(client, email)).filter(
    (m) => m.status === "pending",
  );
  // Never pick one of several silently; the user can accept from the seats
  // surface with an explicit workspace.
  if (pending.length === 1) {
    await acceptPendingInvite(client, subject, email, pending[0].workspaceId);
  }
}

export async function GET(req: Request) {
  try {
    if (!authConfigured()) throw new AuthNotConfiguredError(authNoticeText());
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    if (!code) return badRequest("missing authorization code");
    const verifier = pkceVerifierFromCookie(req);
    if (!verifier) return badRequest("missing PKCE verifier");

    const tokens = await exchangeCodeForTokens(code, verifier);
    if (!tokens.subject) throw new AuthUpstreamError("auth upstream returned no subject");

    if (tokens.email && tokens.emailVerified) {
      try {
        await bindPendingInvite(tokens.subject, tokens.email);
      } catch {
        // A failed bind must not lose a valid session; the invitation stays
        // pending and can be accepted explicitly later.
      }
    }

    const res = NextResponse.redirect(new URL("/", req.url), 303);
    applySessionCookies(res, sessionFromTokens(tokens));
    clearPkceCookie(res);
    return res;
  } catch (e) {
    return serverError(e);
  }
}
