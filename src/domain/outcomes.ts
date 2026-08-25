// ADR-0009: candidate outcome logging. Append-only JSONL under
// state/candidate-outcomes/ (gitignored: raw auditor work products never enter
// git history). Capture is best-effort — a sink failure is warned and
// swallowed so it can never block or corrupt an audit result. The ambient
// default sink writes files; tests inject memory sinks via the setter seam.
import { randomUUID } from "node:crypto";
import { closeSync, mkdirSync, openSync, writeSync } from "node:fs";
import path from "node:path";
import { oddClaimZone, resolveOdd } from "@/domain/odd";
import type {
  CandidateEditedFields,
  CandidateFindingRecord,
  CandidateOutcome,
  CandidateOutcomeAction,
  CandidateOutcomeRow,
  CanonicalStage,
  JurisdictionId,
} from "@/domain/types";

export const CANDIDATE_OUTCOMES_DIR = "state/candidate-outcomes";

/** ADR-0009 §2 row schema version; mirrors contracts/schemas/candidate-outcome.schema.json. */
export const OUTCOME_SCHEMA_VERSION = "1.0.0";

/** Retention TTL default: 2 years, purge on auditor request (ADR-0009 §4). */
export const RETENTION_TTL_DAYS = 730;

export const CONSENT_VERSION = "1.0";

export const DEFAULT_AUDITOR_PSEUDONYM = "auditor-a1";

export interface CandidateOutcomeSink {
  append(row: CandidateOutcomeRow): void;
}

/** Default sink: open-append-close per write, one file per UTC month, no rewrite. */
export class JsonlOutcomeSink implements CandidateOutcomeSink {
  constructor(private readonly rootDir: string = path.join(process.cwd(), CANDIDATE_OUTCOMES_DIR)) {}

  append(row: CandidateOutcomeRow): void {
    mkdirSync(this.rootDir, { recursive: true });
    // occurred_at is ISO; the month bucket is its first seven characters.
    const file = path.join(this.rootDir, `${row.occurred_at.slice(0, 7)}.jsonl`);
    const fd = openSync(file, "a");
    try {
      writeSync(fd, `${JSON.stringify(row)}\n`);
    } finally {
      closeSync(fd);
    }
  }
}

let sinkSingleton: CandidateOutcomeSink | null = null;

/** Test-only seam: drop or replace the ambient sink so suites stay hermetic.
 *  Pass null to restore the default fs sink. */
export function setCandidateOutcomeSinkForTests(sink: CandidateOutcomeSink | null): void {
  sinkSingleton = sink;
}

/** Best-effort capture: stamps the persistence envelope and hands the row to
 *  the ambient sink. Never throws — logging must not corrupt the audit. */
export function recordCandidateOutcome(outcome: CandidateOutcome): void {
  try {
    const sink = sinkSingleton ?? new JsonlOutcomeSink();
    sink.append({
      ...outcome,
      outcome_id: randomUUID(),
      schema_version: OUTCOME_SCHEMA_VERSION,
    });
  } catch (e) {
    console.warn(
      `[outcomes] candidate outcome logging failed (ignored): ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

/** Shared ADR-0009 row construction for every capture site (the PATCH
 *  promotion path in candidate-review.ts). Context coordinates arrive from the
 *  caller's reachable slice of the world; `candidate` is the pre-edit snapshot
 *  the auditor actually disposed of; edited_fields are gated to
 *  action === "accept_with_edits" here so no call site can leak edits onto a
 *  plain accept/reject. The persistence envelope (outcome_id, schema_version)
 *  is stamped later by recordCandidateOutcome. */
export interface BuildOutcomeRowArgs {
  occurred_at: string;
  project_id: string;
  audit_id: string;
  odd_stamp: string | null;
  jurisdiction: JurisdictionId;
  native_stage_id: string;
  canonical_stage: CanonicalStage | null;
  action: CandidateOutcomeAction;
  candidate: CandidateFindingRecord;
  edited_fields?: CandidateEditedFields;
  note?: string;
}

export function buildOutcomeRow(args: BuildOutcomeRowArgs): CandidateOutcome {
  return {
    occurred_at: args.occurred_at,
    project_id: args.project_id,
    audit_id: args.audit_id,
    odd_stamp: args.odd_stamp,
    jurisdiction: args.jurisdiction,
    native_stage_id: args.native_stage_id,
    canonical_stage: args.canonical_stage,
    adapter_id: null,
    prompt_hash: null,
    fewshot_ids: [],
    candidate: args.candidate,
    action: args.action,
    ...(args.action === "accept_with_edits" && args.edited_fields
      ? { edited_fields: args.edited_fields }
      : {}),
    ...(args.note !== undefined ? { note: args.note } : {}),
    auditor_pseudonym: DEFAULT_AUDITOR_PSEUDONYM,
    consent_version: CONSENT_VERSION,
  };
}

/** ODD three-zone claim stamp at capture time (same computation as report
 *  assembly). Best-effort: an unresolvable stamp logs as null, never throws. */
export function oddStampFor(
  jurisdiction: JurisdictionId,
  canonicalStages: CanonicalStage[],
): string | null {
  try {
    return oddClaimZone(resolveOdd(jurisdiction, canonicalStages)).stamp;
  } catch {
    return null;
  }
}
