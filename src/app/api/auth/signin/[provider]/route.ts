// GET /api/auth/signin/[provider] — start the server-mediated OAuth flow.
// Google/Microsoft are offered only when their own flag AND the redirect origin
// are set (AC3). The PKCE verifier rides an httpOnly cookie; the browser never
// sees a token.
import { NextResponse } from "next/server";
import { serverError } from "@/lib/api";
import { authConfigured, authEnv } from "@/lib/auth/config";
import { authNoticeText, providerNoticeText } from "@/lib/auth/notice";
import { AuthNotConfiguredError, ProviderNotConfiguredError } from "@/lib/db/errors";
import { applyPkceCookie, newPkce } from "@/lib/auth/session";
import { providerAuthorizeUrl } from "@/lib/auth/supabase";

type Ctx = { params: Promise<{ provider: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    if (!authConfigured()) throw new AuthNotConfiguredError(authNoticeText());
    const { provider } = await ctx.params;
    if (provider !== "google" && provider !== "microsoft") {
      throw new ProviderNotConfiguredError(providerNoticeText(provider));
    }
    const env = authEnv();
    const enabled = provider === "google" ? env.googleEnabled : env.microsoftEnabled;
    if (!enabled || !env.redirectOrigin) {
      throw new ProviderNotConfiguredError(providerNoticeText(provider));
    }

    const { verifier, challenge } = newPkce();
    const authorizeUrl = providerAuthorizeUrl(provider, {
      redirectTo: `${env.redirectOrigin.replace(/\/$/, "")}/api/auth/callback`,
      codeChallenge: challenge,
    });
    const res = NextResponse.redirect(authorizeUrl, 302);
    applyPkceCookie(res, verifier);
    return res;
  } catch (e) {
    return serverError(e);
  }
}
