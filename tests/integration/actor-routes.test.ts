// M6 — a signed-in issuance records u:<sub>; a workspace-key-only caller
// records legacy:<16-hex>. Runs the REAL routes against an in-process Postgres
// with the real migrations and the auditorai_app role (RLS on).
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { POST as createProject } from "@/app/api/projects/route";
import { GET as seatsRoute, POST as inviteRoute } from "@/app/api/workspaces/seats/route";
import { createPgliteSqlClient, type PgliteLike } from "@/lib/db/pglite-client";
import { setSqlClientForTests } from "@/lib/db/sql";
import { MemoryStore, setDataStoreForTests, workspaceHash } from "@/lib/persistence/store";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 180_000 });

const WS = "33333333-3333-3333-3333-333333333333";
const KEY = "actor-route-workspace-key-0123456789";
const SUBJECT = "user-subject-123";
const EMAIL = "member@example.com";
const JWT_SECRET = "actor-route-jwt-secret";
const SUPABASE_URL = "https://example.supabase.co";

let db: PGlite;
let client: ReturnType<typeof createPgliteSqlClient>;

function mintToken(sub: string, email: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      sub,
      email,
      aud: "authenticated",
      iss: `${SUPABASE_URL}/auth/v1`,
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ).toString("base64url");
  const sig = createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

function headers(withSession: boolean): Record<string, string> {
  const h: Record<string, string> = {
    "x-workspace-key": KEY,
    "content-type": "application/json",
  };
  if (withSession) {
    const token = mintToken(SUBJECT, EMAIL);
    h.cookie = `auditorai.session=${token}; auditorai.refresh=refresh-token`;
  }
  return h;
}

function projectRequest(withSession: boolean): Request {
  return new Request("http://local/api/projects", {
    method: "POST",
    headers: headers(withSession),
    body: JSON.stringify({
      name: "Actor provenance project",
      jurisdiction: "UK",
      native_stage_id: "uk:S2",
    }),
  });
}

async function seed(): Promise<void> {
  await db.exec("truncate public.projects, public.workspace_members, public.workspace_credentials, public.workspaces cascade");
  await db.query(
    `insert into public.workspaces (id, name, seat_count, legacy_key_hash)
     values ($1, 'actor workspace', 5, $2)`,
    [WS, workspaceHash(KEY)],
  );
  await db.query(
    `insert into public.workspace_members (workspace_id, subject_id, role, status, email, accepted_at)
     values ($1, $2, 'owner', 'active', $3, now()),
            ($1, 'subject-other', 'member', 'active', 'other@example.com', now())`,
    [WS, SUBJECT, EMAIL],
  );
  await db.query(
    `insert into public.workspace_credentials (credential_hash, workspace_id, subject_id)
     values ($1, $2, $3)`,
    [workspaceHash(KEY), WS, SUBJECT],
  );
}

beforeAll(async () => {
  process.env.SUPABASE_URL = SUPABASE_URL;
  process.env.SUPABASE_JWT_SECRET = JWT_SECRET;
  process.env.TENANT_STORE = "postgres";
  db = new PGlite();
  const dir = path.join(process.cwd(), "supabase", "migrations");
  for (const file of readdirSync(dir).sort()) {
    await db.exec(readFileSync(path.join(dir, file), "utf8"));
  }
  client = createPgliteSqlClient(db as unknown as PgliteLike);
});

afterAll(async () => {
  setSqlClientForTests(null);
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_JWT_SECRET;
  delete process.env.TENANT_STORE;
  await db.close();
});

beforeEach(async () => {
  await seed();
  setSqlClientForTests(client);
  setDataStoreForTests(new MemoryStore());
});

describe("actor provenance on a mutation (AC6/AC7)", () => {
  it("a signed-in issuance records u:<sub> as the actor", async () => {
    const res = await createProject(projectRequest(true));
    expect(res.status).toBe(201);
    const body = (await res.json()) as { project: { project_id: string; updated_by?: string } };
    expect(body.project.updated_by).toBe(`u:${SUBJECT}`);

    const row = await db.query<{ updated_by: string | null }>(
      "select updated_by from public.projects where workspace_id = $1 and project_id = $2",
      [WS, body.project.project_id],
    );
    expect(row.rows[0]?.updated_by).toBe(`u:${SUBJECT}`);
  });

  it("a workspace-key-only caller records legacy:<16-hex>, never the constant", async () => {
    setSqlClientForTests(null);
    delete process.env.TENANT_STORE;

    const res = await createProject(projectRequest(false));
    expect(res.status).toBe(201);
    const body = (await res.json()) as { project: { updated_by?: string } };
    expect(body.project.updated_by).toBe(`legacy:${workspaceHash(KEY)}`);
    expect(body.project.updated_by).not.toBe("auditor");
  });
});

function seatsRequest(session: boolean, method: string, body?: unknown): Request {
  return new Request("http://local/api/workspaces/seats", {
    method,
    headers: headers(session),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("the seats surface is wired to the service (G-1)", () => {
  it("GET returns the workspace's seat summary for a signed-in member", async () => {
    const res = await seatsRoute(seatsRequest(true, "GET"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      seats: { seatCount: number; usedSeats: number; members: { subjectId: string }[] };
    };
    expect(body.seats.seatCount).toBe(5);
    expect(body.seats.usedSeats).toBe(2);
    expect(body.seats.members.map((m) => m.subjectId)).toContain(SUBJECT);
  });

  it("GET requires a signed-in identity", async () => {
    const res = await seatsRoute(seatsRequest(false, "GET"));
    expect(res.status).toBe(401);
  });

  it("POST invites a person and enforces the seat limit at invite", async () => {
    const invited = await inviteRoute(
      seatsRequest(true, "POST", { email: "New.Person@Example.COM", role: "member" }),
    );
    expect(invited.status).toBe(201);
    const body = (await invited.json()) as { invite: { email: string; expiresAt: string } };
    expect(body.invite.email).toBe("new.person@example.com");

    const row = await db.query<{ status: string }>(
      "select status from public.workspace_members where workspace_id = $1 and email = $2",
      [WS, "new.person@example.com"],
    );
    expect(row.rows[0]?.status).toBe("pending");
  });

  it("POST never grants owner", async () => {
    const res = await inviteRoute(
      seatsRequest(true, "POST", { email: "boss@example.com", role: "owner" }),
    );
    expect(res.status).toBe(403);
    expect(((await res.json()) as { error: string }).error).toBe("not a workspace admin");
  });

  it("POST refuses an invite beyond seat_count with 409", async () => {
    await db.query("update public.workspaces set seat_count = 2 where id = $1", [WS]);
    const res = await inviteRoute(
      seatsRequest(true, "POST", { email: "overflow@example.com" }),
    );
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toBe("seat limit exceeded");
  });
});
