// The seat and invitation service (ticket #54, M8).
import { pendingSubjectFor } from "@/domain/actor";
import type { MemberRole } from "./claim";
import {
  AmbiguousInvitationError,
  NotWorkspaceAdminError,
  SeatLimitExceededError,
} from "./errors";
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

export interface EmailMembership {
  workspaceId: string;
  status: string;
  role: MemberRole;
  expiresAt: string | null;
}

/** The one email normalisation every invite, acceptance and lookup uses. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
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

function isExpired(v: Date | string | null, now = Date.now()): boolean {
  if (v === null) return false;
  const ms = v instanceof Date ? v.getTime() : new Date(v).getTime();
  return Number.isFinite(ms) && ms <= now;
}

/** Active members plus pending, unexpired invitations. A revoked member and an
 *  expired invitation hold no seat (OD20-N9). */
async function usedSeats(tx: SqlClient, workspaceId: string): Promise<{ active: number; pending: number }> {
  const activeRes = await tx.query<{ c: number }>(
    "select count(*)::int as c from public.workspace_members where workspace_id = $1 and status = 'active'",
    [workspaceId],
  );
  const pendingRes = await tx.query<{ c: number }>(
    "select count(*)::int as c from public.workspace_members where workspace_id = $1 and status = 'pending' and expires_at > now()",
    [workspaceId],
  );
  return { active: activeRes.rows[0]?.c ?? 0, pending: pendingRes.rows[0]?.c ?? 0 };
}

export async function seatSummary(client: SqlClient, ctx: SeatContext): Promise<SeatSummary> {
  return client.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claims', $1, true)", [
      claimsJson(ctx.subjectId, ctx.workspaceId, ctx.role, ctx.email),
    ]);
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

    const counts = await usedSeats(tx, ctx.workspaceId);

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
      usedSeats: seatsUsed(counts.active, counts.pending),
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
  const normalized = normalizeEmail(email);
  const granted: MemberRole = role ?? "member";

  if (ctx.role !== "owner" && ctx.role !== "admin") throw new NotWorkspaceAdminError();
  if (granted === "owner") throw new NotWorkspaceAdminError();
  if (ctx.role === "admin" && granted !== "member") throw new NotWorkspaceAdminError();
  if (ctx.role === "owner" && granted !== "member" && granted !== "admin") throw new NotWorkspaceAdminError();

  return client.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claims', $1, true)", [
      claimsJson(ctx.subjectId, ctx.workspaceId, ctx.role, ctx.email),
    ]);

    // Lock the workspace row for the whole transaction: two concurrent
    // invites serialise here, so the count-then-insert cannot both pass.
    const wsRes = await tx.query<WorkspaceRow>(
      "select seat_count from public.workspaces where id = $1 for update",
      [ctx.workspaceId],
    );
    const seatCount = wsRes.rows[0]?.seat_count ?? 0;
    const counts = await usedSeats(tx, ctx.workspaceId);

    // Re-inviting the same email refreshes the existing pending row; it does
    // not consume a second seat, so the limit does not block the refresh.
    const existing = await tx.query<{ one: number }>(
      "select 1 as one from public.workspace_members where workspace_id = $1 and email = $2 and status = 'pending'",
      [ctx.workspaceId, normalized],
    );
    if (!existing.rows.length && !canInvite(counts.active, counts.pending, seatCount)) {
      throw new SeatLimitExceededError();
    }

    const subject = pendingSubjectFor(normalized);
    const res = await tx.query<{ expires_at: Date | string }>(
      `insert into public.workspace_members
         (workspace_id, subject_id, role, status, email, invited_by, expires_at)
       values ($1, $2, $3, 'pending', $4, $5, now() + make_interval(days => $6::int))
       on conflict (workspace_id, email) where status = 'pending'
       do update set invited_by = excluded.invited_by,
                     expires_at = excluded.expires_at,
                     status = 'pending'
       returning expires_at`,
      [ctx.workspaceId, subject, granted, normalized, ctx.subjectId, INVITE_TTL_DAYS],
    );
    const expiresAt = toIso(res.rows[0]?.expires_at) ?? "";

    return { workspaceId: ctx.workspaceId, email: normalized, role: granted, expiresAt };
  });
}

/** Bind a pending invitation to the signed-in subject. The caller MUST pass
 *  the verified email; `subject` is the signed-in user's id. When the email has
 *  pending invitations in several workspaces, `workspaceId` chooses the one the
 *  user picked — otherwise the call refuses instead of taking the first row. */
export async function acceptPendingInvite(
  client: SqlClient,
  subject: string,
  email: string,
  workspaceId?: string,
): Promise<{ workspaceId: string } | null> {
  const normalized = normalizeEmail(email);
  return client.transaction(async (tx) => {
    // The email claim must be present BEFORE the SELECT: the 0004 select policy
    // exposes only own-workspace rows or the caller's own invitation, so a bare
    // SELECT finds nothing.
    await tx.query("select set_config('request.jwt.claims', $1, true)", [
      claimsJson("", "", null, normalized),
    ]);

    const found = await tx.query<{ workspace_id: string; expires_at: Date | string | null }>(
      `select workspace_id, expires_at from public.workspace_members
        where email = $1 and status = 'pending'
        order by workspace_id`,
      [normalized],
    );
    const live = found.rows.filter((r) => !isExpired(r.expires_at));
    if (!live.length) return null;

    const chosen = workspaceId
      ? live.find((r) => r.workspace_id === workspaceId)
      : live.length === 1
        ? live[0]
        : null;
    if (!chosen) {
      if (live.length > 1) throw new AmbiguousInvitationError();
      return null;
    }

    await tx.query("select set_config('request.jwt.claims', $1, true)", [
      claimsJson(subject, chosen.workspace_id, null, normalized),
    ]);

    const upd = await tx.query<{ workspace_id: string }>(
      `update public.workspace_members
          set subject_id = $1, status = 'active', accepted_at = now(), expires_at = null
        where workspace_id = $2 and email = $3 and status = 'pending'
          and expires_at > now()
        returning workspace_id`,
      [subject, chosen.workspace_id, normalized],
    );
    if (!upd.rows.length) return null;
    return { workspaceId: chosen.workspace_id };
  });
}

/** Every membership row the caller's verified email owns (any status). The
 *  0004 select policy exposes the caller's own rows; this is what makes a
 *  returning member sign-in resolvable. */
export async function listMembershipsByEmail(
  client: SqlClient,
  email: string,
): Promise<EmailMembership[]> {
  const normalized = normalizeEmail(email);
  return client.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claims', $1, true)", [
      claimsJson("", "", null, normalized),
    ]);
    const res = await tx.query<{
      workspace_id: string; status: string; role: MemberRole; expires_at: Date | string | null;
    }>(
      `select workspace_id, status, role, expires_at from public.workspace_members
        where email = $1 order by workspace_id`,
      [normalized],
    );
    return res.rows.map((r) => ({
      workspaceId: r.workspace_id,
      status: r.status,
      role: r.role,
      expiresAt: toIso(r.expires_at),
    }));
  });
}

/** The single membership for an email, or the membership in `workspaceId`
 *  when given. Returns null when the email owns no row or the row set is
 *  ambiguous and no workspace was named (never a silent rows[0]). */
export async function findMembershipByEmail(
  client: SqlClient,
  email: string,
  workspaceId?: string,
): Promise<EmailMembership | null> {
  const rows = await listMembershipsByEmail(client, email);
  if (workspaceId) return rows.find((r) => r.workspaceId === workspaceId) ?? null;
  return rows.length === 1 ? rows[0] : null;
}
