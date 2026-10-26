import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as getList } from "@/app/api/workspaces/audit-trail/route";
import { GET as getExport } from "@/app/api/workspaces/audit-trail/export/route";
import { MemoryStore, Repository, setDataStoreForTests, workspaceHash } from "@/lib/persistence";
import { setSqlClientForTests } from "@/lib/db/sql";
import * as Keys from "@/lib/persistence/keys";
import { verifyAuditTrailExport } from "@/domain/audit-trail";
import { AuditTrailTooLargeError } from "@/domain/audit-trail";
import { AuditTrailSigningNotConfiguredError } from "@/lib/audit-trail-signing";
import { serverError } from "@/lib/api";

const KEY_A = "audit-trail-routes-key-aaaaaaaaaaaaaaaa";
const KEY_B = "audit-trail-routes-key-bbbbbbbbbbbbbbbb";
const WS_A = workspaceHash(KEY_A);
const WS_B = workspaceHash(KEY_B);

let store: MemoryStore;
let repo: Repository;

beforeEach(() => {
  store = new MemoryStore();
  setDataStoreForTests(store);
  repo = new Repository(store);
  setSqlClientForTests(null);
  delete process.env.TENANT_STORE;
  delete process.env.TENANT_POSTGRES_URL;
  delete process.env.POSTGRES_URL;
  delete process.env.AUDIT_TRAIL_SIGNING_KEY;
});

afterEach(() => {
  setDataStoreForTests(null);
  setSqlClientForTests(null);
  delete process.env.TENANT_STORE;
  delete process.env.TENANT_POSTGRES_URL;
  delete process.env.POSTGRES_URL;
  delete process.env.AUDIT_TRAIL_SIGNING_KEY;
});

async function seed() {
  await repo.saveProject(WS_A, {
    project_id: "P-A",
    name: "Project A",
    jurisdiction: "UK",
    native_stage_id: "uk:S1",
    canonical_stages: ["PRELIMINARY_DESIGN"],
    updated_at: "2026-01-01T00:00:00.000Z",
  } as never);
  await repo.saveAudit(WS_A, {
    audit_id: "AUD-A",
    project_id: "P-A",
    jurisdiction: "UK",
    framework_name: "DMRB",
    native_stage_id: "uk:S1",
    native_stage_display_name: "Stage 1",
    canonical_stages: ["PRELIMINARY_DESIGN"],
    mapping_confidence: "authoritative",
    ran_at: "2026-01-02T00:00:00.000Z",
    input_manifest: [],
    findings: [],
    missing_information: [],
    audit_questions: [],
    limitations: [],
    odd_declaration_version: "1.0.1",
    odd_status: "in",
    odd_stamp: null,
    odd_floor_satisfied: null,
    disclaimer: "d",
  } as never);
  await repo.saveProject(WS_B, {
    project_id: "P-B",
    name: "Project B",
    jurisdiction: "UK",
    native_stage_id: "uk:S1",
    canonical_stages: ["PRELIMINARY_DESIGN"],
    updated_at: "2026-01-03T00:00:00.000Z",
  } as never);
}

function headers(key: string): Record<string, string> {
  return { "x-workspace-key": key };
}

describe("audit-trail routes", () => {
  it("returns 401 without x-workspace-key", async () => {
    await seed();
    const res = await getList(new Request("http://local/api/workspaces/audit-trail"));
    expect(res.status).toBe(401);
  });

  it("lists only this workspace's entries with verification", async () => {
    await seed();
    const res = await getList(new Request("http://local/api/workspaces/audit-trail", { headers: headers(KEY_A) }));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(["entries", "trail_starts_at", "verification", "workspace"].sort());
    expect(body.entries).toHaveLength(2);
    expect(body.verification.ok).toBe(true);
    expect(body.trail_starts_at).toBe(body.entries[0].recorded_at);
    // no extra keys
    expect(body.limit).toBeUndefined();
    expect(body.database_status).toBeUndefined();
  });

  it("lists only B's entry", async () => {
    await seed();
    const res = await getList(new Request("http://local/api/workspaces/audit-trail", { headers: headers(KEY_B) }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0].subject.id).toBe("P-B");
    expect(body.entries.some((e: { subject: { id: string } }) => e.subject.id === "P-A")).toBe(false);
  });

  it("export returns 503 when signing key unset", async () => {
    await seed();
    const res = await getExport(new Request("http://local/api/workspaces/audit-trail/export", { headers: headers(KEY_A) }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual({ error: "audit trail signing not configured" });
  });

  it("export returns 503 when signing key is blank", async () => {
    process.env.AUDIT_TRAIL_SIGNING_KEY = "   ";
    await seed();
    const res = await getExport(new Request("http://local/api/workspaces/audit-trail/export", { headers: headers(KEY_A) }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual({ error: "audit trail signing not configured" });
  });

  it("export returns signed attachment that verifies", async () => {
    process.env.AUDIT_TRAIL_SIGNING_KEY = "test-audit-trail-signing-key-0123456789";
    await seed();
    const res = await getExport(new Request("http://local/api/workspaces/audit-trail/export", { headers: headers(KEY_A) }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toMatch(/^attachment; filename="audit-trail-\d{4}-\d{2}-\d{2}\.json"$/);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const text = await res.text();
    const exported = JSON.parse(text);
    expect(exported.format).toBe("audit-trail/export@1");
    expect(exported.workspace).toBe(WS_A);
    expect(exported.exported_at).toBeTruthy();
    expect(exported.trail_starts_at).toBeTruthy();
    expect(exported.verification).toBeTruthy();
    expect(exported.entries).toHaveLength(2);
    expect(exported.signature).toEqual({
      alg: "hmac-sha256",
      key_id: expect.stringMatching(/^[0-9a-f]{8}$/),
      value: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    const key = process.env.AUDIT_TRAIL_SIGNING_KEY!;
    const vr = verifyAuditTrailExport(exported, key);
    expect(vr.ok).toBe(true);
  });

  it("export of tampered chain is 200, signed, chain_invalid", async () => {
    process.env.AUDIT_TRAIL_SIGNING_KEY = "test-audit-trail-signing-key-0123456789";
    await seed();
    const entries = await repo.listAuditTrail(WS_A);
    const forged = { ...entries[1], actor: "u:forged" } as never;
    await store.put(Keys.trailKey(WS_A, 2), forged);
    const res = await getExport(new Request("http://local/api/workspaces/audit-trail/export", { headers: headers(KEY_A) }));
    expect(res.status).toBe(200);
    const text = await res.text();
    const exported = JSON.parse(text);
    expect(exported.verification.ok).toBe(false);
    expect(exported.verification.reason).toBe("entry_hash_mismatch");
    expect(exported.verification.first_bad_seq).toBe(2);
    const key = process.env.AUDIT_TRAIL_SIGNING_KEY!;
    const vr = verifyAuditTrailExport(exported, key);
    expect(vr.ok).toBe(false);
    expect(vr.reason).toBe("chain_invalid");
    // no B entry
    expect(exported.entries.some((e: { subject?: { id?: string } }) => e.subject?.id === "P-B")).toBe(false);
  });

  it("export as workspace B contains only B entries", async () => {
    process.env.AUDIT_TRAIL_SIGNING_KEY = "test-audit-trail-signing-key-0123456789";
    await seed();
    const res = await getExport(new Request("http://local/api/workspaces/audit-trail/export", { headers: headers(KEY_B) }));
    expect(res.status).toBe(200);
    const text = await res.text();
    const exported = JSON.parse(text);
    expect(exported.workspace).toBe(WS_B);
    expect(exported.entries).toHaveLength(1);
    expect(exported.entries.every((e: { subject: { id: string } }) => e.subject.id === "P-B")).toBe(true);
    expect(exported.entries.some((e: { subject: { id: string } }) => e.subject.id === "P-A")).toBe(false);
    const key = process.env.AUDIT_TRAIL_SIGNING_KEY!;
    const vr = verifyAuditTrailExport(exported, key);
    expect(vr.ok).toBe(true);
  });

  it("maps AuditTrailTooLargeError to 413", () => {
    const res = serverError(new AuditTrailTooLargeError(20001, 20000));
    expect(res.status).toBe(413);
  });

  it("maps signing not configured to 503", () => {
    const res = serverError(new AuditTrailSigningNotConfiguredError());
    expect(res.status).toBe(503);
  });
});
