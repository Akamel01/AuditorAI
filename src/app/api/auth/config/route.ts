// GET /api/auth/config — the configured providers (the sign-in page's source of
// truth). With auth unset it is a plain notice, never a crash (AC1, OD11).
import { NextResponse } from "next/server";
import { serverError } from "@/lib/api";
import { authConfigured, authEnv, enabledProviders } from "@/lib/auth/config";
import { authNoticeText } from "@/lib/auth/notice";

export async function GET() {
  try {
    const env = authEnv();
    const configured = authConfigured(env);
    if (!configured) {
      return NextResponse.json(
        { configured: false, providers: [], error: authNoticeText() },
        { status: 503 },
      );
    }
    return NextResponse.json({ configured: true, providers: enabledProviders(env) });
  } catch (e) {
    return serverError(e);
  }
}
