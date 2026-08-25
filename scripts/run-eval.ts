// E4 eval harness runner: drives the audit pipeline over corpus fixtures and
// produces ox-alpha-judged scorecards per the E1 ladder. CLI-plane only;
// workflow_dispatch CI uploads artifacts, never gates PRs.
//
// Usage:
//   OPENCODE_API_KEY=... npx tsx scripts/run-eval.ts            # corpus GF-6..16
//   OPENCODE_API_KEY=... npx tsx scripts/run-eval.ts --dry-run  # GF-1..5 known-goods (E1 pre-corpus validation)
//   npx tsx scripts/run-eval.ts --no-judge                      # deterministic snapshot check only
//   OPENCODE_API_KEY=... AI_ENABLED=true npx tsx scripts/run-eval.ts --live  # fixtures via runAllLiveArtifacts
//
// Policy (DEC 2026-08-23): --live spends paid inference tokens; owner-run only,
// on demand, never automated or CI-scheduled.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { runAudit } from "@/domain/engine";
import { getPipeline } from "@/domain/pipeline/pipeline";
import { extractJsonObject } from "@/lib/inference";
import { getAiAdapter } from "@/lib/ai";
import { DIMENSIONS, THRESHOLDS, type FindingVerdict } from "@/lib/eval-gates";
import {
  isScoredVerdict,
  passesFindingGate,
  projectMeanScore,
  projectPassRate,
  projectPassesCorpusMark,
  detectRegression,
} from "@/lib/eval-gates";
import type { AuditResult, InputValueState, JurisdictionId, Project } from "@/domain/types";

const T0 = "2026-08-22T00:00:00.000Z";
const ZEN_BASE = process.env.AI_BASE_URL ?? "https://opencode.ai/zen/v1";
const JUDGE_MODEL = process.env.AI_MODEL ?? "x-preview-f-free";
const JUDGE_EFFORT = "max"; // R7 effort map: judge = max

const DRY_RUN = process.argv.includes("--dry-run");
const NO_JUDGE = process.argv.includes("--no-judge");
const LIVE = process.argv.includes("--live");
const onlyIdx = process.argv.indexOf("--only");
const ONLY = onlyIdx !== -1 ? process.argv[onlyIdx + 1] : null;
const topupIdx = process.argv.indexOf("--topup");
const TOPUP = topupIdx !== -1 ? process.argv[topupIdx + 1] : null;
const JUDGE_TIMEOUT_MS = Number(process.env.JUDGE_TIMEOUT_MS ?? 150_000);

const ALL_FILES = DRY_RUN
  ? [
      "gf1-uk-urban-arterial-stage2.json",
      "gf2-usa-rural-highway-prelim.json",
      "gf3-uae-roundabout-combined-s12.json",
      "gf4-canada-pedestrian-planning.json",
      "gf5-int-roundabout-detailed.json",
    ]
  : [
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

const FILES = ONLY ? ALL_FILES.filter((f) => f.includes(ONLY)) : ALL_FILES;

interface Fixture {
  fixture_id: string;
  name: string;
  jurisdiction: string;
  native_stage_id: string;
  metadata: Project["metadata"];
  inputs: Record<string, { state: InputValueState; value?: string }>;
  expected_findings_baseline?: unknown[];
}

function toProject(fx: Fixture): Project {
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

// ---- Judge client (ox-alpha at effort=max via Zen; free model only) ----------

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

export async function judgeComplete(
  messages: { role: string; content: string }[],
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), JUDGE_TIMEOUT_MS);
  try {
    const res = await fetchImpl(`${ZEN_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: JUDGE_MODEL,
        messages,
        reasoning_effort: JUDGE_EFFORT,
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`judge HTTP ${res.status}`);
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("judge response missing content");
    return content;
  } finally {
    clearTimeout(timer);
  }
}

async function judgeFinding(
  finding: unknown,
  ctx: { jurisdiction: string; framework: string; stage: string },
  apiKey: string,
): Promise<FindingVerdict | { error: string }> {
  const user = [
    `Context: ${ctx.jurisdiction} / ${ctx.framework} / ${ctx.stage}.`,
    `Finding under evaluation:`,
    JSON.stringify(finding, null, 1),
  ].join("\n\n");
  const messages = [
    { role: "system", content: JUDGE_SYSTEM },
    { role: "user", content: user },
  ];
  let lastError = "";
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const parsed = extractJsonObject(await judgeComplete(messages, apiKey));
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

// ---- Main ---------------------------------------------------------------------


// ---- Top-up -------------------------------------------------------------------
// Re-judges ONLY unscored findings of an existing archive into a sibling
// `<runId>-completed` directory. Original archive files are never mutated;
// scored verdicts are carried over verbatim so determinism of prior results
// is preserved.
async function topupMain(parentRunId: string, apiKey: string) {
  const parentDir = path.join(process.cwd(), "state", "eval-scorecards", parentRunId);
  if (!existsSync(parentDir)) {
    console.error(`[eval] topup: no such archive ${parentRunId}`);
    process.exit(1);
  }
  const outDir = `${parentDir}-completed`;
  mkdirSync(outDir, { recursive: true });
  console.log(`[eval] topup ${parentRunId} -> ${path.basename(outDir)} judge=${JUDGE_MODEL}@${JUDGE_EFFORT}`);
  let anyFailed = false;
  const manifest: Record<string, unknown>[] = [];
  for (const file of FILES) {
    const fx = JSON.parse(readFileSync(path.join(process.cwd(), "tests/fixtures", file), "utf8")) as Fixture;
    const cardPath = path.join(parentDir, `${fx.fixture_id}.json`);
    if (!existsSync(cardPath)) continue;
    const card = JSON.parse(readFileSync(cardPath, "utf8")) as {
      subject: string; verdicts: FindingVerdict[]; findings_unscored: { finding_id: string }[];
    };
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
        apiKey,
      );
      if ("error" in v) stillUnscored.push({ finding_id: f.finding_id, reason: v.error });
      else verdicts.push(v);
    }
    const passRate = projectPassRate(verdicts);
    const passesMark = projectPassesCorpusMark(verdicts);
    if (!passesMark) anyFailed = true;
    const meanScore = projectMeanScore(verdicts);
    const priorMean = findPriorRunMean(fx.fixture_id);
    const regression = detectRegression(meanScore, priorMean);
    const merged = {
      ...card,
      run_id: path.basename(outDir),
      findings_scored: verdicts.length,
      findings_unscored: stillUnscored,
      pass_rate: Math.round(passRate * 1000) / 1000,
      passes_corpus_mark: passesMark,
      mean_score: meanScore,
      regression_vs_prior: regression,
      tier2_review_required: regression.regression || !passesMark,
      verdicts,
      topup_of_run: parentRunId,
      generated_at: new Date().toISOString(),
    };
    writeFileSync(path.join(outDir, `${fx.fixture_id}.json`), JSON.stringify(merged, null, 2));
    manifest.push({ fixture_id: fx.fixture_id, topped_up: [...unscoredIds], still_unscored: stillUnscored.map((x) => x.finding_id) });
    console.log(
      `[eval] ${fx.fixture_id} [${card.subject}]: scored=${verdicts.length} unscored=${stillUnscored.length} passRate=${(passRate * 100).toFixed(0)}% mark=${passesMark ? "PASS" : "FAIL"}${regression.regression ? " REGRESSION" : ""}`,
    );
  }
  writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify({ parent_run: parentRunId, fixtures: manifest }, null, 2));
  console.log(`[eval] topup complete -> state/eval-scorecards/${path.basename(outDir)}`);
}

const MODE = LIVE ? (DRY_RUN ? "dry-run-live" : "corpus-live") : DRY_RUN ? "dry-run" : "corpus";

async function main() {
  if (LIVE && (process.env.AI_ENABLED !== "true" || !process.env.OPENCODE_API_KEY)) {
    console.error("[eval] --live requires AI_ENABLED=true and OPENCODE_API_KEY in the environment");
    process.exit(1);
  }
  const apiKey = process.env.OPENCODE_API_KEY ?? "";
  if (!NO_JUDGE && !apiKey) {
    console.error("[eval] OPENCODE_API_KEY required for the judge phase (or pass --no-judge)");
    process.exit(1);
  }

  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.join(process.cwd(), "state", "eval-scorecards", runId);
  mkdirSync(outDir, { recursive: true });

  console.log(`[eval] run ${runId} mode=${DRY_RUN ? "dry-run(GF-1..5)" : "corpus(GF-6..16)"}${LIVE ? "+live" : ""} judge=${NO_JUDGE ? "off" : JUDGE_MODEL}@${JUDGE_EFFORT}`);

  let anyProjectFailed = false;

  for (const file of FILES) {
    const fx = JSON.parse(
      readFileSync(path.join(process.cwd(), "tests/fixtures", file), "utf8"),
    ) as Fixture;
    const project = toProject(fx);

    // Phase 1: deterministic Tier-0 check (--live conducts candidate
    // generation through the pipeline's async driver; findings unchanged).
    const result: AuditResult = LIVE
      ? (
          await getPipeline().runAllLiveArtifacts(project, T0, {
            aiAdapter: getAiAdapter(),
          })
        ).result
      : runAudit(project, T0);
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
    if (!NO_JUDGE && subject.kind !== "none") {
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
          apiKey,
        );
        const fid =
          typeof (f as { finding_id?: string }).finding_id === "string"
            ? (f as { finding_id: string }).finding_id
            : "unknown";
        if ("error" in v) unscored.push({ finding_id: fid, reason: v.error });
        else verdicts.push(v);
      }
    }

    const meanScore = projectMeanScore(verdicts);
    const priorMean = findPriorRunMean(fx.fixture_id);
    const regression = detectRegression(meanScore, priorMean);
    const passRate = projectPassRate(verdicts);
    const passesMark = NO_JUDGE ? true : projectPassesCorpusMark(verdicts);
    if (!passesMark) anyProjectFailed = true;

    const scorecard = {
      run_id: runId,
      fixture_id: fx.fixture_id,
      fixture_name: fx.name,
      mode: MODE,
      subject: subject.kind,
      judge: NO_JUDGE
        ? { enabled: false }
        : { model: JUDGE_MODEL, effort: JUDGE_EFFORT, gateway: ZEN_BASE, identity: "ox-alpha" },
      thresholds: THRESHOLDS,
      findings_scored: verdicts.length,
      findings_unscored: unscored,
      pass_rate: Math.round(passRate * 1000) / 1000,
      passes_corpus_mark: passesMark,
      mean_score: meanScore,
      regression_vs_prior: regression,
      tier2_review_required: regression.regression || !passesMark,
      verdicts,
      generated_at: new Date().toISOString(),
    };
    writeFileSync(path.join(outDir, `${fx.fixture_id}.json`), JSON.stringify(scorecard, null, 2));

    // Markdown rendering.
    const md: string[] = [
      `# Eval scorecard — ${fx.fixture_id} (${fx.name})`,
      ``,
      `- Run: \`${runId}\` (${scorecard.mode})`,
      `- Judge: ${NO_JUDGE ? "disabled" : `${JUDGE_MODEL} @ effort ${JUDGE_EFFORT} (ox-alpha)`}`,
      `- Subject: ${subject.kind} (${verdicts.length} scored${unscored.length ? ` · ${unscored.length} unscored` : ""})`,
      `- Pass rate: **${Math.round(passRate * 100)}%** vs corpus mark **${THRESHOLDS.corpusPassMark * 100}%** → ${passesMark ? "PASS" : "**FAIL**"}`,
      `- Mean dimension total: ${meanScore}${priorMean !== null ? ` (prior ${priorMean}, delta ${regression.delta}${regression.regression ? " → **REGRESSION — Tier-2 review**" : ""})` : ""}`,
      ``,
    ];
    for (const v of verdicts) {
      md.push(
        `## ${v.finding_id} — gate ${passesFindingGate(v) ? "PASS" : "FAIL"} (${Object.values(v.scores).join("/")})`,
      );
      for (const d of DIMENSIONS) md.push(`- **${d}:** ${v.scores[d]} — ${v.justifications[d]}`);
      md.push("");
    }
    for (const u of unscored) md.push(`## ${u.finding_id} — UNSCORED (${u.reason})`, "");
    writeFileSync(path.join(outDir, `${fx.fixture_id}.md`), md.join("\n"));

    console.log(
      `[eval] ${fx.fixture_id} [${subject.kind}]: scored=${verdicts.length} unscored=${unscored.length} passRate=${(passRate * 100).toFixed(0)}% mark=${passesMark ? "PASS" : "FAIL"}${regression.regression ? " REGRESSION" : ""}`,
    );
  }

  // validation-state record.
  const vstatePath = path.join(process.cwd(), "state", "validation-state.json");
  const vstate = JSON.parse(readFileSync(vstatePath, "utf8"));
  const seq = String(vstate.validations.length + 1).padStart(3, "0");
  vstate.validations.push({
    validation_id: `VAL-2026-08-22-${seq}`,
    date: new Date().toISOString(),
    validator_node: "E4 eval harness",
    scope: `Tier-1 judged evaluation over ${DRY_RUN ? "GF-1..5 dry-run" : "corpus GF-6..16"}${LIVE ? " [live]" : ""} (run ${runId})`,
    method: `Pipeline-driven audits; ox-alpha judge (${JUDGE_MODEL} @ max); E1 owner thresholds (all dims>=1 AND substance=2 AND evidence=2; >=90% corpus mark; zero-drop regression)`,
    result: anyProjectFailed ? "FAILED — one or more projects below the corpus pass mark" : "PASSED — all sampled projects meet the corpus pass mark",
    follow_ups: anyProjectFailed ? ["Tier-2 review of failing projects before next AI-touching change"] : [],
  });
  writeFileSync(vstatePath, JSON.stringify(vstate, null, 2) + "\n");

  console.log(`[eval] scorecards → state/eval-scorecards/${runId}`);
  if (anyProjectFailed) console.warn("[eval] NOTE: gate failure recorded; harness does not fail CI by design");
}

async function entry() {
  if (TOPUP) {
    const apiKey = process.env.OPENCODE_API_KEY ?? "";
    if (!apiKey) { console.error("[eval] OPENCODE_API_KEY required for topup"); process.exit(1); }
    await topupMain(TOPUP, apiKey);
    return;
  }
  await main();
}

const INVOKED_AS_CLI =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (INVOKED_AS_CLI) {
  entry().catch((e) => {
    console.error("[eval] harness failure:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
