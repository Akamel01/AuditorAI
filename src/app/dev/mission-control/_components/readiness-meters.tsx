import { Panel } from "@/app/_components/ui/panel";
import { Eyebrow } from "@/app/_components/ui/chips";
import type { LearningMetrics } from "@/lib/learning-metrics";
import type { ReadinessReport } from "./kpi-strip";
import type { OddCoverageView } from "@/discovery/types";
import { THRESHOLDS, DIMENSIONS } from "@/lib/eval-gates";

export interface ReadinessMetersProps {
  readiness: ReadinessReport;
  learning: LearningMetrics | null;
  /** optional coverage for discovery progress when available (honest fallback if absent) */
  coverage?: OddCoverageView | null;
}

function MeterShell({
  code,
  title,
  valueLabel,
  sub,
  progress, // 0..1 or null for indeterminate/honest-empty
  tone = "accent",
}: {
  code: string;
  title: string;
  valueLabel: string;
  sub: string;
  progress: number | null;
  tone?: "accent" | "ok" | "warn" | "faint";
}) {
  const barColor =
    tone === "ok" ? "bg-ok" : tone === "warn" ? "bg-warn" : tone === "faint" ? "bg-edge" : "bg-accent";
  const pct = progress === null ? 0 : Math.max(0, Math.min(1, progress));
  return (
    <Panel className="rounded-[1.25rem] border-hairline bg-surface px-4 py-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.75)]">
      <Eyebrow code={code}>{title}</Eyebrow>
      <div className="mt-1 flex items-baseline justify-between gap-3">
        <span className="font-mono text-[22px] font-semibold leading-none tracking-[-0.02em] text-text">{valueLabel}</span>
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-faint">
          {progress === null ? "—" : `${Math.round(pct * 100)}%`}
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-sunken ring-1 ring-hairline">
        {progress === null ? (
          <div className="h-full w-full rounded-full bg-hairline opacity-60" title="no data" />
        ) : (
          <div
            className={`h-full rounded-full ${barColor} transition-[width] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]`}
            style={{ width: `${Math.round(pct * 100)}%` }}
          />
        )}
      </div>
      <p className="mt-2 font-mono text-[11px] leading-snug text-faint">{sub}</p>
    </Panel>
  );
}

export function ReadinessMeters({ readiness, learning, coverage }: ReadinessMetersProps) {
  // discovery: odd-coverage progress — prefer live coverage have/target, fallback to corpus_cataloged/500
  const discoveryProgress = (() => {
    if (coverage) {
      const have = coverage.cells.reduce((s, c) => s + c.have_total, 0);
      const target = coverage.target_total || 500;
      return target > 0 ? have / target : 0;
    }
    // honest: corpus vs discovery target is not coverage, so mark indeterminate but show count
    // we still produce a faint progress for breathing; caller can pass coverage for honest coverage.
    return null as number | null;
  })();

  const discoveryLabel = (() => {
    if (coverage) {
      const have = coverage.cells.reduce((s, c) => s + c.have_total, 0);
      return `${have} / ${coverage.target_total}`;
    }
    // fallback: show corpus count honestly, not pretending it's coverage
    const corpus = readiness.learning_layer.corpus_cataloged ?? readiness.role_census.total ?? 0;
    return `${corpus} cataloged`;
  })();

  const discoverySub = coverage
    ? `${coverage.cells.reduce((s, c) => s + c.have_full_package, 0)} full-package · ${coverage.cells.length} cells · gaps ${coverage.gaps_ranked.length}`
    : `corpus ${readiness.learning_layer.corpus_cataloged ?? readiness.role_census.total} · coverage needs live OddCoverageView (500 target)`;

  // validation: eval-gate thresholds
  // show mean pass across fixtures gate.pass_rate; detail thresholds string
  const scored = readiness.fixtures.filter((f) => typeof f.gate.pass_rate === "number");
  const meanPass = scored.length ? scored.reduce((s, f) => s + (f.gate.pass_rate as number), 0) / scored.length : null;
  const validationLabel = meanPass !== null ? `${Math.round(meanPass * 100)}% pass` : "—";
  const validationSub = `thresholds: ${DIMENSIONS.length}-dim ≥${THRESHOLDS.perDimensionMinimum}, substance ≥${THRESHOLDS.substanceRequired}, evidence ≥${THRESHOLDS.evidenceGroundingRequired}, corpus ≥${Math.round(THRESHOLDS.corpusPassMark * 100)}% · archive ${readiness.latest_archive.slice(0, 10)}`;

  // fine-tuning: promotion_rate or honest "no outcomes"
  // learning may be null, or have outcomes_present false, or promotion_rate null
  const hasOutcomes =
    learning !== null &&
    typeof learning.total_outcomes === "number" &&
    learning.total_outcomes > 0 &&
    learning.promotion_rate !== null;
  const ftProgress = hasOutcomes && typeof learning?.promotion_rate === "number" ? (learning.promotion_rate as number) : hasOutcomes ? 0 : null;
  const ftLabel = hasOutcomes
    ? `${Math.round((learning!.promotion_rate as number) * 100)}% promoted`
    : "no outcomes yet";
  const ftSub =
    hasOutcomes && learning
      ? `${learning.total_outcomes} outcomes · hallucination ${learning.hallucination.rate !== null ? Math.round((learning.hallucination.rate as number) * 100) + "%" : "—"} flagged · thresholds unset per ADR-0013 §2`
      : (readiness.learning_layer.metrics as { note?: string } | undefined)?.note ??
        (learning as unknown as { note?: string } | null)?.note ??
        "append-only CandidateOutcome log empty — honest 0% not ready until ~30 days of data";

  // references: evidence_records
  const evidence = readiness.learning_layer.evidence_records ?? 0;
  // reference target is not fixed; show as absolute with subtle bar proportional to 200 as soft cap
  const refProgress = Math.min(1, evidence / 200);
  const refLabel = `${evidence} records`;
  const refSub = `evidence-registry.json · corpus ${readiness.learning_layer.corpus_cataloged} · ${readiness.learning_layer.fewshot_total} few-shot · ${readiness.learning_layer.judge_calibration_total} calib`;

  return (
    <section aria-label="Readiness meters" className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <MeterShell
        code="CH 0+300"
        title="Discovery · coverage"
        valueLabel={discoveryLabel}
        sub={discoverySub}
        progress={discoveryProgress}
        tone={discoveryProgress !== null && discoveryProgress >= 1 ? "ok" : "accent"}
      />
      <MeterShell
        code="CH 0+310"
        title="Validation · eval-gates"
        valueLabel={validationLabel}
        sub={validationSub}
        progress={meanPass}
        tone={meanPass !== null && meanPass >= THRESHOLDS.corpusPassMark ? "ok" : meanPass !== null && meanPass >= 0.5 ? "warn" : "faint"}
      />
      <MeterShell
        code="CH 0+320"
        title="Fine-tuning · promotion"
        valueLabel={ftLabel}
        sub={ftSub}
        progress={ftProgress}
        tone={ftProgress === null ? "faint" : ftProgress >= 0.5 ? "ok" : "warn"}
      />
      <MeterShell
        code="CH 0+330"
        title="References · evidence"
        valueLabel={refLabel}
        sub={refSub}
        progress={refProgress}
        tone="accent"
      />
    </section>
  );
}
