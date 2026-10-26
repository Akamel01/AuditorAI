// M8 — the seat and invitation service, proven against an in-process Postgres
// with the real migrations and the real `auditorai_app` role (RLS on).
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createPgliteSqlClient, type PgliteLike } from "@/lib/db/pglite-client";
import { setSqlClientForTests } from "@/lib/db/sql";
import {
  INVITE_TTL_DAYS,
  acceptPendingInvite,
  canInvite,
  createInvite,
  findMembershipByEmail,
  listMembershipsByEmail,
  normalizeEmail,
  seatSummary,
  seatsUsed,
  type SeatContext,
} from "@/lib/db/seats";
import {
  AmbiguousInvitationError,
  NotWorkspaceAdminError,
  SeatLimitExceededError,
} from "@/lib/db/errors";
import { pendingSubjectFor } from "@/domain/actor";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 180_000 });

const WS_A = "11111111-1111-1111-1111-111111111111";
const WS_B = "22222222-2222-2222-2222-222222222222";

const OWNER = "subject-owner";
const ADMIN = "subject-admin";
const MEMBER = "subject-member";

const OWNER_CTX: SeatContext = {
  workspaceId: WS_A,
  subjectId: OWNER,
  role: "owner",
  email: "owner@a.test",
};
const ADMIN_CTX: SeatContext = {
  workspaceId: WS_B,
  subjectId: ADMIN,
  role: "admin",
  email: "admin@b.test",
};
const MEMBER_CTX: SeatContext = {
  workspaceId: WS_B,
  subjectId: MEMBER,
  role: "member",
  email: "member@b.test",
};

let db: PGlite;
let client: ReturnType<typeof createPgliteSqlClient>;

async function exec(sql: string, params?: unknown[]): Promise<void> {
  if (params) await db.query(sql, params);
  else await db.exec(sql);
}

async function seed(): Promise<void> {
  await db.exec("truncate public.workspace_members, public.workspace_credentials, public.workspaces cascade");
  await exec(
    `insert into public.workspaces (id, name, seat_count, legacy_key_hash) values
       ($1, 'workspace A', 2, 'aaaaaaaaaaaaaaaa'),
       ($2, 'workspace B', 3, 'bbbbbbbbbbbbbbbb')`,
    [WS_A, WS_B],
  );
  await exec(
    `insert into public.workspace_members
       (workspace_id, subject_id, role, status, email, accepted_at) values
       ($1, $2, 'owner',  'active', 'owner@a.test',  now()),
       ($3, $4, 'admin',  'active', 'admin@b.test',  now()),
       ($3, $5, 'member', 'active', 'member@b.test', now())`,
    [WS_A, OWNER, WS_B, ADMIN, MEMBER],
  );
}

async function countPending(email: string): Promise<number> {
  const res = await db.query<{ c: number }>(
    "select count(*)::int as c from public.workspace_members where lower(email) = $1 and status = 'pending'",
    [email],
  );
  return res.rows[0]?.c ?? 0;
}

beforeAll(async () => {
  db = new PGlite();
  const dir = path.join(process.cwd(), "supabase", "migrations");
  for (const file of readdirSync(dir).sort()) {
    await db.exec(readFileSync(path.join(dir, file), "utf8"));
  }
  client = createPgliteSqlClient(db as unknown as PgliteLike);
});

afterAll(async () => {
  setSqlClientForTests(null);
  await db.close();
});

beforeEach(async () => {
  await seed();
  setSqlClientForTests(client);
});

describe("seat arithmetic (pure)", () => {
  it("INVITE_TTL_DAYS is the exported 14-day constant", () => {
    expect(INVITE_TTL_DAYS).toBe(14);
  });

  it("seatsUsed sums active + pending; canInvite is strict about the limit", () => {
    expect(seatsUsed(2, 1)).toBe(3);
    expect(seatsUsed(0, 0)).toBe(0);
    expect(canInvite(1, 0, 3)).toBe(true);
    expect(canInvite(2, 1, 3)).toBe(false);
    expect(canInvite(3, 0, 3)).toBe(false);
  });

  it("normalizeEmail trims and lower-cases", () => {
    expect(normalizeEmail("  Ada@Example.COM ")).toBe("ada@example.com");
  });
});

describe("seat summary (RLS, per workspace)", () => {
  it("counts an active member and reports the workspace's own list", async () => {
    const summary = await seatSummary(client, OWNER_CTX);
    expect(summary.seatCount).toBe(2);
    expect(summary.usedSeats).toBe(1);
    expect(summary.members.map((m) => m.subjectId)).toEqual([OWNER]);
  });

  it("an expired pending invitation and a revoked member hold no seat", async () => {
    await exec(
      `insert into public.workspace_members
         (workspace_id, subject_id, role, status, email, expires_at) values
         ($1, $2, 'member', 'pending', 'expired@a.test', now() - interval '1 day'),
         ($1, $3, 'member', 'revoked', 'revoked@a.test', null)`,
      [WS_A, pendingSubjectFor("expired@a.test"), pendingSubjectFor("revoked@a.test")],
    );
    const summary = await seatSummary(client, OWNER_CTX);
    expect(summary.usedSeats).toBe(1);
  });

  it("a member of another workspace sees a different member list (AC17)", async () => {
    const a = await seatSummary(client, OWNER_CTX);
    const b = await seatSummary(client, ADMIN_CTX);
    expect(a.members.map((m) => m.subjectId)).toEqual([OWNER]);
    expect(b.members.map((m) => m.subjectId).sort()).toEqual([ADMIN, MEMBER]);
  });
});

describe("createInvite", () => {
  it("writes a pending row with the 14-day TTL and a lower-cased email", async () => {
    const before = Date.now();
    const invite = await createInvite(client, OWNER_CTX, "  New.Person@Example.COM ");
    expect(invite.email).toBe("new.person@example.com");
    expect(invite.role).toBe("member");
    expect(invite.workspaceId).toBe(WS_A);

    const row = await db.query<{ subject_id: string; expires_at: string; invited_by: string }>(
      "select subject_id, expires_at, invited_by from public.workspace_members where workspace_id = $1 and email = $2",
      [WS_A, "new.person@example.com"],
    );
    expect(row.rows[0]?.subject_id).toBe(pendingSubjectFor("new.person@example.com"));
    expect(row.rows[0]?.invited_by).toBe(OWNER);
    const expires = new Date(row.rows[0]!.expires_at).getTime();
    const expected = before + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000;
    expect(Math.abs(expires - expected)).toBeLessThan(5 * 60 * 1000);

    const summary = await seatSummary(client, OWNER_CTX);
    expect(summary.usedSeats).toBe(2);
  });

  it("refuses an invite that would exceed seat_count (AC12)", async () => {
    await createInvite(client, OWNER_CTX, "first@example.com");
    await expect(createInvite(client, OWNER_CTX, "second@example.com")).rejects.toBeInstanceOf(
      SeatLimitExceededError,
    );
    expect(await countPending("second@example.com")).toBe(0);
  });

  it("a re-invite of the same email updates the row instead of consuming a second seat", async () => {
    await createInvite(client, OWNER_CTX, "again@example.com");
    const first = await db.query<{ expires_at: string }>(
      "select expires_at from public.workspace_members where workspace_id = $1 and email = $2",
      [WS_A, "again@example.com"],
    );
    await new Promise((r) => setTimeout(r, 10));
    await createInvite(client, OWNER_CTX, "AGAIN@example.com");
    const rows = await db.query<{ expires_at: string }>(
      "select expires_at from public.workspace_members where workspace_id = $1 and lower(email) = $2",
      [WS_A, "again@example.com"],
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]!.expires_at).not.toBe(first.rows[0]!.expires_at);
    const summary = await seatSummary(client, OWNER_CTX);
    expect(summary.usedSeats).toBe(2);
  });

  it("enforces the role matrix: member cannot invite, admin grants member only, nobody grants owner", async () => {
    await expect(createInvite(client, MEMBER_CTX, "x@example.com")).rejects.toBeInstanceOf(
      NotWorkspaceAdminError,
    );
    await expect(
      createInvite(client, ADMIN_CTX, "admin-invite@example.com", "admin"),
    ).rejects.toBeInstanceOf(NotWorkspaceAdminError);
    await expect(
      createInvite(client, OWNER_CTX, "owner-invite@example.com", "owner"),
    ).rejects.toBeInstanceOf(NotWorkspaceAdminError);

    const ok = await createInvite(client, ADMIN_CTX, "member-invite@example.com", "member");
    expect(ok.role).toBe("member");
    const ownerGrantsAdmin = await createInvite(client, OWNER_CTX, "granted-admin@example.com", "admin");
    expect(ownerGrantsAdmin.role).toBe("admin");
  });
});

describe("acceptPendingInvite", () => {
  it("binds the pending invitation even though the first SELECT is email-claim only", async () => {
    await createInvite(client, OWNER_CTX, "Invitee@Example.COM");
    const before = await db.query<{ status: string }>(
      "select status from public.workspace_members where workspace_id = $1 and email = $2",
      [WS_A, "invitee@example.com"],
    );
    expect(before.rows[0]?.status).toBe("pending");

    const accepted = await acceptPendingInvite(client, "subject-invitee", "invitee@example.com");
    expect(accepted).toEqual({ workspaceId: WS_A });

    const row = await db.query<{
      subject_id: string; status: string; accepted_at: string | null; expires_at: string | null;
    }>(
      "select subject_id, status, accepted_at, expires_at from public.workspace_members where workspace_id = $1 and email = $2",
      [WS_A, "invitee@example.com"],
    );
    expect(row.rows[0]?.subject_id).toBe("subject-invitee");
    expect(row.rows[0]?.status).toBe("active");
    expect(row.rows[0]?.accepted_at).not.toBeNull();
    expect(row.rows[0]?.expires_at).toBeNull();

    const summary = await seatSummary(client, OWNER_CTX);
    expect(summary.usedSeats).toBe(2);
  });

  it("refuses silently taking rows[0] when the email has invitations in several workspaces", async () => {
    await createInvite(client, OWNER_CTX, "multi@example.com");
    await createInvite(client, ADMIN_CTX, "multi@example.com");

    await expect(
      acceptPendingInvite(client, "subject-multi", "multi@example.com"),
    ).rejects.toBeInstanceOf(AmbiguousInvitationError);

    const chosen = await acceptPendingInvite(client, "subject-multi", "multi@example.com", WS_B);
    expect(chosen).toEqual({ workspaceId: WS_B });
    const left = await db.query<{ status: string }>(
      "select status from public.workspace_members where workspace_id = $1 and email = $2",
      [WS_A, "multi@example.com"],
    );
    expect(left.rows[0]?.status).toBe("pending");
  });

  it("cannot accept an expired invitation", async () => {
    await exec(
      `insert into public.workspace_members
         (workspace_id, subject_id, role, status, email, expires_at)
       values ($1, $2, 'member', 'pending', 'late@example.com', now() - interval '1 minute')`,
      [WS_A, pendingSubjectFor("late@example.com")],
    );
    expect(await acceptPendingInvite(client, "subject-late", "late@example.com")).toBeNull();
  });

  it("returns null when there is no invitation at all", async () => {
    expect(await acceptPendingInvite(client, "subject-none", "none@example.com")).toBeNull();
  });
});

describe("membership lookup", () => {
  it("lists the caller's own rows only and picks an explicit workspace", async () => {
    await createInvite(client, OWNER_CTX, "Multi@Example.com");
    await createInvite(client, ADMIN_CTX, "multi@example.com");

    const rows = await listMembershipsByEmail(client, "MULTI@example.com");
    expect(rows.map((r) => r.workspaceId).sort()).toEqual([WS_A, WS_B].sort());
    expect(rows.every((r) => r.status === "pending")).toBe(true);

    expect(await findMembershipByEmail(client, "multi@example.com")).toBeNull();
    expect((await findMembershipByEmail(client, "multi@example.com", WS_A))?.workspaceId).toBe(WS_A);
  });

  it("does not expose another member's row by email", async () => {
    const rows = await listMembershipsByEmail(client, "owner@a.test");
    expect(rows.map((r) => r.workspaceId)).toEqual([WS_A]);
    expect(rows[0]?.status).toBe("active");
  });
});

describe("privilege shape (AC16)", () => {
  it("the app role may read seat_count but never write it", async () => {
    const res = await db.query<{ upd: boolean; ins: boolean }>(
      `select has_column_privilege('auditorai_app','public.workspaces','seat_count','UPDATE') as upd,
              has_column_privilege('auditorai_app','public.workspaces','seat_count','INSERT') as ins`,
    );
    expect(res.rows[0]).toEqual({ upd: false, ins: false });
  });
});
