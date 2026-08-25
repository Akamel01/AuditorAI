// Ticket 04 / ADR-0013 mechanism-first metrics: PromotionRate and
// HallucinationRate computed from CandidateOutcome rows with honest empty-log
// nulls (never zeros pretending to be data), JSONL malformed-line tolerance,
// and the learning-architecture.html slot renderer contract (targeted
// replacement, loud failure on drift, byte-stable re-render).
import { describe, expect, it } from "vitest";
import {
  computeMetrics,
  parseOutcomeLog,
  patchLearningHtml,
  type DiagramValues,
  type OutcomeLike,
} from "@/lib/learning-metrics";

function outcome(action: string, flagged = false): OutcomeLike {
  return {
    action,
    ...(flagged
      ? { candidate: { validation: { status: "auto-flagged" } } }
      : {}),
  };
}

const BASE_VALUES: DiagramValues = {
  declaration_version: "1.1.2",
  archive_id: "2026-08-25T07-34-03-343Z",
  odd_cells: { total: 16, in: 5, mapped_unproven: 10, structurally_absent: 1 },
  evidence_records: 161,
  corpus: { total: 78, fewshot: 6, calib: 26, reserve: 41 },
  fixtures_in_passing: 11,
  rubric_dimensions_label: "5-dim",
};

const SAMPLE_HTML = `<div class="kpis">
      <div class="kpi"><span>ODD cells</span><b>99</b><small><span style="color:#5ee9b5">9 IN</span> · <span style="color:#f0b429">90 mapped-unproven</span> · <span style="color:#ff6b6b">9 absent</span></small></div>
      <div class="kpi"><span>Evidence records</span><b>99</b><small>5 jurisdictions · provenance-tracked</small></div>
      <div class="kpi"><span>Sample corpus</span><b>99</b><small>9 few-shot · 9 calib · 9 reserve</small></div>
      <div class="kpi"><span>Fixtures (IN)</span><b>99</b><small>GF-6..16 · gate-passing proof</small></div>
    </div>
  <p style="text-align:center;color:var(--dim);font-family:var(--mono);font-size:11px;letter-spacing:.06em;margin-top:22px">Auditor AI · Learning Architecture · stale footer</p>`;

describe("computeMetrics", () => {
  it("returns honest nulls for an empty log, not zeros-as-rates", () => {
    const m = computeMetrics({ outcomes: [] });
    expect(m).toEqual({
      total_outcomes: 0,
      by_action: { accept: 0, accept_with_edits: 0, reject: 0 },
      promotion_rate: null,
      hallucination: { candidates_total: 0, candidates_flagged: 0, rate: null },
    });
  });

  it("computes promotion_rate as (accept + accept_with_edits) / total", () => {
    const m = computeMetrics({
      outcomes: [
        outcome("accept"),
        outcome("accept"),
        outcome("accept"),
        outcome("accept_with_edits"),
        outcome("accept_with_edits"),
        outcome("reject"),
      ],
    });
    expect(m.total_outcomes).toBe(6);
    expect(m.by_action).toEqual({ accept: 3, accept_with_edits: 2, reject: 1 });
    expect(m.promotion_rate).toBeCloseTo(5 / 6, 12);
  });

  it("passes through ADR-0010 auto-flagged annotations as hallucination inputs", () => {
    const m = computeMetrics({
      outcomes: [
        outcome("accept"),
        outcome("reject", true),
        outcome("reject", true),
        outcome("accept_with_edits"),
      ],
    });
    expect(m.hallucination.candidates_total).toBe(4);
    expect(m.hallucination.candidates_flagged).toBe(2);
    expect(m.hallucination.rate).toBe(0.5);
  });

  it("counts unflagged candidates (no validation annotation) as unflagged", () => {
    const m = computeMetrics({ outcomes: [outcome("reject")] });
    expect(m.hallucination).toEqual({
      candidates_total: 1,
      candidates_flagged: 0,
      rate: 0,
    });
  });
});

describe("parseOutcomeLog", () => {
  it("tolerates malformed lines without dropping valid neighbours", () => {
    const good1 = JSON.stringify(outcome("accept"));
    const good2 = JSON.stringify(outcome("reject", true));
    const log = [good1, "{torn line", "", good2, "null-byte-garbage"].join("\n");
    const { rows, malformed_lines } = parseOutcomeLog(log);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(JSON.parse(good1));
    expect(rows[1]).toEqual(JSON.parse(good2));
    expect(malformed_lines).toBe(2);
  });

  it("ignores blank lines without counting them as malformed", () => {
    const { rows, malformed_lines } = parseOutcomeLog("\n\n  \n");
    expect(rows).toHaveLength(0);
    expect(malformed_lines).toBe(0);
  });
});

describe("patchLearningHtml", () => {
  it("replaces exactly the KPI numeric slots and the footer line", () => {
    const out = patchLearningHtml(SAMPLE_HTML, BASE_VALUES);
    expect(out).toContain(
      '<span>ODD cells</span><b>16</b><small><span style="color:#5ee9b5">5 IN</span> · <span style="color:#f0b429">10 mapped-unproven</span> · <span style="color:#ff6b6b">1 absent</span></small>',
    );
    expect(out).toContain("<span>Evidence records</span><b>161</b>");
    expect(out).toContain(
      "<span>Sample corpus</span><b>78</b><small>6 few-shot · 26 calib · 41 reserve</small>",
    );
    expect(out).toContain("<span>Fixtures (IN)</span><b>11</b>");
    expect(out).toContain(
      "ODD v1.1.2 · Evidence 161 · Corpus 78 · 6 few-shot · 26 calib · 41 reserve · rubric 5-dim · archive 2026-08-25T07-34-03-343Z",
    );
    // Nothing outside the slots moves: untouched markup survives verbatim.
    expect(out).toContain("<small>GF-6..16 · gate-passing proof</small>");
    expect(out).toContain("<small>5 jurisdictions · provenance-tracked</small>");
  });

  it("is idempotent: rendering already-generated output changes no bytes", () => {
    const once = patchLearningHtml(SAMPLE_HTML, BASE_VALUES);
    expect(patchLearningHtml(once, BASE_VALUES)).toBe(once);
  });

  it("throws loudly naming the slot when hand-edited markup diverges", () => {
    const broken = SAMPLE_HTML.replace("<span>Fixtures (IN)</span><b>99</b>", "");
    expect(() => patchLearningHtml(broken, BASE_VALUES)).toThrowError(
      /slot "fixtures-in" not found/,
    );
    const noFooter = SAMPLE_HTML.replace(
      /<p style="text-align:center[^>]*>[\s\S]*?<\/p>/,
      "",
    );
    expect(() => patchLearningHtml(noFooter, BASE_VALUES)).toThrowError(
      /slot "footer-line" not found/,
    );
  });
});
