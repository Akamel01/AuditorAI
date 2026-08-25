// ADR-0009 candidate outcome logging: schema conformance of versioned rows,
// one-row-per-disposition capture on the REAL promotion path
// (applyCandidatePromotions, called by the audits PATCH route) through an
// injectable sink, best-effort isolation (logging failure never blocks the
// review), and retention/identity constants. The pipeline's AG-ADJUDICATION
// node never resolves AI candidates (AG-FINDINGS forces deterministic_rule
// traces), so capture lives here — not there.
import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Ajv from "ajv/dist/2020.js";
import candidateOutcomeSchema from "../../contracts/schemas/candidate-outcome.schema.json";
import {
  CONSENT_VERSION,
  DEFAULT_AUDITOR_PSEUDONYM,
  JsonlOutcomeSink,
  RETENTION_TTL_DAYS,
  setCandidateOutcomeSinkForTests,
  type CandidateOutcomeSink,
} from "@/domain/outcomes";
import { applyCandidatePromotions } from "@/domain/candidate-review";
import type {
  AuditResult,
  CandidateFindingRecord,
  CandidateOutcomeRow,
} from "@/domain/types";

const T0 = "2026-08-25T00:00:00.000Z";

function candidate(over: Partial<CandidateFindingRecord> = {}): CandidateFindingRecord {
  return {
    kind: "safety_concern",
    category: "visibility",
    location: "junction",
    road_users: ["cyclists"],
    scenario: "conflicting left turn",
    statement: { text: "sight lines restricted", normative_basis_note: null },
    evidence: [{ evidence_id: "EV-UK-002", quote: null, use: "supports_concern" }],
    assumptions: [],
    rationale: "derived from drawings",
    recommendation: "Extend the visibility splay to 2x2x120.",
    producer: "safety-reasoning-agent",
    ...over,
  };
}

function draft(candidates: CandidateFindingRecord[]): AuditResult {
  return {
    audit_id: "AUD-P-1-uk-S1",
    project_id: "P-1",
    jurisdiction: "UK",
    framework_name: "DMRB GG 119",
    native_stage_id: "uk:S1",
    native_stage_display_name: "Stage 1",
    canonical_stages: ["PRELIMINARY_DESIGN"],
    mapping_confidence: "authoritative",
    ran_at: T0,
    input_manifest: [],
    findings: [],
    missing_information: [],
    audit_questions: [],
    limitations: [],
    odd_declaration_version: "1.0.1",
    odd_status: "in",
    odd_stamp: "UK|S1|PRELIMINARY_DESIGN",
    odd_floor_satisfied: true,
    disclaimer: "d",
    candidate_findings: candidates,
  };
}

class MemorySink implements CandidateOutcomeSink {
  readonly rows: CandidateOutcomeRow[] = [];
  append(row: CandidateOutcomeRow): void {
    this.rows.push(row);
  }
}

afterEach(() => {
  setCandidateOutcomeSinkForTests(null);
});

describe("candidate-outcome.schema.json", () => {
  const ajv = new Ajv({ strict: false, allErrors: true });
  const validate = ajv.compile(candidateOutcomeSchema);

  function schemaRow(): CandidateOutcomeRow {
    return {
      outcome_id: "OUT-1",
      schema_version: "1.0.0",
      occurred_at: T0,
      project_id: "P-1",
      audit_id: "AUD-P-1-uk-S1",
      odd_stamp: null,
      jurisdiction: "UK",
      native_stage_id: "uk:S1",
      canonical_stage: "PRELIMINARY_DESIGN",
      adapter_id: "zen",
      prompt_hash: "abc123",
      fewshot_ids: ["FS-001"],
      candidate: {
        kind: "safety_concern",
        category: "visibility",
        location: "junction",
        road_users: ["cyclists"],
        scenario: "conflicting left turn",
        statement: { text: "sight lines restricted", normative_basis_note: null },
        evidence: [{ evidence_id: "EV-UK-002", quote: null, use: "supports_concern" }],
        assumptions: [],
        rationale: "derived from drawings",
        recommendation: "Extend the visibility splay to 2x2x120.",
        producer: "safety-reasoning-agent",
      },
      action: "accept_with_edits",
      edited_fields: { recommendation: "Install the visibility splay before opening." },
      note: "checked drawings",
      auditor_pseudonym: "auditor-a1",
      consent_version: "1.0",
    };
  }

  it("validates a full row", () => {
    expect(validate(schemaRow())).toBe(true);
  });

  it("rejects edited_fields keys outside the whitelist", () => {
    const row = { ...schemaRow(), edited_fields: { severity: "high" } };
    expect(validate(row)).toBe(false);
  });

  it("rejects actions outside the disposition enum", () => {
    const row = { ...schemaRow(), action: "escalate" };
    expect(validate(row)).toBe(false);
  });
});

describe("capture on the PATCH promotion path", () => {
  it("emits one row per applied disposition — accept, accept_with_edits, reject — with pre-edit snapshots", () => {
    const cAccept = candidate({ category: "visibility" });
    const cEdits = candidate({ category: "crossings" });
    const cReject = candidate({ category: "markings" });
    const sink = new MemorySink();
    setCandidateOutcomeSinkForTests(sink);

    // Exactly as src/app/api/projects/[projectId]/audits/[auditId]/route.ts
    // calls it: two arguments, promotions straight off the request body.
    const applied = applyCandidatePromotions(draft([cAccept, cEdits, cReject]), [
      { index: 0, action: "accept" },
      {
        index: 1,
        action: "accept_with_edits",
        edited_recommendation: "Install the visibility splay before opening.",
        reviewer_note: "tightened wording",
      },
      { index: 2, action: "reject", reviewer_note: "duplicate of F-R-001" },
    ]);
    expect(applied.ok).toBe(true);

    expect(sink.rows.map((r) => r.action)).toEqual([
      "reject",
      "accept_with_edits",
      "accept",
    ]);

    const [rej, edits, acc] = sink.rows;
    for (const row of sink.rows) {
      expect(row.schema_version).toBe("1.0.0");
      expect(row.outcome_id).toBeTruthy();
      expect(new Date(row.occurred_at).toISOString()).toBe(row.occurred_at);
      // Context coordinates come from the stored draft the route holds.
      expect(row.project_id).toBe("P-1");
      expect(row.audit_id).toBe("AUD-P-1-uk-S1");
      expect(row.jurisdiction).toBe("UK");
      expect(row.native_stage_id).toBe("uk:S1");
      expect(row.canonical_stage).toBe("PRELIMINARY_DESIGN");
      expect(row.odd_stamp).toBe("UK|S1|PRELIMINARY_DESIGN");
      expect(row.auditor_pseudonym).toBe(DEFAULT_AUDITOR_PSEUDONYM);
      expect(row.consent_version).toBe(CONSENT_VERSION);
      // Snapshot is always pre-edit: what the auditor actually disposed of.
      expect(row.candidate.recommendation).toBe("Extend the visibility splay to 2x2x120.");
      expect(row.candidate.producer).toBe("safety-reasoning-agent");
    }

    // Finding 2: edited_fields ride ONLY on accept_with_edits.
    expect(Object.hasOwn(acc, "edited_fields")).toBe(false);
    expect(Object.hasOwn(rej, "edited_fields")).toBe(false);
    expect(edits.edited_fields).toEqual({
      recommendation: "Install the visibility splay before opening.",
    });
    expect(edits.note).toBe("tightened wording");
    expect(acc.note).toBeUndefined();
    expect(rej.candidate.category).toBe("markings");
    expect(rej.note).toBe("duplicate of F-R-001");
  });

  it("emits nothing when a ref is skipped or gate-blocked: the batch aborts before any row flushes", () => {
    const sink = new MemorySink();
    setCandidateOutcomeSinkForTests(sink);
    const d = draft([candidate(), candidate()]);

    const skipped = applyCandidatePromotions(d, [
      { index: 0, action: "accept" },
      { index: 9, action: "reject" },
    ]);
    expect(skipped).toEqual({ ok: false, error: "unknown candidate index 9" });

    const gateBlocked = applyCandidatePromotions(d, [
      { index: 0, action: "accept_with_edits", edited_recommendation: "Consider monitoring." },
    ]);
    expect(gateBlocked.ok).toBe(false);

    expect(sink.rows).toHaveLength(0);
  });

  it("a sink failure never blocks or corrupts the promotion", () => {
    setCandidateOutcomeSinkForTests({
      append() {
        throw new Error("disk full");
      },
    });

    const applied = applyCandidatePromotions(draft([candidate()]), [
      { index: 0, action: "accept" },
    ]);

    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.value.findings.map((f) => f.finding_id)).toEqual(["F-AI-001"]);
    expect(applied.value.candidate_findings).toBeUndefined();
  });
});

describe("JsonlOutcomeSink", () => {
  it("appends one JSONL line per row without rewriting prior content", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "candidate-outcomes-"));
    try {
      const sink = new JsonlOutcomeSink(dir);
      const r1 = schemaRowForFs("OUT-1");
      const r2 = schemaRowForFs("OUT-2");
      sink.append(r1);
      sink.append(r2);

      const file = path.join(dir, `${T0.slice(0, 7)}.jsonl`);
      const lines = readFileSync(file, "utf8").trimEnd().split("\n");
      expect(lines).toHaveLength(2);
      expect(lines.map((l) => JSON.parse(l))).toEqual([r1, r2]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

function schemaRowForFs(outcomeId: string): CandidateOutcomeRow {
  return {
    outcome_id: outcomeId,
    schema_version: "1.0.0",
    occurred_at: T0,
    project_id: "P-1",
    audit_id: "AUD-P-1-uk-S1",
    odd_stamp: null,
    jurisdiction: "UK",
    native_stage_id: "uk:S1",
    canonical_stage: "PRELIMINARY_DESIGN",
    adapter_id: null,
    prompt_hash: null,
    fewshot_ids: [],
    candidate: {
      kind: "compliance_question",
      category: "crossings",
      location: null,
      road_users: [],
      scenario: null,
      statement: { text: "crossing demand unmet", normative_basis_note: null },
      evidence: [{ evidence_id: "EV-UK-009", quote: null, use: "defines_requirement" }],
      assumptions: [],
      rationale: "r",
      recommendation: null,
      producer: "safety-reasoning-agent",
    },
    action: "reject",
    auditor_pseudonym: DEFAULT_AUDITOR_PSEUDONYM,
    consent_version: CONSENT_VERSION,
  };
}

it("exports the retention and identity constants (ADR-0009 §4)", () => {
  expect(RETENTION_TTL_DAYS).toBe(730);
});
