import { Panel } from "@/app/_components/ui/panel";
import { Eyebrow } from "@/app/_components/ui/chips";
import type { OddCoverageView } from "@/discovery/types";

// ReadinessReport — minimal honest shape mirroring state/readiness-report.json
export interface ReadinessReport {
  declaration_version: string;
  generated: string;
  latest_archive: string;
  role_census: Record<string, number> & { total: number };
  fixtures: Array<{
    id: string;
    gate: { mark: string; pass_rate?: number; scored?: number; unscored?: number };
  }>;
  learning_layer: {
    evidence_records: number;
    corpus_cataloged: number;
    fewshot_total: number;
    judge_calibration_total: number;
    per_cell_coverage?: {
      cell_total: number;
      status_counts: { in: number; mapped_unproven: number; structurally_absent: number };
    };
    metrics?: {
      promotion_rate?: number | null;
      total_outcomes?: number;
      hallucination?: { rate: number | null };
      outcomes_present?: boolean;
      note?: string;
    };
  };
  odd_cells?: Array<{ status: string }>;
  [k: string]: unknown;
}

export interface KpiStripProps {
  coverage: OddCoverageView;
  readiness: ReadinessReport;
  /** optional ledger totals when fetched separately via GET /api/dev/discovery */
  ledgerTotal?: number;
  ledgerLastAt?: string | null;
}

function StatBezel({
  eyebrowCode,
  eyebrowLabel,
  value,
  sub,
  mono = true,
}: {
  eyebrowCode: string;
  eyebrowLabel: string;
  value: string;
  sub: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-[1.5rem] bg-sunken/80 p-1.5 ring-1 ring-hairline">
      <Panel className="!rounded-[1.25rem] border-hairline bg-surface px-4 py-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.75)]">
        <Eyebrow code={eyebrowCode}>{eyebrowLabel}</Eyebrow>
        <div className={`${mono ? "font-mono" : ""} mt-1 text-[26px] font-semibold leading-none tracking-[-0.02em] text-text`}>
          {value}
        </div>
        <div className="mt-1.5 font-mono text-[11px] leading-snug tracking-[0.04em] text-faint">{sub}</div>
      </Panel>
    </div>
  );
}

export function KpiStrip({ coverage, readiness, ledgerTotal, ledgerLastAt }: KpiStripProps) {
  // ODD counts — prefer per_cell_coverage status_counts if present, else derive from coverage cells
  const statusCounts = readiness.learning_layer.per_cell_coverage?.status_counts;
  const inCount = statusCounts?.in ?? coverage.cells.filter((c) => c.status === "in").length;
  const mapped = statusCounts?.mapped_unproven ?? coverage.cells.filter((c) => c.status === "mapped_unproven").length;
  const absent = statusCounts?.structurally_absent ?? coverage.cells.filter((c) => c.status === "structurally_absent").length;

  const totalHave = coverage.cells.reduce((s, c) => s + c.have_total, 0);
  const totalFull = coverage.cells.reduce((s, c) => s + c.have_full_package, 0);
  const targetTotal = coverage.target_total;

  // ledger — if not supplied, surface honest fallback
  const ledgerEntries = typeof ledgerTotal === "number" ? ledgerTotal : null;
  const ledgerAt = ledgerLastAt ?? null;

  // corpus — from readiness
  const corpusTotal = readiness.role_census.total ?? readiness.learning_layer.corpus_cataloged ?? 0;
  const fewshot = readiness.learning_layer.fewshot_total ?? readiness.role_census["engine-fewshot"] ?? 0;
  const calib = readiness.learning_layer.judge_calibration_total ?? readiness.role_census["judge-calibration"] ?? 0;
  const reserve = readiness.role_census.reserve ?? 0;

  // gate pass_rate — mean across fixtures that have a pass_rate (IN fixtures)
  const scoredFixtures = readiness.fixtures.filter((f) => typeof f.gate.pass_rate === "number");
  const meanPass =
    scoredFixtures.length > 0
      ? scoredFixtures.reduce((s, f) => s + (f.gate.pass_rate as number), 0) / scoredFixtures.length
      : null;
  const passPct = meanPass !== null ? `${Math.round(meanPass * 100)}%` : "—";
  const passDetail =
    scoredFixtures.length > 0
      ? `${scoredFixtures.length} fixtures · ${readiness.latest_archive.slice(0, 10)}`
      : "no scored fixtures";

  return (
    <section aria-label="Mission Control KPIs" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <StatBezel
        eyebrowCode="CH 0+010"
        eyebrowLabel="ODD · declaration"
        value={`${inCount} / ${mapped} / ${absent}`}
        sub="IN · mapped-unproven · structurally absent"
      />
      <StatBezel
        eyebrowCode="CH 0+040"
        eyebrowLabel="Coverage · packages"
        value={`${totalHave} / ${targetTotal}`}
        sub={`${totalFull} full-package · ${Math.round((totalHave / Math.max(1, targetTotal)) * 1000) / 10}% of target`}
      />
      <StatBezel
        eyebrowCode="CH 0+070"
        eyebrowLabel="Ledger · harvest"
        value={ledgerEntries !== null ? String(ledgerEntries) : "—"}
        sub={ledgerAt ? `last ${new Date(ledgerAt).toISOString().slice(0, 10)}` : "no ledger timestamp"}
      />
      <StatBezel
        eyebrowCode="CH 0+100"
        eyebrowLabel="Corpus · samples"
        value={String(corpusTotal)}
        sub={`${fewshot} few-shot · ${calib} calib · ${reserve} reserve`}
      />
      <StatBezel
        eyebrowCode="CH 0+130"
        eyebrowLabel="Gate · Tier-1"
        value={passPct}
        sub={passDetail}
      />
    </section>
  );
}
