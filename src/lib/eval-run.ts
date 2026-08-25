// E4 eval harness core (C1 deepening): suite driving, ox-alpha judging,
// gate assembly and top-up merging — dependency-injected so tests are
// hermetic. CLI plane (argv/env/fs sinks) lives in scripts/run-eval.ts.
//
// Gate mathematics are NOT duplicated here: thresholds and projection
// functions come from src/lib/eval-gates.ts (doctrine-frozen) through the
// single internal computeGateStats() used by both the main loop and topup.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { extractJsonObject, chatComplete, type ChatMessage, type ReasoningEffort } from "@/lib/inference";
import { PROMPT_HASH, PROMPT_VERSION } from "@/lib/ai";
import {
  DIMENSIONS,
  THRESHOLDS,
  detectRegression,
  isScoredVerdict,
  passesFindingGate,
  projectMeanScore,
  projectPassRate,
  projectPassesCorpusMark,
  type FindingVerdict,
} from "@/lib/eval-gates";
import {
  assertReleaseTestSources,
  RELEASE_TEST_CORPUS_FLOOR,
  fixtureRoleSection,
  fixtureSampleIds,
  type RoleSection,
  type SampleRoleLookup,
} from "@/domain/split-firewall";
import type { AuditResult, InputValueState, JurisdictionId, Project } from "@/domain/types";

export const T0 = "2026-08-22T00:00:00.000Z";

export type EvalMode = "corpus" | "release-test";

/** Scorecard `mode` values: corpus/dry-run x plain/live. */
export type RunFlavor = "corpus" | "dry-run" | "corpus-live" | "dry-run-live";

export function parseRunMode(argv: string[]): EvalMode {
  const idx = argv.indexOf("--mode");
  if (idx === -1) return "corpus";
  const value = argv[idx + 1];
  if (value !== "corpus" && value !== "release-test") {
    throw new Error(`--mode must be "corpus" or "release-test" (got ${JSON.stringify(value ?? "<missing>")})`);
  }
  return value;
}

/** Typed refusal (ADR-0007 dormancy/firewall): the CLI maps this to exit(2). */
export class EvalRefusalError extends Error {}
export const EVAL_REFUSAL_EXIT_CODE = 2;

/** Parent archive for --topup does not exist: the CLI maps this to exit(1). */
export class EvalTopupMissingError extends Error {}

export interface FixtureDoc {
  fixture_id: string;
  name: string;
  jurisdiction: string;
  native_stage_id: string;
  metadata: Project["metadata"];
  inputs: Record<string, { state: InputValueState; value?: string }>;
  expected_findings_baseline?: unknown[];
}

const DRY_RUN_FILES = [
  "gf1-uk-urban-arterial-stage2.json",
  "gf2-usa-rural-highway-prelim.json",
  "gf3-uae-roundabout-combined-s12.json",
  "gf4-canada-pedestrian-planning.json",
  "gf5-int-roundabout-detailed.json",
];

const CORPUS_FILES = [
  "gf6-uk-m5j10-stage1.json",
  "gf7-usa-arterial-prelim.json",
  "gf8-usa-hawk-final.json",
  "gf9-int-interchange-prelim.json",
  "gf10-canada-corridor-planning.json",
  "gf11-uk-greatnorthroad-s1.json",
  "gf12-usa-hingham-prelim.json",
  "gf13-ca-neahd-planning.json",
  "gf14-usa-somerville-prelim.json",
  "gf15-ca-strathcona-planning.json",
  "gf16-int-milltown-prelim.json",
];

export const KNOWN_FILES: Record<"dry-run" | "corpus", string[]> = {
  "dry-run": DRY_RUN_FILES,
  corpus: CORPUS_FILES,
};

// ---- Judge client (ox-alpha at effort=max via Zen; free model only) ----------

// Doctrine-frozen rubric text (owner checkpoint ω 2026-08-22). Do not edit.
const JUDGE_SYSTEM = [
  "You are the Road Safety Audit evaluation judge for AuditorAI.",
  "You score ONE finding at a time against five rubric dimensions, 0-2 each:",
  "- substance: real safety/compliance substance for this scheme context (2 = substantive; 1 = marginal; 0 = vacuous)",
  "- evidence_grounding: claims tied to cited evidence_ids or recorded input facts; invented content scores 0. A verbatim quote supporting the pivotal claim is REQUIRED for 2; registry-id citation alone caps at 1 (owner clarification, Checkpoint omega)",
  "- jurisdiction_correctness: framework semantics respected; compliance questions and safety concerns stay categorically distinct",
  "- recommendation_quality: specific, actionable, viable (a null recommendation scores at most 1)",
  "- vru_coverage: vulnerable road user impacts considered where relevant (score 1 when not applicable but acknowledged)",
  "Respond with ONLY a JSON object:",
  '{"finding_id":"<repeat the id>","scores":{"substance":n,"evidence_grounding":n,"jurisdiction_correctness":n,"recommendation_quality":n,"vru_coverage":n},"justifications":{"substance":"...","evidence_grounding":"...","jurisdiction_correctness":"...","recommendation_quality":"...","vru_coverage":"..."}}',
  "Every justification is mandatory one line. No prose outside the JSON.",
].join("\n");

/**
 * Wire transport for the judge, built on the shared chatComplete primitive
 * (timeout, reasoning_effort discovery). The outer repair/backoff loop in
 * judgeFinding stays responsible for the 4-attempt schedule.
 */
export function makeZenJudgeComplete(opts: {
  baseUrl: string;
  apiKey: string;
  model: string;
  effort: ReasoningEffort;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): (messages: ChatMessage[]) => Promise<string> {
  return (messages) =>
    chatComplete(
      {
        endpoint: { baseUrl: opts.baseUrl, apiKey: opts.apiKey },
        model: opts.model,
        effort: opts.effort,
        timeoutMs: opts.timeoutMs,
        fetchImpl: opts.fetchImpl,
      },
      messages,
    );
}

export type JudgeTransport = (messages: ChatMessage[]) => Promise<string>;

export interface EvalJudgeConfig {
  /** null ⇒ judging disabled (--no-judge): gates force-pass, provenance omits identity. */
  complete: JudgeTransport | null;
  model: string;
  effort: string;
  gateway?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Judge one finding: up to 4 attempts; transport-shaped failures back off
 * 2s/4s/8s; every failed attempt appends the corrective user turn. Returns
 * { error } instead of throwing so one bad finding cannot sink a run.
 */
export async function judgeFinding(
  finding: unknown,
  ctx: { jurisdiction: string; framework: string; stage: string },
  judge: { complete: JudgeTransport },
): Promise<FindingVerdict | { error: string }> {
  const user = [
    `Context: ${ctx.jurisdiction} / ${ctx.framework} / ${ctx.stage}.`,
    `Finding under evaluation:`,
    JSON.stringify(finding, null, 1),
  ].join("\n\n");
  const messages: ChatMessage[] = [
    { role: "system", content: JUDGE_SYSTEM },
    { role: "user", content: user },
  ];
  let lastError = "";
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const parsed = extractJsonObject(await judge.complete(messages));
      if (isScoredVerdict(parsed)) return parsed;
      throw new Error("verdict failed rubric shape");
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      if (/HTTP|aborted|network|fetch failed|503|502|504/i.test(lastError) && attempt < 3)
        await sleep(2000 * 2 ** attempt); // transport flake backoff: 2s/4s/8s
      if (attempt === 0)
        messages.push({
          role: "assistant",
          content: "",
        });
      messages.push({
        role: "user",
        content: "Return ONLY the corrected JSON verdict object.",
      });
    }
  }
  return { error: lastError };
}

/** Prior archived mean for a fixture, newest run first. fs-seamed via dir arg. */
export function findPriorRunMean(fixtureId: string, scorecardsDir?: string): number | null {
  const base = scorecardsDir ?? path.join(process.cwd(), "state", "eval-scorecards");
  if (!existsSync(base)) return null;
  const runs = readdirSync(base).sort();
  for (const run of runs.reverse()) {
    const f = path.join(base, run, `${fixtureId}.json`);
    if (existsSync(f)) {
      try {
        const prior = JSON.parse(readFileSync(f, "utf8")) as { mean_score?: number };
        return typeof prior.mean_score === "number" ? prior.mean_score : null;
      } catch {
        continue;
      }
    }
  }
  return null;
}

// ---- Gate assembly (SINGLE-SOURCED) ------------------------------------------
// The ONLY place outside eval-gates.ts where pass rate / corpus mark / mean /
// regression are projected. Both the main loop and the topup merge go through
// this function.

interface GateStats {
  passRate: number;
  passesMark: boolean;
  meanScore: number;
  regression: { regression: boolean; delta: number };
}

function computeGateStats(
  verdicts: FindingVerdict[],
  priorMean: number | null,
  opts?: { forcePassMark?: boolean },
): GateStats {
  const passRate = projectPassRate(verdicts);
  const passesMark = opts?.forcePassMark ?? projectPassesCorpusMark(verdicts);
  const meanScore = projectMeanScore(verdicts);
  const regression = detectRegression(meanScore, priorMean);
  return { passRate, passesMark, meanScore, regression };
}

// ---- Scorecard ----------------------------------------------------------------

type SubjectKind = "engine-findings" | "judge-baseline" | "none";

interface ScorecardJudgeStamp {
  model: string;
  effort: string;
  gateway?: string;
  identity: string;
  prompt_version: number | null;
  prompt_hash: string | null;
}

export interface EvalScorecard {
  run_id: string;
  fixture_id: string;
  fixture_name: string;
  mode: RunFlavor;
  run_tier: EvalMode;
  role_section: RoleSection;
  subject: SubjectKind;
  judge: { enabled: false } | ScorecardJudgeStamp;
  thresholds: typeof THRESHOLDS;
  findings_scored: number;
  findings_unscored: { finding_id: string; reason: string }[];
  pass_rate: number;
  passes_corpus_mark: boolean;
  mean_score: number;
  regression_vs_prior: { regression: boolean; delta: number };
  tier2_review_required: boolean;
  verdicts: FindingVerdict[];
  generated_at: string;
}

/** Byte-compatible scorecard shape (field names/order mirror the E4 archive format). */
export function buildScorecard(args: {
  fixtureId: string;
  fixtureName: string;
  verdicts: FindingVerdict[];
  unscored: { finding_id: string; reason: string }[];
  thresholds: typeof THRESHOLDS;
  meta: {
    runId: string;
    flavor: RunFlavor;
    tier: EvalMode;
    roleSection: RoleSection;
    subject: SubjectKind;
    judge: EvalJudgeConfig;
    priorMean: number | null;
    generatedAt?: string;
  };
}): EvalScorecard {
  const { meta } = args;
  const stats = computeGateStats(args.verdicts, meta.priorMean, {
    forcePassMark: meta.judge.complete === null ? true : undefined,
  });
  return {
    run_id: meta.runId,
    fixture_id: args.fixtureId,
    fixture_name: args.fixtureName,
    mode: meta.flavor,
    run_tier: meta.tier,
    role_section: meta.roleSection,
    subject: meta.subject,
    judge:
      meta.judge.complete === null
        ? { enabled: false }
        : {
            model: meta.judge.model,
            effort: meta.judge.effort,
            ...(meta.judge.gateway !== undefined ? { gateway: meta.judge.gateway } : {}),
            identity: "ox-alpha",
            // ADR-0012: engine-side prompt identity in force for this run.
            prompt_version: PROMPT_VERSION,
            prompt_hash: PROMPT_HASH,
          },
    thresholds: args.thresholds,
    findings_scored: args.verdicts.length,
    findings_unscored: args.unscored,
    pass_rate: Math.round(stats.passRate * 1000) / 1000,
    passes_corpus_mark: stats.passesMark,
    mean_score: stats.meanScore,
    regression_vs_prior: stats.regression,
    tier2_review_required: stats.regression.regression || !stats.passesMark,
    verdicts: args.verdicts,
    generated_at: meta.generatedAt ?? new Date().toISOString(),
  };
}

/** Markdown rendering. Raw stats are threaded privately: the archived JSON
 *  shape must not grow fields just so its renderer can read them back. */
function renderScorecardMd(
  card: EvalScorecard,
  raw: { passRate: number; priorMean: number | null },
): string {
  const regression = card.regression_vs_prior;
  const md: string[] = [
    `# Eval scorecard — ${card.fixture_id} (${card.fixture_name})`,
    ``,
    `- Run: \`${card.run_id}\` (${card.mode})`,
    `- Judge: ${"enabled" in card.judge ? "disabled" : `${card.judge.model} @ effort ${card.judge.effort} (ox-alpha)`}`,
    `- Subject: ${card.subject} (${card.findings_scored} scored${card.findings_unscored.length ? ` · ${card.findings_unscored.length} unscored` : ""})`,
    `- Pass rate: **${Math.round(raw.passRate * 100)}%** vs corpus mark **${THRESHOLDS.corpusPassMark * 100}%** → ${card.passes_corpus_mark ? "PASS" : "**FAIL**"}`,
    `- Mean dimension total: ${card.mean_score}${raw.priorMean !== null ? ` (prior ${raw.priorMean}, delta ${regression.delta}${regression.regression ? " → **REGRESSION — Tier-2 review**" : ""})` : ""}`,
    ``,
  ];
  for (const v of card.verdicts) {
    md.push(
      `## ${v.finding_id} — gate ${passesFindingGate(v) ? "PASS" : "FAIL"} (${Object.values(v.scores).join("/")})`,
    );
    for (const d of DIMENSIONS) md.push(`- **${d}:** ${v.scores[d]} — ${v.justifications[d]}`);
    md.push("");
  }
  for (const u of card.findings_unscored) md.push(`## ${u.finding_id} — UNSCORED (${u.reason})`, "");
  return md.join("\n");
}

// ---- Sinks & suite ------------------------------------------------------------

export interface ValidationRecordInput {
  date: string;
  validator_node: string;
  scope: string;
  method: string;
  result: string;
  follow_ups: string[];
}

export interface EvalSinks {
  /** Writes a JSON artifact into the run archive (`<fixture_id>.json`, manifest.json). */
  writeScorecardJson(fileName: string, contents: string): void;
  /** Writes the per-fixture markdown scorecard. */
  writeScorecardMd(fileName: string, contents: string): void;
  /** Appends one validation record; assignee owns validation_id sequencing. */
  appendValidationState(record: ValidationRecordInput): void;
}

export interface EvalSuiteOpts {
  files: FixtureDoc[];
  runId: string;
  flavor: RunFlavor;
  tier: EvalMode;
  judge: EvalJudgeConfig;
  auditRunner: (project: Project, t0: string) => AuditResult | Promise<AuditResult>;
  sinks: EvalSinks;
  corpus: { catalogedCount: number; rolesFor: SampleRoleLookup };
  priorMeanFn?: (fixtureId: string) => number | null;
}

export interface EvalRunSummary {
  runId: string;
  anyProjectFailed: boolean;
}

function toProject(fx: FixtureDoc): Project {
  return {
    project_id: `P-${fx.fixture_id.toLowerCase().replace(/-/g, "")}`,
    workspace_key_hash: "evalrunner",
    metadata: fx.metadata,
    stage_selection: {
      jurisdiction: fx.jurisdiction as JurisdictionId,
      native_stage_id: fx.native_stage_id,
    },
    input_values: fx.inputs,
    created_at: T0,
    updated_at: T0,
  };
}

const FLAVOR_MODE_LABEL: Record<RunFlavor, string> = {
  "dry-run": "dry-run(GF-1..5)",
  "dry-run-live": "dry-run(GF-1..5)+live",
  corpus: "corpus(GF-6..16)",
  "corpus-live": "corpus(GF-6..16)+live",
};

function scopeFragment(flavor: RunFlavor): string {
  const base = flavor.startsWith("dry-run") ? "GF-1..5 dry-run" : "corpus GF-6..16";
  return flavor.endsWith("-live") ? `${base} [live]` : base;
}

/**
 * Full judged suite over the given fixtures: Tier-0 engine audit, optional
 * judging, gate assembly via computeGateStats, archive writes through the
 * injected sinks. Throws EvalRefusalError for ADR-0007 tier violations.
 */
export async function runEvalSuite(opts: EvalSuiteOpts): Promise<EvalRunSummary> {
  const { files, runId, flavor, tier, judge, sinks } = opts;

  // Release-test tier gate (ADR-0007): refuse before any judging while the
  // catalog is below the floor; once active, every source sample must be
  // firewall-virgin.
  if (tier === "release-test") {
    try {
      assertReleaseTestSources(opts.corpus.catalogedCount, files, opts.corpus.rolesFor);
    } catch (e) {
      throw new EvalRefusalError(e instanceof Error ? e.message : String(e));
    }
  }

  console.log(`[eval] run ${runId} mode=${FLAVOR_MODE_LABEL[flavor]} tier=${tier} judge=${judge.complete === null ? "off" : judge.model}@${judge.effort}`);

  let anyProjectFailed = false;

  const sectionTally = new Map<RoleSection, { fixtures: number; pass: number; fail: number }>();
  const tally = (section: RoleSection, passesMark: boolean) => {
    const t = sectionTally.get(section) ?? { fixtures: 0, pass: 0, fail: 0 };
    t.fixtures += 1;
    if (passesMark) t.pass += 1;
    else t.fail += 1;
    sectionTally.set(section, t);
  };

  for (const fx of files) {
    const project = toProject(fx);

    // Phase 1: deterministic Tier-0 check (--live conducts candidate
    // generation through the pipeline's async driver; findings unchanged).
    const result: AuditResult = await opts.auditRunner(project, T0);
    console.log(`[eval] ${fx.fixture_id}: engine produced ${result.findings.length} findings, ${result.missing_information.length} MI`);

    // Subject selection: engine findings when present; otherwise the ORCH-
    // authored judge baselines (known-good outputs per the E1 dry-run
    // protocol) so the ladder always exercises real finding content.
    const subject =
      result.findings.length > 0
        ? { kind: "engine-findings" as const, items: result.findings }
        : fx.expected_findings_baseline?.length
          ? { kind: "judge-baseline" as const, items: fx.expected_findings_baseline }
          : { kind: "none" as const, items: [] as unknown[] };

    // Phase 2: judge each finding.
    const verdicts: FindingVerdict[] = [];
    const unscored: { finding_id: string; reason: string }[] = [];
    if (judge.complete && subject.kind !== "none") {
      let callNo = 0;
      for (const f of subject.items) {
        callNo += 1;
        console.log(`[eval] ${fx.fixture_id}: judging ${callNo}/${subject.items.length}…`);
        const v = await judgeFinding(
          f,
          {
            jurisdiction: result.jurisdiction,
            framework: result.framework_name,
            stage: `${result.native_stage_id} (${result.native_stage_display_name})`,
          },
          { complete: judge.complete },
        );
        const fid =
          typeof (f as { finding_id?: string }).finding_id === "string"
            ? (f as { finding_id: string }).finding_id
            : "unknown";
        if ("error" in v) unscored.push({ finding_id: fid, reason: v.error });
        else verdicts.push(v);
      }
    }

    const priorMean = opts.priorMeanFn ? opts.priorMeanFn(fx.fixture_id) : null;
    const stats = computeGateStats(verdicts, priorMean);
    if (!stats.passesMark) anyProjectFailed = true;

    const roleSection = fixtureRoleSection(fixtureSampleIds(fx), opts.corpus.rolesFor);
    tally(roleSection, stats.passesMark);

    const scorecard = buildScorecard({
      fixtureId: fx.fixture_id,
      fixtureName: fx.name,
      verdicts,
      unscored,
      thresholds: THRESHOLDS,
      meta: { runId, flavor, tier, roleSection, subject: subject.kind, judge, priorMean },
    });
    sinks.writeScorecardJson(`${fx.fixture_id}.json`, JSON.stringify(scorecard, null, 2));
    sinks.writeScorecardMd(`${fx.fixture_id}.md`, renderScorecardMd(scorecard, { passRate: stats.passRate, priorMean }));

    console.log(
      `[eval] ${fx.fixture_id} [${subject.kind}]: scored=${verdicts.length} unscored=${unscored.length} passRate=${(stats.passRate * 100).toFixed(0)}% mark=${stats.passesMark ? "PASS" : "FAIL"}${stats.regression.regression ? " REGRESSION" : ""}`,
    );
  }

  // Readiness sections: role-aware split view per ADR-0007 (counts only; no
  // gating semantics — the corpus mark above remains the sole gate).
  console.log(`[eval] readiness sections (ADR-0007 roles; corpus=${opts.corpus.catalogedCount} cataloged):`);
  for (const section of ["engine-fewshot", "judge-calibration", "release-test", "reserve", "unlinked"] as RoleSection[]) {
    const t = sectionTally.get(section) ?? { fixtures: 0, pass: 0, fail: 0 };
    const dormant =
      section === "release-test" && opts.corpus.catalogedCount < RELEASE_TEST_CORPUS_FLOOR
        ? ` (dormant until corpus >= ${RELEASE_TEST_CORPUS_FLOOR})`
        : "";
    console.log(`[eval]   ${section}: ${t.fixtures} fixture(s), pass=${t.pass}, fail=${t.fail}${dormant}`);
  }

  // validation-state record.
  sinks.appendValidationState({
    date: new Date().toISOString(),
    validator_node: "E4 eval harness",
    scope: `Tier-1 judged evaluation over ${scopeFragment(flavor)} (run ${runId})`,
    method: `Pipeline-driven audits; ox-alpha judge (${judge.model} @ max); E1 owner thresholds (all dims>=1 AND substance=2 AND evidence=2; >=90% corpus mark; zero-drop regression)`,
    result: anyProjectFailed ? "FAILED — one or more projects below the corpus pass mark" : "PASSED — all sampled projects meet the corpus pass mark",
    follow_ups: anyProjectFailed ? ["Tier-2 review of failing projects before next AI-touching change"] : [],
  });

  console.log(`[eval] scorecards → state/eval-scorecards/${runId}`);
  if (anyProjectFailed) console.warn("[eval] NOTE: gate failure recorded; harness does not fail CI by design");
  return { runId, anyProjectFailed };
}

// ---- Top-up -------------------------------------------------------------------
// Re-judges ONLY unscored findings of an existing archive into a sibling
// `<runId>-completed` directory. Original archive files are never mutated;
// scored verdicts are carried over verbatim so determinism of prior results
// is preserved.

interface ParentCard {
  subject: string;
  verdicts: FindingVerdict[];
  findings_unscored: { finding_id: string }[];
  [key: string]: unknown;
}

export interface TopupOpts {
  files: FixtureDoc[];
  judge: EvalJudgeConfig;
  sinks: EvalSinks;
  parentArchive: {
    exists(): boolean;
    readCard(fixtureId: string): ParentCard | null;
  };
  priorMeanFn?: (fixtureId: string) => number | null;
}

export async function topupArchive(parentRunId: string, opts: TopupOpts): Promise<void> {
  if (!opts.parentArchive.exists()) {
    throw new EvalTopupMissingError(parentRunId);
  }
  if (!opts.judge.complete) {
    throw new Error("topup requires a judge transport");
  }
  const outDirName = `${parentRunId}-completed`;
  console.log(`[eval] topup ${parentRunId} -> ${outDirName} judge=${opts.judge.model}@${opts.judge.effort}`);
  const manifest: Record<string, unknown>[] = [];
  for (const fx of opts.files) {
    const card = opts.parentArchive.readCard(fx.fixture_id);
    if (!card) continue;
    const unscoredIds = new Set(card.findings_unscored.map((u) => u.finding_id));
    if (!unscoredIds.size || card.subject !== "judge-baseline") continue;
    const baselines = (fx.expected_findings_baseline ?? []) as { finding_id: string }[];
    const verdicts = [...card.verdicts];
    const stillUnscored: { finding_id: string; reason: string }[] = [];
    for (const f of baselines) {
      if (!unscoredIds.has(f.finding_id)) continue;
      console.log(`[eval] ${fx.fixture_id}: topping up ${f.finding_id}`);
      const v = await judgeFinding(
        f,
        { jurisdiction: fx.jurisdiction, framework: fx.jurisdiction + " pack", stage: fx.native_stage_id },
        { complete: opts.judge.complete },
      );
      if ("error" in v) stillUnscored.push({ finding_id: f.finding_id, reason: v.error });
      else verdicts.push(v);
    }
    const priorMean = opts.priorMeanFn ? opts.priorMeanFn(fx.fixture_id) : null;
    // Same single-sourced gate assembly as the main loop.
    const stats = computeGateStats(verdicts, priorMean);
    if (!stats.passesMark) console.warn(`[eval] ${fx.fixture_id}: topup gate FAIL`);
    const merged: ParentCard = {
      ...card,
      run_id: outDirName,
      findings_scored: verdicts.length,
      findings_unscored: stillUnscored,
      pass_rate: Math.round(stats.passRate * 1000) / 1000,
      passes_corpus_mark: stats.passesMark,
      mean_score: stats.meanScore,
      regression_vs_prior: stats.regression,
      tier2_review_required: stats.regression.regression || !stats.passesMark,
      verdicts,
      topup_of_run: parentRunId,
      generated_at: new Date().toISOString(),
    };
    opts.sinks.writeScorecardJson(`${fx.fixture_id}.json`, JSON.stringify(merged, null, 2));
    manifest.push({ fixture_id: fx.fixture_id, topped_up: [...unscoredIds], still_unscored: stillUnscored.map((x) => x.finding_id) });
    console.log(
      `[eval] ${fx.fixture_id} [${card.subject}]: scored=${verdicts.length} unscored=${stillUnscored.length} passRate=${(stats.passRate * 100).toFixed(0)}% mark=${stats.passesMark ? "PASS" : "FAIL"}${stats.regression.regression ? " REGRESSION" : ""}`,
    );
  }
  opts.sinks.writeScorecardJson("manifest.json", JSON.stringify({ parent_run: parentRunId, fixtures: manifest }, null, 2));
  console.log(`[eval] topup complete -> state/eval-scorecards/${outDirName}`);
}

