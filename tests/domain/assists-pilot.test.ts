// F4 assists pilot: OFF default, deterministic-green failures, post-boundary
// provenance, canonical report untouched, boundary rejections. HITL stays:
// assists are draft-only PROPOSED text for auditor copy-paste, never promoted.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ASSISTS_PRODUCER,
  PROMPT_HASH,
  PROMPT_VERSION,
  ZenAssistAdapter,
  generateAssists,
  getAssistsEnabled,
  type AssistAdapter,
  type ReportAssistProposal,
} from "@/lib/ai";
import { acceptAssistDraft } from "@/domain/candidate-review";
import { renderReportMarkdown } from "@/lib/report";
import type { AuditResult } from "@/domain/types";

const T0 = "2026-09-15T00:00:00.000Z";

const ENV_KEYS = ["AI_ASSISTS_ENABLED", "AI_ENABLED", "OPENCODE_API_KEY"] as const;
let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = {};
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

function clearEnv(): void {
  for (const k of ENV_KEYS) delete process.env[k];
}

function enableAssists(): void {
  process.env.AI_ASSISTS_ENABLED = "true";
  process.env.AI_ENABLED = "true";
  process.env.OPENCODE_API_KEY = "test-key";
}

function audit(): AuditResult {
  return {
    audit_id: "AUD-P-1-S1",
    project_id: "P-1",
    jurisdiction: "UK",
    framework_name: "DMRB GG 119",
    native_stage_id: "uk:S1",
    native_stage_display_name: "Stage 1",
    canonical_stages: ["PRELIMINARY_DESIGN"],
    mapping_confidence: "authoritative",
    ran_at: T0,
    input_manifest: [
      {
        input_id: "IN-1",
        label: "General arrangement",
        requirement_level: "required",
        state: "provided",
        evidence_ids: ["EV-001"],
      },
    ],
    findings: [],
    missing_information: [],
    audit_questions: [],
    limitations: ["desktop review only"],
    odd_declaration_version: "1.0.1",
    odd_status: "in",
    odd_stamp: null,
    odd_floor_satisfied: null,
    disclaimer: "d",
  };
}

function validDraft(over: Partial<ReportAssistProposal> = {}): ReportAssistProposal {
  return {
    kind: "recommendation_draft",
    status: "PROPOSED",
    proposed_text: "Widen the visibility splay before opening.",
    basis_evidence_ids: ["EV-001"],
    producer: ASSISTS_PRODUCER,
    ...over,
  };
}

function countingAdapter(drafts: ReportAssistProposal[] = []): AssistAdapter & { calls: number } {
  const adapter = {
    calls: 0,
    enabled: true,
    id: "test-assists",
    async generateAssistDrafts(): Promise<ReportAssistProposal[]> {
      adapter.calls += 1;
      return drafts;
    },
  };
  return adapter;
}

describe("F4 assists pilot", () => {
  it("OFF default: [] with zero adapter calls even when opted in per-call", async () => {
    clearEnv();
    expect(getAssistsEnabled()).toBe(false);
    const adapter = countingAdapter([validDraft()]);
    expect(await generateAssists(audit(), { assists: true, adapter })).toEqual([]);
    expect(adapter.calls).toBe(0);
  });

  it("per-call flag defaults false: env ON but no opt-in still yields [] with zero calls", async () => {
    enableAssists();
    expect(getAssistsEnabled()).toBe(true);
    const adapter = countingAdapter([validDraft()]);
    expect(await generateAssists(audit(), { adapter })).toEqual([]);
    expect(adapter.calls).toBe(0);
  });

  it("never assists while candidates are OFF/keyless (AND gate)", async () => {
    process.env.AI_ASSISTS_ENABLED = "true";
    delete process.env.AI_ENABLED;
    delete process.env.OPENCODE_API_KEY;
    expect(getAssistsEnabled()).toBe(false);
    const adapter = countingAdapter([validDraft()]);
    expect(await generateAssists(audit(), { assists: true, adapter })).toEqual([]);
    expect(adapter.calls).toBe(0);
  });

  it("ON + transport failure yields [] (deterministic green, no throw)", async () => {
    enableAssists();
    const failing = new ZenAssistAdapter({
      apiKey: "test-key",
      fetchImpl: (async () => {
        throw new Error("boom");
      }) as typeof fetch,
    });
    await expect(generateAssists(audit(), { assists: true, adapter: failing })).resolves.toEqual([]);
  });

  it("stamps complete post-boundary provenance and rejects forged stamps", async () => {
    enableAssists();
    const clean = countingAdapter([validDraft()]);
    const out = await generateAssists(audit(), { assists: true, adapter: clean });
    expect(out).toHaveLength(1);
    expect(out[0].provenance).toEqual({
      adapter_id: "test-assists",
      prompt_version: PROMPT_VERSION,
      prompt_hash: PROMPT_HASH,
    });
    expect(out[0].producer).toBe(ASSISTS_PRODUCER);
    expect(out[0].producer).not.toBe("safety-reasoning-agent");

    const forged = countingAdapter([
      validDraft({
        provenance: { adapter_id: "evil", prompt_version: 1, prompt_hash: "deadbeef" },
      }),
    ]);
    expect(await generateAssists(audit(), { assists: true, adapter: forged })).toEqual([]);
  });

  it("canonical renderReportMarkdown is byte-identical with assists on and populated", async () => {
    enableAssists();
    const a = audit();
    const before = renderReportMarkdown(a);
    const snapshot = JSON.parse(JSON.stringify(a));
    const assists = await generateAssists(audit(), {
      assists: true,
      adapter: countingAdapter([validDraft(), validDraft({ kind: "limitations_draft" })]),
    });
    expect(assists).toHaveLength(2);
    expect(renderReportMarkdown(a)).toBe(before);
    expect(JSON.parse(JSON.stringify(a))).toEqual(snapshot);
  });

  it.each([
    ["non-PROPOSED status", validDraft({ status: "APPROVED" as unknown as "PROPOSED" })],
    ["overlong text", validDraft({ proposed_text: "x".repeat(1201) })],
    ["unknown evidence", validDraft({ basis_evidence_ids: ["EV-NOPE"] })],
    ["rogue kind", validDraft({ kind: "banana" as unknown as "recommendation_draft" })],
    ["empty text", validDraft({ proposed_text: "" })],
  ])("rejects %s with []", async (_name, draft) => {
    enableAssists();
    const adapter = countingAdapter([draft]);
    expect(await generateAssists(audit(), { assists: true, adapter })).toEqual([]);
  });

  it("acceptAssistDraft copies text for the auditor without mutating or promoting", () => {
    const proposal = validDraft();
    const snapshot = JSON.parse(JSON.stringify(proposal));
    const out = acceptAssistDraft(proposal);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.value).toEqual({
      kind: "recommendation_draft",
      text: proposal.proposed_text,
      basis_evidence_ids: ["EV-001"],
    });
    out.value.basis_evidence_ids.push("EV-MUT");
    expect(proposal).toEqual(snapshot); // detached copy, input untouched
  });

  it("acceptAssistDraft rejects non-drafts and overlong text", () => {
    expect(acceptAssistDraft(validDraft({ status: "APPROVED" as unknown as "PROPOSED" })).ok).toBe(
      false,
    );
    expect(acceptAssistDraft(validDraft({ proposed_text: "x".repeat(1201) })).ok).toBe(false);
  });
});
