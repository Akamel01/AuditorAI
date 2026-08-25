// ADR-0013 mechanism-first learning metrics + generated diagram slots.
// Pure: no fs, no process, no node imports — callers (readiness-report,
// render-learning-html, tests) feed strings and rows in. PromotionRate and
// HallucinationRate are published from day one; numeric investigation
// thresholds deliberately stay unset (ADR-0013 §2) until ~30 days of real
// CandidateOutcome data exists — numbers set without evidence are fiction.
import type { CandidateOutcomeAction } from "@/domain/types";

/** Structural minimum this module needs from a parsed CandidateOutcomeRow
 *  (ADR-0009 row + the ADR-0010 validation annotation that rides on the
 *  logged candidate snapshot). Kept structural so any log source carrying
 *  the same fields computes identically. */
export interface OutcomeLike {
  action: string;
  candidate?: {
    validation?: { status?: string };
  };
}

export type ActionCounts = Record<CandidateOutcomeAction, number>;

/** Honest-by-default shape: empty log yields nulls, never zeros pretending
 *  to be measured rates. */
export interface LearningMetrics {
  total_outcomes: number;
  by_action: ActionCounts;
  /** (accept + accept_with_edits) / total; null when no outcomes exist. */
  promotion_rate: number | null;
  hallucination: {
    candidates_total: number;
    candidates_flagged: number;
    /** flagged / total; null when no outcomes exist. */
    rate: number | null;
  };
}

const ACTIONS: readonly CandidateOutcomeAction[] = [
  "accept",
  "accept_with_edits",
  "reject",
];

export function computeMetrics({
  outcomes,
}: {
  outcomes: readonly OutcomeLike[];
}): LearningMetrics {
  const by_action = { accept: 0, accept_with_edits: 0, reject: 0 } as ActionCounts;
  let flagged = 0;
  for (const outcome of outcomes) {
    if ((ACTIONS as readonly string[]).includes(outcome.action)) {
      by_action[outcome.action as CandidateOutcomeAction] += 1;
    }
    // Passthrough of the ADR-0010 flag-and-show annotation captured on the
    // candidate snapshot: flagged-here is exactly what the auditor saw.
    if (outcome.candidate?.validation?.status === "auto-flagged") flagged += 1;
  }
  const total = outcomes.length;
  return {
    total_outcomes: total,
    by_action,
    promotion_rate:
      total === 0 ? null : (by_action.accept + by_action.accept_with_edits) / total,
    hallucination: {
      candidates_total: total,
      candidates_flagged: flagged,
      rate: total === 0 ? null : flagged / total,
    },
  };
}

export interface ParsedOutcomeLog<T = OutcomeLike> {
  rows: T[];
  malformed_lines: number;
}

/** JSONL tolerance for the append-only log: a torn or hand-mangled line is
 *  skipped and counted, never fatal and never silently dropped — metrics
 *  must report what they saw. Blank lines are ignored, not counted. */
export function parseOutcomeLog(text: string): ParsedOutcomeLog {
  const rows: OutcomeLike[] = [];
  let malformed_lines = 0;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      rows.push(JSON.parse(trimmed) as OutcomeLike);
    } catch {
      malformed_lines += 1;
    }
  }
  return { rows, malformed_lines };
}

/** Generated-truth values for docs/architecture/learning-architecture.html.
 *  Every field lands in exactly one KPI slot or the footer line. */
export interface DiagramValues {
  declaration_version: string;
  archive_id: string;
  odd_cells: {
    total: number;
    in: number;
    mapped_unproven: number;
    structurally_absent: number;
  };
  evidence_records: number;
  corpus: { total: number; fewshot: number; calib: number; reserve: number };
  fixtures_in_passing: number;
  rubric_dimensions_label: string;
}

function replaceSlot(
  html: string,
  pattern: RegExp,
  replacement: string,
  slot: string,
): string {
  if (!pattern.test(html)) {
    throw new Error(
      `learning-architecture.html: KPI slot "${slot}" not found — hand-edited markup diverged from the renderer contract`,
    );
  }
  return html.replace(pattern, replacement);
}

/** Escape for a String.replace replacement: `$$` renders a literal `$`. */
const esc = (s: string): string => s.replace(/\$/g, "$$$$");

/** Patches ONLY the KPI <span>/<b>/<small> numeric slots plus the footer
 *  line; all other markup passes through untouched. Throws loudly when a
 *  slot is missing so drift between hand-edited docs and generated truth
 *  can never ship quietly. Idempotent: re-running on already-patched HTML
 *  reproduces byte-identical output. */
export function patchLearningHtml(html: string, v: DiagramValues): string {
  let out = html;

  out = replaceSlot(
    out,
    /(<span>ODD cells<\/span><b>)\d+(<\/b>)/,
    `$1${v.odd_cells.total}$2`,
    "odd-cells-total",
  );
  out = replaceSlot(
    out,
    /(<span>ODD cells<\/span><b>\d+<\/b><small>)<span style="color:#5ee9b5">\d+ IN<\/span> · <span style="color:#f0b429">\d+ mapped-unproven<\/span> · <span style="color:#ff6b6b">\d+ absent<\/span>(<\/small>)/,
    `$1<span style="color:#5ee9b5">${v.odd_cells.in} IN</span> · <span style="color:#f0b429">${v.odd_cells.mapped_unproven} mapped-unproven</span> · <span style="color:#ff6b6b">${v.odd_cells.structurally_absent} absent</span>$2`,
    "odd-cells-breakdown",
  );
  out = replaceSlot(
    out,
    /(<span>Evidence records<\/span><b>)\d+(<\/b>)/,
    `$1${v.evidence_records}$2`,
    "evidence-records",
  );
  out = replaceSlot(
    out,
    /(<span>Sample corpus<\/span><b>)\d+(<\/b>)/,
    `$1${v.corpus.total}$2`,
    "corpus-total",
  );
  out = replaceSlot(
    out,
    /(<span>Sample corpus<\/span><b>\d+<\/b><small>)\d+ few-shot · \d+ calib · \d+ reserve(<\/small>)/,
    `$1${v.corpus.fewshot} few-shot · ${v.corpus.calib} calib · ${v.corpus.reserve} reserve$2`,
    "corpus-roles",
  );
  out = replaceSlot(
    out,
    /(<span>Fixtures \(IN\)<\/span><b>)\d+(<\/b>)/,
    `$1${v.fixtures_in_passing}$2`,
    "fixtures-in",
  );

  const footer =
    `Auditor AI · Learning Architecture · ODD v${v.declaration_version}` +
    ` · Evidence ${v.evidence_records} · Corpus ${v.corpus.total}` +
    ` · ${v.corpus.fewshot} few-shot · ${v.corpus.calib} calib · ${v.corpus.reserve} reserve` +
    ` · rubric ${v.rubric_dimensions_label} · archive ${v.archive_id}`;
  out = replaceSlot(
    out,
    /<p style="text-align:center;color:var\(--dim\);font-family:var\(--mono\);font-size:11px;letter-spacing:\.06em;margin-top:22px">[\s\S]*?<\/p>/,
    `<p style="text-align:center;color:var(--dim);font-family:var(--mono);font-size:11px;letter-spacing:.06em;margin-top:22px">${esc(footer)}</p>`,
    "footer-line",
  );

  return out;
}
