// The one-way, operator-gated, idempotent KV -> Postgres migration core
// (ticket #53, module M5). The CLI (scripts/migrate-kv-to-postgres.ts) is a
// thin wrapper over this file; the offline proof (M7) drives this file with a
// MemoryStore source and a pglite target.
//
// Five properties are load-bearing here:
//
//  1. THE SOURCE IS READ-ONLY. The migration enumerates and reads; it never
//     removes a key. The KV copy stays the rollback path (architecture §5.7).
//  2. ONE TRANSACTION PER WORKSPACE. A workspace flips from KV to Postgres at
//     the moment its credential row commits — there is no window in which both
//     stores serve it (architecture §5.3).
//  3. THE CREDENTIAL INSERT CARRIES ITS OWN RLS GATE. The credential policy is
//     `with check (credential_hash = public.app_claim_credential_hash())`, so
//     `request.credential_hash` MUST be set inside the SAME transaction,
//     immediately before the insert. Without it every per-workspace
//     transaction aborts, nothing is backfilled, and the operator's migration
//     is a silent no-op that reports success (C1).
//  4. THE WORKSPACE ID IS DERIVED, NOT MINTED PER RUN. Under RLS the app role
//     cannot read a workspace row by `legacy_key_hash` (the policy keys on the
//     claim's workspace id), so a per-run random id would make the migration
//     non-idempotent: the second run would neither find the row it wrote nor
//     match the claim. The id is a pure function of the legacy namespace hash.
//  5. PRUNED TRAILS ARE NOT RESURRECTED. A `_summary` key for a (project,
//     audit) means that audit's trail was pruned; the summary is migrated and
//     the trail rows are skipped (architecture §5.6).

import { IssueRevisionConflictError } from "@/lib/persistence/issue-ledger";
import type { DataStore } from "@/lib/persistence/store";
import { workspaceHash } from "@/lib/persistence/store";
import type { SqlClient } from "./sql";

/* -------------------------------------------------------------------------- *
 * Report
 * -------------------------------------------------------------------------- */

/** Why a source key was not migrated. */
export type MigrationSkipReason =
  | "non_tenant_key"
  | "malformed_tenant_key"
  | "unrecognized_tenant_key"
  | "missing_document"
  | "not_a_document"
  | "invalid_document"
  | "pruned_trail_superseded_by_summary";

export interface SkippedKey {
  key: string;
  reason: MigrationSkipReason;
}

export interface MigrationConflict {
  key: string;
  detail: string;
}

export interface MigrationReport {
  /** true when the run was asked to write. */
  apply: boolean;
  /** true when nothing was written (the inverse of `apply`). */
  dryRun: boolean;
  /** every key the migration enumerated (tenant-prefixed + denylisted families). */
  keysSeen: number;
  keysSkipped: number;
  /** key skips by reason. */
  skippedByReason: Record<string, number>;
  /** the skipped keys themselves. */
  skippedKeys: SkippedKey[];
  /** workspaces whose transaction committed. */
  workspacesMigrated: number;
  /** workspaces the run covered (dry run: would migrate). */
  workspacesPlanned: number;
  /** the legacy namespace hashes (16-hex) the run covered. */
  workspaceHashes: string[];
  /** rows written (dry run: 0). */
  rowsInserted: number;
  /** rows the run would write (dry run: the plan). */
  rowsPlanned: number;
  /** rows already present in the target — the idempotent skip. */
  rowsSkipped: number;
  /** rows per table (written in apply mode, planned in dry-run mode). */
  rowsByTable: Record<string, number>;
  /** target rows already present for the migrated workspaces. */
  targetRowsFound: number;
  /** write-once revision conflicts (a differing existing revision). */
  conflicts: MigrationConflict[];
  /** credential rows written — the backfill that makes a workspace reachable. */
  credentialsBackfilled: number;
  /** credential rows the run would write. */
  credentialsPlanned: number;
}

/** The target already holds tenant rows this migration does not own. */
export class MigrationTargetNotEmptyError extends Error {
  constructor(detail: string) {
    super(`migration target is not empty: ${detail}`);
    this.name = "MigrationTargetNotEmptyError";
  }
}

/* -------------------------------------------------------------------------- *
 * Key grammar
 * -------------------------------------------------------------------------- */

/** A tenant key: `ws:<16-hex workspace hash>:<family>:<...>`. */
const TENANT_KEY = /^ws:([0-9a-f]{16}):(.+)$/;

/** The non-tenant key families (architecture §5.1). They can never match the
 *  `ws:` prefix; the denylist makes the rejection explicit and auditable. */
export const NON_TENANT_KEY_PREFIXES: readonly string[] = [
  "discovery:dedupe-index",
  "dedupe:",
  "harvest:lock",
  "ratelimit:",
  "discovery:ledger:",
  "discovery:jobs:",
];

type TenantRecord =
  | { family: "project"; key: string; projectId: string }
  | { family: "audit"; key: string; projectId: string; auditId: string }
  | { family: "attachment"; key: string; projectId: string; attachmentId: string }
  | { family: "issue"; key: string; projectId: string; auditId: string; revision: number }
  | { family: "artifact"; key: string; projectId: string; auditId: string; nodeId: string; seq: number }
  | { family: "summary"; key: string; projectId: string; auditId: string };

/** The workspace id for a legacy namespace hash. Deterministic, so the
 *  migration is idempotent under a claim-keyed policy (see the file header).
 *  The 16 hex chars of the legacy hash are carried whole: four in the first
 *  group, twelve in the last. */
export function workspaceUuidFor(legacyHash: string): string {
  return `${legacyHash.slice(0, 4)}0000-0000-4000-8000-${legacyHash.slice(4, 16)}`;
}

/** The synthetic subject of a migrated legacy workspace (grilling C.14). */
export function legacySubjectFor(legacyHash: string): string {
  return `legacy:${legacyHash}`;
}

function parseTenantKey(key: string): { hash: string; record: TenantRecord } | null {
  const match = TENANT_KEY.exec(key);
  if (!match) return null;
  const hash = match[1];
  const parts = match[2].split(":");
  const family = parts[0];
  if (family === "project" && parts.length === 2) {
    return { hash, record: { family: "project", key, projectId: parts[1] } };
  }
  if (family === "audit" && parts.length === 3) {
    return { hash, record: { family: "audit", key, projectId: parts[1], auditId: parts[2] } };
  }
  if (family === "attachment" && parts.length === 3) {
    return {
      hash,
      record: { family: "attachment", key, projectId: parts[1], attachmentId: parts[2] },
    };
  }
  if (family === "issue" && parts.length === 4) {
    const revision = Number.parseInt(parts[3], 10);
    if (!Number.isInteger(revision)) return null;
    return { hash, record: { family: "issue", key, projectId: parts[1], auditId: parts[2], revision } };
  }
  if (family === "art" && parts.length >= 4) {
    const projectId = parts[1];
    const auditId = parts[2];
    if (parts.length === 4 && parts[3] === "_summary") {
      return { hash, record: { family: "summary", key, projectId, auditId } };
    }
    if (parts.length >= 5) {
      const seq = Number.parseInt(parts[parts.length - 1], 10);
      if (!Number.isInteger(seq)) return null;
      const nodeId = parts.slice(3, parts.length - 1).join(":");
      return { hash, record: { family: "artifact", key, projectId, auditId, nodeId, seq } };
    }
  }
  return null;
}

/* -------------------------------------------------------------------------- *
 * Row plans
 * -------------------------------------------------------------------------- */

interface RowPlan {
  table: string;
  key: string;
  sql: string;
  params: readonly unknown[];
  /** set for issue revisions: the write-once conflict probe. */
  conflict?: {
    projectId: string;
    auditId: string;
    revision: number;
    payload: unknown;
  };
}

function asJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function asTimestamp(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** The insert statement for one tenant record. Returns null when the document
 *  does not carry the fields the table requires (the key is then skipped). */
function planRow(
  record: TenantRecord,
  document: Record<string, unknown>,
  workspaceId: string,
  hash: string,
): RowPlan | null {
  switch (record.family) {
    case "project": {
      const createdAt = asTimestamp(document.created_at);
      const updatedAt = asTimestamp(document.updated_at);
      if (!createdAt || !updatedAt) return null;
      return {
        table: "projects",
        key: record.key,
        sql:
          "insert into public.projects (workspace_id, project_id, metadata, stage_selection, input_values, created_at, updated_at) " +
          "values ($1,$2,$3::jsonb,$4::jsonb,$5::jsonb,$6::timestamptz,$7::timestamptz) on conflict do nothing returning 1",
        params: [
          workspaceId,
          record.projectId,
          asJson(document.metadata),
          asJson(document.stage_selection),
          asJson(document.input_values),
          createdAt,
          updatedAt,
        ],
      };
    }
    case "audit": {
      const ranAt = asTimestamp(document.ran_at);
      if (!ranAt) return null;
      return {
        table: "audits",
        key: record.key,
        sql:
          "insert into public.audits (workspace_id, project_id, audit_id, ran_at, payload) " +
          "values ($1,$2,$3,$4::timestamptz,$5::jsonb) on conflict do nothing returning 1",
        params: [workspaceId, record.projectId, record.auditId, ranAt, asJson(document)],
      };
    }
    case "attachment": {
      const createdAt = asTimestamp(document.created_at);
      if (!createdAt) return null;
      return {
        table: "attachments",
        key: record.key,
        sql:
          "insert into public.attachments (workspace_id, project_id, attachment_id, created_at, payload) " +
          "values ($1,$2,$3,$4::timestamptz,$5::jsonb) on conflict do nothing returning 1",
        params: [workspaceId, record.projectId, record.attachmentId, createdAt, asJson(document)],
      };
    }
    case "issue": {
      const issuedAt = asTimestamp(document.issued_at);
      if (!issuedAt) return null;
      const storedIssuedBy = typeof document.issued_by === "string" ? document.issued_by : "auditor";
      const issuedBy = storedIssuedBy === "auditor" ? `legacy:${hash}` : storedIssuedBy;
      return {
        table: "audit_issues",
        key: record.key,
        sql:
          "insert into public.audit_issues (workspace_id, project_id, audit_id, revision, issued_at, issued_by, payload) " +
          "values ($1,$2,$3,$4,$5::timestamptz,$6,$7::jsonb) on conflict do nothing returning 1",
        params: [
          workspaceId,
          record.projectId,
          record.auditId,
          record.revision,
          issuedAt,
          issuedBy,
          asJson(document),
        ],
        conflict: {
          projectId: record.projectId,
          auditId: record.auditId,
          revision: record.revision,
          payload: document,
        },
      };
    }
    case "artifact": {
      return {
        table: "artifacts",
        key: record.key,
        sql:
          "insert into public.artifacts (workspace_id, project_id, audit_id, node_id, seq, payload) " +
          "values ($1,$2,$3,$4,$5,$6::jsonb) on conflict do nothing returning 1",
        params: [
          workspaceId,
          record.projectId,
          record.auditId,
          record.nodeId,
          record.seq,
          asJson(document),
        ],
      };
    }
    case "summary": {
      const prunedAt = asTimestamp(document.pruned_at);
      if (!prunedAt) return null;
      return {
        table: "artifact_summaries",
        key: record.key,
        sql:
          "insert into public.artifact_summaries (workspace_id, project_id, audit_id, pruned_at, payload) " +
          "values ($1,$2,$3,$4::timestamptz,$5::jsonb) on conflict do nothing returning 1",
        params: [workspaceId, record.projectId, record.auditId, prunedAt, asJson(document)],
      };
    }
  }
}

/* -------------------------------------------------------------------------- *
 * Helpers
 * -------------------------------------------------------------------------- */

/** Key-order-independent JSON, so a stored `jsonb` payload compares equal to
 *  the source document (jsonb does not preserve key order). */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

function emptyReport(apply: boolean): MigrationReport {
  return {
    apply,
    dryRun: !apply,
    keysSeen: 0,
    keysSkipped: 0,
    skippedByReason: {},
    skippedKeys: [],
    workspacesMigrated: 0,
    workspacesPlanned: 0,
    workspaceHashes: [],
    rowsInserted: 0,
    rowsPlanned: 0,
    rowsSkipped: 0,
    rowsByTable: {},
    targetRowsFound: 0,
    conflicts: [],
    credentialsBackfilled: 0,
    credentialsPlanned: 0,
  };
}

function skipKey(report: MigrationReport, key: string, reason: MigrationSkipReason): void {
  report.keysSkipped += 1;
  report.skippedByReason[reason] = (report.skippedByReason[reason] ?? 0) + 1;
  report.skippedKeys.push({ key, reason });
}

function countRow(report: MigrationReport, table: string, kind: "inserted" | "planned"): void {
  if (kind === "inserted") report.rowsInserted += 1;
  else report.rowsPlanned += 1;
  report.rowsByTable[table] = (report.rowsByTable[table] ?? 0) + 1;
  if (table === "workspace_credentials") {
    if (kind === "inserted") report.credentialsBackfilled += 1;
    else report.credentialsPlanned += 1;
  }
}

/* -------------------------------------------------------------------------- *
 * The core
 * -------------------------------------------------------------------------- */

export interface MigrationOptions {
  /** the KV source. READ-ONLY: the migration only enumerates and reads. */
  source: DataStore;
  /** the Postgres target. `null` is allowed for a source-only dry run. */
  target: SqlClient | null;
  /** write to the target. Default false (dry run). */
  apply?: boolean;
  /** allow writing into a target that already holds rows this migration does
   *  not own. Default false. */
  force?: boolean;
}

/** The occupancy of the target as the migration's role can see it: RLS scopes
 *  every tenant table to the claimed workspace, so this is the row count of
 *  ONE workspace, not of the whole database. */
async function readOccupancy(
  tx: SqlClient,
): Promise<{ total: number; workspaces: { id: string; legacy_key_hash: string | null }[] }> {
  const counts = await tx.query<{ n: number }>(
    "select 'workspaces' as t, count(*)::int as n from public.workspaces " +
      "union all select 'projects', count(*)::int from public.projects " +
      "union all select 'audits', count(*)::int from public.audits " +
      "union all select 'audit_issues', count(*)::int from public.audit_issues " +
      "union all select 'attachments', count(*)::int from public.attachments " +
      "union all select 'artifacts', count(*)::int from public.artifacts " +
      "union all select 'artifact_summaries', count(*)::int from public.artifact_summaries",
  );
  const total = counts.rows.reduce((sum, row) => sum + Number(row.n), 0);
  const workspaces = await tx.query<{ id: string; legacy_key_hash: string | null }>(
    "select id, legacy_key_hash from public.workspaces",
  );
  return { total, workspaces: workspaces.rows };
}

/** The stored payload of an existing issue revision, or null when the
 *  revision is not in the target yet. */
async function probeRevision(
  tx: SqlClient,
  conflict: NonNullable<RowPlan["conflict"]>,
): Promise<unknown | null> {
  const existing = await tx.query<{ payload: unknown }>(
    "select payload from public.audit_issues where project_id = $1 and audit_id = $2 and revision = $3",
    [conflict.projectId, conflict.auditId, conflict.revision],
  );
  return existing.rows.length > 0 ? existing.rows[0].payload : null;
}

/** Insert one row, honouring the write-once conflict rule for issue
 *  revisions. */
async function writeRow(
  tx: SqlClient,
  plan: RowPlan,
  apply: boolean,
  report: MigrationReport,
): Promise<void> {
  if (!apply) {
    if (plan.conflict) {
      // A dry run still probes the write-once lineage: a differing existing
      // revision is a conflict the operator must know about before applying.
      const stored = await probeRevision(tx, plan.conflict);
      if (stored !== null) {
        resolveRevisionConflict(plan, stored, false, report);
        return;
      }
    }
    countRow(report, plan.table, "planned");
    return;
  }
  const result = await tx.query(plan.sql, plan.params);
  if (result.rows.length > 0) {
    countRow(report, plan.table, "inserted");
    return;
  }
  if (plan.conflict) {
    const stored = await probeRevision(tx, plan.conflict);
    if (stored !== null) {
      resolveRevisionConflict(plan, stored, true, report);
      return;
    }
  }
  report.rowsSkipped += 1;
}

/** A byte-identical existing revision is skipped; a differing one aborts the
 *  run with IssueRevisionConflictError (write-once lineage, ADR-0004). */
function resolveRevisionConflict(
  plan: RowPlan,
  storedPayload: unknown,
  apply: boolean,
  report: MigrationReport,
): void {
  const conflict = plan.conflict!;
  if (canonicalJson(storedPayload) === canonicalJson(conflict.payload)) {
    report.rowsSkipped += 1;
    return;
  }
  const detail = `revision ${conflict.revision} differs from the stored issue (write-once)`;
  report.conflicts.push({ key: plan.key, detail });
  if (apply) throw new IssueRevisionConflictError(detail);
}

/** Migrate one workspace in ONE transaction. */
async function migrateWorkspace(args: {
  hash: string;
  plans: RowPlan[];
  target: SqlClient;
  apply: boolean;
  force: boolean;
  report: MigrationReport;
}): Promise<void> {
  const { hash, plans, target, apply, force, report } = args;
  const workspaceId = workspaceUuidFor(hash);
  const subjectId = legacySubjectFor(hash);
  const claims = JSON.stringify({ sub: subjectId, workspace_id: workspaceId });

  await target.transaction(async (tx) => {
    // BEGIN and `set local role auditorai_app` are the seam's job
    // (src/lib/db/sql.ts) — the transaction body only owns the claim GUCs.
    await tx.query("select set_config('request.jwt.claims', $1, true)", [claims]);

    // The occupancy check: under RLS the migration sees the rows of the
    // workspace it is claiming. A workspace that already holds rows which are
    // NOT this migration's is a target the operator must confirm with force.
    const occupancy = await readOccupancy(tx);
    report.targetRowsFound += occupancy.total;
    const mine =
      occupancy.workspaces.length === 1 && occupancy.workspaces[0].legacy_key_hash === hash;
    if (occupancy.total > 0 && !mine && !force) {
      const detail = `workspace ${hash} already holds ${occupancy.total} target row(s) that this migration does not own; pass --force to write anyway`;
      if (apply) throw new MigrationTargetNotEmptyError(detail);
      report.conflicts.push({ key: `ws:${hash}:target`, detail });
    }

    // 1. the workspace row
    await writeRow(
      tx,
      {
        table: "workspaces",
        key: `ws:${hash}:workspace`,
        sql:
          "insert into public.workspaces (id, name, region, legacy_key_hash) " +
          "values ($1,$2,$3,$4) on conflict do nothing returning 1",
        params: [workspaceId, subjectId, "ca-central-1", hash],
      },
      apply,
      report,
    );

    // 2. the tenant record rows
    for (const plan of plans) {
      await writeRow(tx, plan, apply, report);
    }

    // 3. the membership row — the credential's subject IS a member
    await writeRow(
      tx,
      {
        table: "workspace_members",
        key: `ws:${hash}:member`,
        sql:
          "insert into public.workspace_members (workspace_id, subject_id, role) " +
          "values ($1,$2,$3) on conflict do nothing returning 1",
        params: [workspaceId, subjectId, "member"],
      },
      apply,
      report,
    );

    // 4. C1 — the credential gate. The credential policy is
    //    `with check (credential_hash = public.app_claim_credential_hash())`,
    //    so the GUC is set IMMEDIATELY BEFORE the insert, in this transaction.
    //    Without it the insert is rejected by its own policy and the whole
    //    per-workspace transaction aborts.
    await tx.query("select set_config('request.credential_hash', $1, true)", [hash]);
    await writeRow(
      tx,
      {
        table: "workspace_credentials",
        key: `ws:${hash}:credential`,
        sql:
          "insert into public.workspace_credentials (credential_hash, workspace_id, subject_id) " +
          "values ($1,$2,$3) on conflict (credential_hash) do nothing returning 1",
        params: [hash, workspaceId, subjectId],
      },
      apply,
      report,
    );
  });

  if (apply) report.workspacesMigrated += 1;
}

/**
 * Copy every tenant key family from the KV source into the Postgres target.
 *
 * Dry run by default: nothing is written. The source is never written to at
 * all — the migration only enumerates and reads it.
 */
export async function migrateKvToPostgres(
  options: MigrationOptions,
): Promise<MigrationReport> {
  const { source, target, apply = false, force = false } = options;
  if (apply && !target) {
    throw new Error("migrateKvToPostgres: apply mode needs a target client");
  }
  const report = emptyReport(apply);

  // --- enumerate ------------------------------------------------------------
  const tenantKeys = await source.keys("ws:");
  const denied = new Set<string>();
  for (const prefix of NON_TENANT_KEY_PREFIXES) {
    for (const key of await source.keys(prefix)) denied.add(key);
  }
  report.keysSeen = tenantKeys.length + denied.size;
  for (const key of [...denied].sort()) skipKey(report, key, "non_tenant_key");

  // --- group the tenant keys by workspace ----------------------------------
  const devConsoleHash = workspaceHash("dev-console");
  const groups = new Map<string, TenantRecord[]>();
  for (const key of tenantKeys) {
    const parsed = parseTenantKey(key);
    if (!parsed) {
      skipKey(
        report,
        key,
        TENANT_KEY.test(key) ? "unrecognized_tenant_key" : "malformed_tenant_key",
      );
      continue;
    }
    if (parsed.hash === devConsoleHash) {
      skipKey(report, key, "non_tenant_key");
      continue;
    }
    const list = groups.get(parsed.hash) ?? [];
    list.push(parsed.record);
    groups.set(parsed.hash, list);
  }

  // --- a summary key suppresses that audit's trail rows ---------------------
  for (const [hash, records] of groups) {
    const pruned = new Set(
      records
        .filter((record) => record.family === "summary")
        .map((record) => `${JSON.stringify([record.projectId, record.auditId])}`),
    );
    if (pruned.size === 0) continue;
    const kept: TenantRecord[] = [];
    for (const record of records) {
      if (
        record.family === "artifact" &&
        pruned.has(`${JSON.stringify([record.projectId, record.auditId])}`)
      ) {
        skipKey(report, record.key, "pruned_trail_superseded_by_summary");
        continue;
      }
      kept.push(record);
    }
    groups.set(hash, kept);
  }

  // --- read the documents ---------------------------------------------------
  const hashes = [...groups.keys()].sort();
  report.workspaceHashes = hashes;
  report.workspacesPlanned = hashes.length;

  for (const hash of hashes) {
    const records = groups.get(hash)!;
    const workspaceId = workspaceUuidFor(hash);
    const plans: RowPlan[] = [];
    for (const record of records) {
      const document = await source.get<unknown>(record.key);
      if (document === null) {
        skipKey(report, record.key, "missing_document");
        continue;
      }
      const object = asObject(document);
      if (!object) {
        skipKey(report, record.key, "not_a_document");
        continue;
      }
      const plan = planRow(record, object, workspaceId, hash);
      if (!plan) {
        skipKey(report, record.key, "invalid_document");
        continue;
      }
      plans.push(plan);
    }

    if (!target) {
      // Source-only dry run: no database to plan against, so the row plan is
      // counted here (the transaction path counts it as it goes).
      countRow(report, "workspaces", "planned");
      for (const plan of plans) countRow(report, plan.table, "planned");
      countRow(report, "workspace_members", "planned");
      countRow(report, "workspace_credentials", "planned");
      continue;
    }
    await migrateWorkspace({ hash, plans, target, apply, force, report });
  }

  return report;
}
