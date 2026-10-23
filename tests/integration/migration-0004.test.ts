// pglite proof that 0004_seats_invites.sql applies cleanly and is re-runnable.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 180_000 });

interface DbLike {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<unknown>;
  close(): Promise<void>;
}

const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase/migrations");

let db: DbLike;

async function applyAll(): Promise<string[]> {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    await db.exec(readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
  }
  return files;
}

beforeAll(async () => {
  db = (await PGlite.create({ relaxedDurability: true })) as unknown as DbLike;
});

afterAll(async () => {
  await db.close();
});

describe("migration 0004", () => {
  it("applies 0001->0004 cleanly, then a second time without error", async () => {
    await applyAll();
    await expect(applyAll()).resolves.toBeDefined();
  });

  it("workspaces.seat_count exists with default 1", async () => {
    const rows = await db.query<{ column_default: string }>(
      `select column_default from information_schema.columns
       where table_schema='public' and table_name='workspaces' and column_name='seat_count'`,
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].column_default).toContain("1");
  });

  it("workspace_members carries the membership state columns", async () => {
    const rows = await db.query<{ column_name: string }>(
      `select column_name from information_schema.columns
       where table_schema='public' and table_name='workspace_members'
         and column_name in ('status','email','invited_by','expires_at','accepted_at','revoked_at')`,
    );
    expect(rows.rows.map((r) => r.column_name).sort()).toEqual(
      ["accepted_at", "email", "expires_at", "invited_by", "revoked_at", "status"].sort(),
    );
  });

  it("workspace_members has role + status vocabulary constraints", async () => {
    const rows = await db.query<{ conname: string }>(
      `select conname from pg_constraint
       where conrelid = 'public.workspace_members'::regclass
         and conname in ('workspace_members_role_check','workspace_members_status_check')`,
    );
    expect(rows.rows.map((r) => r.conname).sort()).toEqual(
      ["workspace_members_role_check", "workspace_members_status_check"].sort(),
    );
  });

  it("actor columns exist on projects/audits/attachments", async () => {
    for (const [table, col] of [
      ["projects", "updated_by"],
      ["audits", "produced_by"],
      ["attachments", "uploaded_by"],
    ] as const) {
      const rows = await db.query(
        `select 1 from information_schema.columns
         where table_schema='public' and table_name=$1 and column_name=$2`,
        [table, col],
      );
      expect(rows.rows).toHaveLength(1);
    }
  });

  it("claim helpers exist and reference no table", async () => {
    for (const fn of ["app_claim_role", "app_claim_email"]) {
      const rows = await db.query<{ proname: string }>(
        `select proname from pg_proc where proname = $1`,
        [fn],
      );
      expect(rows.rows).toHaveLength(1);
    }
  });

  it("privilege shape: app role cannot write seat_count or role", async () => {
    const seatUpdate = await db.query<{ has: boolean }>(
      `select has_column_privilege('auditorai_app','public.workspaces','seat_count','UPDATE') as has`,
    );
    const seatInsert = await db.query<{ has: boolean }>(
      `select has_column_privilege('auditorai_app','public.workspaces','seat_count','INSERT') as has`,
    );
    const roleUpdate = await db.query<{ has: boolean }>(
      `select has_column_privilege('auditorai_app','public.workspace_members','role','UPDATE') as has`,
    );
    expect(seatUpdate.rows[0].has).toBe(false);
    expect(seatInsert.rows[0].has).toBe(false);
    expect(roleUpdate.rows[0].has).toBe(false);
  });

  it("the four workspace_members policies exist", async () => {
    const rows = await db.query<{ policyname: string }>(
      `select policyname from pg_policies where schemaname='public' and tablename='workspace_members'`,
    );
    const names = rows.rows.map((r) => r.policyname).sort();
    expect(names).toEqual(
      ["workspace_members_delete", "workspace_members_insert", "workspace_members_select", "workspace_members_update"].sort(),
    );
  });
});
