// GET /api/auth/me — the signed-in subject and email only (the operator needs
// the uuid for the out-of-band first-owner provisioning, OD18).
import { NextResponse } from "next/server";
import { serverError } from "@/lib/api";
import { authConfigured } from "@/lib/auth/config";
import { authNoticeText } from "@/lib/auth/notice";
import { AuthNotConfiguredError, NotSignedInError } from "@/lib/db/errors";
import { readSession } from "@/lib/auth/session";

export async function GET(req: Request) {
  try {
    if (!authConfigured()) throw new AuthNotConfiguredError(authNoticeText());
    const session = readSession(req);
    if (!session) throw new NotSignedInError();
    return NextResponse.json({ subject: session.subject, email: session.email });
  } catch (e) {
    return serverError(e);
  }
}
