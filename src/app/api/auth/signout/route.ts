// POST /api/auth/signout — clear the httpOnly session. Best effort upstream
// revocation; the cookies are cleared either way.
import { NextResponse } from "next/server";
import { serverError } from "@/lib/api";
import { authConfigured } from "@/lib/auth/config";
import { authNoticeText } from "@/lib/auth/notice";
import { AuthNotConfiguredError } from "@/lib/db/errors";
import { revokeSession } from "@/lib/auth/supabase";
import {
  REFRESH_COOKIE,
  clearSessionCookies,
  readCookie,
} from "@/lib/auth/session";

export async function POST(req: Request) {
  try {
    if (!authConfigured()) throw new AuthNotConfiguredError(authNoticeText());
    const refresh = readCookie(req, REFRESH_COOKIE);
    if (refresh) {
      try {
        await revokeSession(refresh);
      } catch {
        // The local session is cleared even when the upstream call fails.
      }
    }
    const res = NextResponse.json({ ok: true });
    clearSessionCookies(res);
    return res;
  } catch (e) {
    return serverError(e);
  }
}
