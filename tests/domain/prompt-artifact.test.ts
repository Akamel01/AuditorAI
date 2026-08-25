// ADR-0012 gates: prompts/system-prompt.md is the canonical SYSTEM_PROMPT —
// extracted text must be BYTE-IDENTICAL to the original inline vN string
// (pinned here as the fixture constant), PROMPT_VERSION/PROMPT_HASH carry its
// identity, and a missing/unreadable artifact fails closed (adapter disabled,
// warn emitted). Also covers the additive prompt_version outcome-row field
// against the contract schema.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Ajv from "ajv/dist/2020.js";
import candidateOutcomeSchema from "../../contracts/schemas/candidate-outcome.schema.json";
import {
  PROMPT_HASH,
  PROMPT_VERSION,
  ZenAiAdapter,
  buildPromptMessages,
  loadPromptArtifact,
  setPromptArtifactForTests,
} from "@/lib/ai";
import { buildOutcomeRow } from "@/domain/outcomes";
import type { JurisdictionId } from "@/domain/types";

/** Fixture constant: the exact inline SYSTEM_PROMPT as it existed before
 *  extraction (vN). The artifact body must reproduce these bytes exactly. */
const ORIGINAL_SYSTEM_PROMPT = [
  "You assist a Road Safety Audit by proposing bounded candidate findings for human adjudication.",
  "Doctrine you must follow:",
  "- You never make final determinations; a qualified auditor disposes of every candidate.",
  "- Compliance questions and safety concerns are categorically distinct; do not blur them.",
  "- Every normative claim must cite an evidence_id given to you; invent nothing.",
  "- Recommendations must be specific and actionable; the words 'consider' and 'must' are banned.",
  'Respond with ONLY a JSON array. Each item: {"kind":"safety_concern"|"compliance_question","category":string,"location":string|null,"road_users":string[],"scenario":string|null,"statement":{"text":string,"normative_basis_note":string|null},"evidence":[{"evidence_id":string,"quote":string|null,"use":"supports_concern"|"defines_requirement"|"context"}],"assumptions":[{"text":string,"basis":string|null}],"rationale":string,"recommendation":string|null}.',
].join("\n");

afterEach(() => {
  setPromptArtifactForTests(loadPromptArtifact());
});

describe("prompt artifact extraction (ADR-0012)", () => {
  it("artifact body is byte-identical to the original inline SYSTEM_PROMPT", () => {
    const artifact = loadPromptArtifact();
    expect(artifact).not.toBeNull();
    expect(artifact?.body).toBe(ORIGINAL_SYSTEM_PROMPT);
  });

  it("exports PROMPT_VERSION=1 and PROMPT_HASH=sha256(body)", () => {
    expect(PROMPT_VERSION).toBe(1);
    expect(PROMPT_HASH).toBe(
      createHash("sha256").update(ORIGINAL_SYSTEM_PROMPT, "utf8").digest("hex"),
    );
  });

  it("the loaded body is what buildPromptMessages sends as the system message", () => {
    const audit = {
      input_manifest: [],
      findings: [],
      audit_questions: [],
      jurisdiction: "UK",
      framework_name: "f",
      native_stage_display_name: "s",
    } as unknown as Parameters<typeof buildPromptMessages>[0];
    const messages = buildPromptMessages(audit);
    expect(messages[0]).toEqual({ role: "system", content: ORIGINAL_SYSTEM_PROMPT });
  });
});

describe("fail-closed behavior", () => {
  it("a missing artifact yields null plus a fail-closed warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const missing = path.join(mkdtempSync(path.join(tmpdir(), "prompt-artifact-")), "nope.md");
    try {
      expect(loadPromptArtifact(missing)).toBeNull();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("fail closed"));
    } finally {
      rmSync(path.dirname(missing), { recursive: true, force: true });
      warn.mockRestore();
    }
  });

  it("with no artifact loaded, ZenAiAdapter is disabled and buildPromptMessages refuses", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    setPromptArtifactForTests(null);
    try {
      expect(new ZenAiAdapter({ apiKey: "sk-test" }).enabled).toBe(false);
      expect(() =>
        buildPromptMessages({
          input_manifest: [],
          findings: [],
          audit_questions: [],
        } as unknown as Parameters<typeof buildPromptMessages>[0]),
      ).toThrow(/fail closed/);
      expect(PROMPT_VERSION).toBeNull();
      expect(PROMPT_HASH).toBeNull();
    } finally {
      warn.mockRestore();
    }
  });

  it("reseating a valid artifact restores adapter availability", () => {
    setPromptArtifactForTests(loadPromptArtifact());
    expect(new ZenAiAdapter({ apiKey: "sk-test" }).enabled).toBe(true);
  });
});

describe("candidate-outcome schema: additive prompt_version", () => {
  const ajv = new Ajv({ strict: false, allErrors: true });
  const validate = ajv.compile(candidateOutcomeSchema);

  function baseArgs() {
    return {
      occurred_at: "2026-08-25T00:00:00.000Z",
      project_id: "P-1",
      audit_id: "A-1",
      odd_stamp: null,
      jurisdiction: "US" as JurisdictionId,
      native_stage_id: "us-fhwa:preliminary-design",
      canonical_stage: "PRELIMINARY_DESIGN" as const,
      action: "accept" as const,
      candidate: {
        kind: "safety_concern" as const,
        category: "c",
        location: null,
        road_users: [],
        scenario: null,
        statement: { text: "t", normative_basis_note: null },
        evidence: [{ evidence_id: "EV-US-001", quote: null, use: "supports_concern" as const }],
        assumptions: [],
        rationale: "r",
        recommendation: null,
        producer: "safety-reasoning-agent",
      },
    };
  }

  /** buildOutcomeRow emits the envelope-free row; recordCandidateOutcome
   *  stamps the persistence envelope validated by the contract schema. */
  function enveloped(row: ReturnType<typeof buildOutcomeRow>) {
    return { ...row, outcome_id: "OUT-1", schema_version: "1.0.0" as const };
  }

  it("rows stamped with prompt_version/prompt_hash/fewshot_ids validate", () => {
    const row = buildOutcomeRow({
      ...baseArgs(),
      adapter_id: "zen",
      prompt_version: PROMPT_VERSION ?? undefined,
      prompt_hash: PROMPT_HASH ?? undefined,
      fewshot_ids: ["FS-US-008-GF12"],
    });
    expect(row.prompt_version).toBe(1);
    expect(validate(enveloped(row))).toBe(true);
  });

  it("unstamped rows keep the legacy shape (null hash, empty fewshot_ids)", () => {
    const row = buildOutcomeRow(baseArgs());
    expect(row.adapter_id).toBeNull();
    expect(row.prompt_hash).toBeNull();
    expect(row.fewshot_ids).toEqual([]);
    expect(validate(enveloped(row))).toBe(true);
  });
});
