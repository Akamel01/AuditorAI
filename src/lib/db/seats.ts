// The seat and invitation service (ticket #54, M8).
import { pendingSubjectFor } from "@/domain/actor";
import type { MemberRole } from "./claim";
import { NotWorkspaceAdminError, SeatLimitExceededError } from "./errors";
import { claimsJson } from "./identity";
import type { SqlClient } from "./sql";

export const INVITE_TTL_DAYS = 14;

export interface SeatContext {
  workspaceId: string;
  subjectId: string;
  role: MemberRole | null;
  email: string | null;
}

export interface SeatMember {
  subjectId: string;
  role: MemberRole;
  status: string;
  email: string | null;
}

export interface SeatSummary {
  workspaceId: string;
  seatCount: number;
  usedSeats: number;
  members: SeatMember[];
  pendingInvites: { email: string; role: string; expiresAt: string | null }[];
}

export interface InviteResult {
  workspaceId: string;
  email: string;
  role: MemberRole;
  expiresAt: string;
}

export function seatsUsed(activeCount: number, pendingCount: number): number {
  return activeCount + pendingCount;
}

export function canInvite(activeCount: number, pendingCount: number, seatCount: number): boolean {
  return activeCount + pendingCount < seatCount;
}

interface WorkspaceRow { seat_count: number; }
interface MemberRow {
  subject_id: string; role: MemberRole; status: string; email: string | null; expires_at: Date | string | null;
}

function toIso(v: Date | string | null): string | null {
  if (v === null) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}

function claim(ctx: SeatContext): string {
  return claimsJson(ctx.subjectId, ctx.workspaceId, ctx.role, ctx.email);
}

export async function seatSummary(client: SqlClient, ctx: SeatContext): Promise<SeatSummary> {
  return client.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claims', $1, true)", [claim(ctx)]);
    const wsRes = await tx.query<WorkspaceRow>(
      "select seat_count from public.workspaces where id = $1",
      [ctx.workspaceId],
    );
    const seatCount = wsRes.rows[0]?.seat_count ?? 0;

    const memRes = await tx.query<MemberRow>(
      "select subject_id, role, status, email from public.workspace_members where workspace_id = $1 order by subject_id",
      [ctx.workspaceId],
    );
    const members: SeatMember[] = memRes.rows.map((r) => ({
      subjectId: r.subject_id, role: r.role, status: r.status, email: r.email,
    }));

    const activeRes = await tx.query<{ c: number }>(
      "select count(*)::int as c from public.workspace_members where workspace_id = $1 and status = 'active'",
      [ctx.workspaceId],
    );
    const activeCount = activeRes.rows[0]?.c ?? 0;

    const pendingRes = await tx.query<{ c: number }>(
      "select count(*)::int as c from public.workspace_members where workspace_id = $1 and status = 'pending' and expires_at > now()",
      [ctx.workspaceId],
    );
    const pendingCount = pendingRes.rows[0]?.c ?? 0;

    const invitesRes = await tx.query<{ email: string | null; role: string; expires_at: Date | string | null }>(
      "select email, role, expires_at from public.workspace_members where workspace_id = $1 and status = 'pending' order by email",
      [ctx.workspaceId],
    );
    const pendingInvites = invitesRes.rows.map((r) => ({
      email: r.email ?? "", role: r.role, expiresAt: toIso(r.expires_at),
    }));

    return {
      workspaceId: ctx.workspaceId,
      seatCount,
      usedSeats: seatsUsed(activeCount, pendingCount),
      members,
      pendingInvites,
    };
  });
}

export async function createInvite(
  client: SqlClient,
  ctx: SeatContext,
  email: string,
  role?: MemberRole,
): Promise<InviteResult> {
  const granted: MemberRole = role ?? "member";

  if (ctx.role !== "owner" && ctx.role !== "admin") throw new NotWorkspaceAdminError();
  if (granted === "owner") throw new NotWorkspaceAdminError();
  if (ctx.role === "admin" && granted !== "member") throw new NotWorkspaceAdminError();
  if (ctx.role === "owner" && granted !== "member" && granted !== "admin") throw new NotWorkspaceAdminError();

  return client.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claims', $1, true)", [claim(ctx)]);

    const activeRes = await tx.query<{ c: number }>(
      "select count(*)::int as c from public.workspace_members where workspace_id = $1 and status = 'active'",
      [ctx.workspaceId],
    );
    const pendingRes = await tx.query<{ c: number }>(
      "select count(*)::int as c from public.workspace_members where workspace_id = $1 and status = 'pending' and expires_at > now()",
      [ctx.workspaceId],
    );
    const activeCount = activeRes.rows[0]?.c ?? 0;
    const pendingCount = pendingRes.rows[0]?.c ?? 0;

    const wsRes = await tx.query<WorkspaceRow>(
      "select seat_count from public.workspaces where id = $1",
      [ctx.workspaceId],
    );
    const seatCount = wsRes.rows[0]?.seat_count ?? 0;

    if (!canInvite(activeCount, pendingCount, seatCount)) {
      throw new SeatLimitExceededError();
    }

    const subject = pendingSubjectFor(email);
    const res = await tx.query<{ expires_at: Date | string }>(
      `insert into public.workspace_members
         (workspace_id, subject_id, role, status, email, invited_by, expires_at)
       values ($1, $2, $3, 'pending', $4, $5, now() + make_interval(days => $6::int))
       on conflict (workspace_id, email) where status = 'pending'
       do update set role = excluded.role,
                     invited_by = excluded.invited_by,
                     expires_at = excluded.expires_at,
                     status = 'pending'
       returning expires_at`,
      [ctx.workspaceId, subject, granted, email, ctx.subjectId, INVITE_TTL_DAYS],
    );
    const expiresAt = toIso(res.rows[0]?.expires_at) ?? "";

    return { workspaceId: ctx.workspaceId, email, role: granted, expiresAt };
  });
}

export async function acceptPendingInvite(
  client: SqlClient,
  subject: string,
  email: string,
): Promise<{ workspaceId: string } | null> {
  return client.transaction(async (tx) => {
    const found = await tx.query<{ workspace_id: string; expires_at: Date | string | null }>(
      "select workspace_id, expires_at from public.workspace_members where email = $1 and status = 'pending'",
      [email],
    );
    const row = found.rows[0];
    if (!row) return null;
    if (row.expires_at) {
      const exp = row.expires_at instanceof Date ? row.expires_at : new Date(row.expires_at);
      if (exp.getTime() <= Date.now()) return null;
    }
    const ws = row.workspace_id;

    await tx.query("select set_config('request.jwt.claims', $1, true)", [
      claimsJson(subject, ws, null, email),
    ]);

    const upd = await tx.query<{ workspace_id: string }>(
      `update public.workspace_members
          set subject_id = $1, status = 'active', accepted_at = now(), expires_at = null
        where workspace_id = $2 and email = $3 and status = 'pending'
          and expires_at > now()
        returning workspace_id`,
      [subject, ws, email],
    );
    if (!upd.rows.length) return null;
    return { workspaceId: ws };
  });
}

export async function findMembershipByEmail(
  client: SqlClient,
  email: string,
): Promise<{ workspaceId: string; status: string; role: MemberRole } | null> {
  return client.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claims', $1, true)", [
      claimsJson("lookup", "", null, email),
    ]);
    const res = await tx.query<{ workspace_id: string; status: string; role: MemberRole }>(
      "select workspace_id, status, role from public.workspace_members where email = $1",
      [email],
    );
    const r = res.rows[0];
    if (!r) return null;
    return { workspaceId: r.workspace_id, status: r.status, role: r.role };
  });
}
