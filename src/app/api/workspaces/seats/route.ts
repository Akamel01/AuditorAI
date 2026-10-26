// GET  /api/workspaces/seats — the seat summary of the workspace.
// POST /api/workspaces/seats — invite a person (the seat limit is enforced at
// invite). Both require the tenant store: the legacy KV store has no seats, so
// the answer is the named TenantStoreRequiredError state, never a crash.
import { NextResponse } from "next/server";
import { badRequest, requireWorkspace, serverError, type RequestTenant } from "@/lib/api";
import { tenantStoreNoticeText } from "@/lib/auth/notice";
import {
  NotSignedInError,
  TenantStoreRequiredError,
  WorkspaceMembershipError,
} from "@/lib/db/errors";
import type { MemberRole } from "@/lib/db/claim";
import { tenantSqlClient } from "@/lib/db/identity";
import { createInvite, seatSummary, type SeatContext } from "@/lib/db/seats";

type Auth = Extract<Awaited<ReturnType<typeof requireWorkspace>>, { ok: true }>;

function seatContext(auth: Auth, tenant: RequestTenant): SeatContext {
  if (!auth.tenant) throw new TenantStoreRequiredError(tenantStoreNoticeText());
  if (!auth.session) throw new NotSignedInError();
  if (!tenant.role) throw new WorkspaceMembershipError();
  return {
    workspaceId: tenant.workspaceId,
    subjectId: auth.session.subject,
    role: tenant.role,
    email: auth.session.email,
  };
}

export async function GET(req: Request) {
  const auth = await requireWorkspace(req);
  if (!auth.ok) return auth.res;
  try {
    if (!auth.tenant) throw new TenantStoreRequiredError(tenantStoreNoticeText());
    const ctx = seatContext(auth, auth.tenant);
    const seats = await seatSummary(tenantSqlClient(), ctx);
    return NextResponse.json({ seats });
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  const auth = await requireWorkspace(req);
  if (!auth.ok) return auth.res;
  try {
    if (!auth.tenant) throw new TenantStoreRequiredError(tenantStoreNoticeText());
    const ctx = seatContext(auth, auth.tenant);

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return badRequest("invalid request body: expected JSON");
    }
    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (!email) return badRequest("email is required");
    const role = body.role;
    if (role !== undefined && role !== "member" && role !== "admin" && role !== "owner") {
      return badRequest("role must be member, admin or owner");
    }

    const invite = await createInvite(
      tenantSqlClient(),
      ctx,
      email,
      role as MemberRole | undefined,
    );
    return NextResponse.json({ invite }, { status: 201 });
  } catch (e) {
    return serverError(e);
  }
}
