// E4 eval harness CLI: argv parsing, env retrieval, fs sink construction and
// invocation of the deep src/lib/eval-run.ts module (suite/topup/gates/judge
// live there now). CLI-plane only; workflow_dispatch CI uploads artifacts,
// never gates PRs.
//
// Usage:
//   OPENCODE_API_KEY=... npx tsx scripts/run-eval.ts            # corpus GF-6..16
//   OPENCODE_API_KEY=... npx tsx scripts/run-eval.ts --dry-run  # GF-1..5 known-goods (E1 pre-corpus validation)
//   npx tsx scripts/run-eval.ts --no-judge                      # deterministic snapshot check only
//   OPENCODE_API_KEY=... AI_ENABLED=true npx tsx scripts/run-eval.ts --live  # fixtures via runAllLiveArtifacts
//   OPENCODE_API_KEY=... npx tsx scripts/run-eval.ts --mode release-test      # real-sample tier (ADR-0007; refuses while corpus < 100)
//
// Policy (DEC 2026-08-23): --live spends paid inference tokens; owner-run only,
// on demand, never automated or CI-scheduled.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { runAudit } from "@/domain/engine";
import { getPipeline } from "@/domain/pipeline/pipeline";
import { getAiAdapter } from "@/lib/ai";
import {
  KNOWN_FILES,
  EVAL_REFUSAL_EXIT_CODE,
  EvalRefusalError,
  EvalTopupMissingError,
  findPriorRunMean,
  makeZenJudgeComplete,
  parseRunMode,
  runEvalSuite,
  topupArchive,
  type EvalMode,
  type FixtureDoc,
  type ValidationRecordInput,
} from "@/lib/eval-run";

const DRY_RUN = process.argv.includes("--dry-run");
const NO_JUDGE = process.argv.includes("--no-judge");
const LIVE = process.argv.includes("--live");
const onlyIdx = process.argv.indexOf("--only");
const ONLY = onlyIdx !== -1 ? process.argv[onlyIdx + 1] : null;
const topupIdx = process.argv.indexOf("--topup");
const TOPUP = topupIdx !== -1 ? process.argv[topupIdx + 1] : null;

export { parseRunMode };
export type { EvalMode };

export let RUN_MODE: EvalMode;
try {
  RUN_MODE = parseRunMode(process.argv);
} catch (e) {
  console.error(`[eval] ${(e as Error).message}`);
  process.exit(1);
}

const ZEN_BASE = process.env.AI_BASE_URL ?? "https://opencode.ai/zen/v1";
const JUDGE_MODEL = process.env.AI_MODEL ?? "x-preview-f-free";
const JUDGE_EFFORT = "max"; // R7 effort map: judge = max
const JUDGE_TIMEOUT_MS = Number(process.env.JUDGE_TIMEOUT_MS ?? 150_000);

const ALL_FILES = DRY_RUN ? KNOWN_FILES["dry-run"] : KNOWN_FILES.corpus;
const FILES = ONLY ? ALL_FILES.filter((f) => f.includes(ONLY)) : ALL_FILES;

interface SampleCorpusCatalog {
  samples: { id: string; roles: string[] }[];
}

function loadFixtures(): FixtureDoc[] {
  return FILES.map(
    (file) =>
      JSON.parse(readFileSync(path.join(process.cwd(), "tests/fixtures", file), "utf8")) as FixtureDoc,
  );
}

function makeSinks(outDir: string) {
  return {
    writeScorecardJson(fileName: string, contents: string) {
      writeFileSync(path.join(outDir, fileName), contents);
    },
    writeScorecardMd(fileName: string, contents: string) {
      writeFileSync(path.join(outDir, fileName), contents);
    },
    appendValidationState(record: ValidationRecordInput) {
      const vstatePath = path.join(process.cwd(), "state", "validation-state.json");
      const vstate = JSON.parse(readFileSync(vstatePath, "utf8"));
      const seq = String(vstate.validations.length + 1).padStart(3, "0");
      vstate.validations.push({
        validation_id: `VAL-2026-08-22-${seq}`,
        ...record,
      });
      writeFileSync(vstatePath, JSON.stringify(vstate, null, 2) + "\n");
    },
  };
}

async function entry() {
  if (TOPUP) {
    const apiKey = process.env.OPENCODE_API_KEY ?? "";
    if (!apiKey) { console.error("[eval] OPENCODE_API_KEY required for topup"); process.exit(1); }
    const parentDir = path.join(process.cwd(), "state", "eval-scorecards", TOPUP);
    if (!existsSync(parentDir)) {
      // EvalTopupMissingError path prints the identical message + exit 1.
      console.error(`[eval] topup: no such archive ${TOPUP}`);
      process.exit(1);
    }
    const outDir = `${parentDir}-completed`;
    mkdirSync(outDir, { recursive: true });
    await topupArchive(TOPUP, {
      files: loadFixtures(),
      judge: {
        complete: makeZenJudgeComplete({
          baseUrl: ZEN_BASE,
          apiKey,
          model: JUDGE_MODEL,
          effort: "max",
          timeoutMs: JUDGE_TIMEOUT_MS,
        }),
        model: JUDGE_MODEL,
        effort: JUDGE_EFFORT,
        gateway: ZEN_BASE,
      },
      sinks: makeSinks(outDir),
      priorMeanFn: (fid) => findPriorRunMean(fid),
      parentArchive: {
        exists: () => existsSync(parentDir),
        readCard: (fixtureId) => {
          const cardPath = path.join(parentDir, `${fixtureId}.json`);
          if (!existsSync(cardPath)) return null;
          return JSON.parse(readFileSync(cardPath, "utf8"));
        },
      },
    });
    return;
  }

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

  const corpus = JSON.parse(
    readFileSync(path.join(process.cwd(), "state", "sample-corpus.json"), "utf8"),
  ) as SampleCorpusCatalog;
  const roleById: Record<string, string[]> = {};
  for (const s of corpus.samples) roleById[s.id] = s.roles;

  try {
    await runEvalSuite({
      files: loadFixtures(),
      runId,
      flavor: LIVE ? (DRY_RUN ? "dry-run-live" : "corpus-live") : DRY_RUN ? "dry-run" : "corpus",
      tier: RUN_MODE,
      judge: {
        complete: NO_JUDGE
          ? null
          : makeZenJudgeComplete({
              baseUrl: ZEN_BASE,
              apiKey,
              model: JUDGE_MODEL,
              effort: "max",
              timeoutMs: JUDGE_TIMEOUT_MS,
            }),
        model: JUDGE_MODEL,
        effort: JUDGE_EFFORT,
        gateway: ZEN_BASE,
      },
      auditRunner: (project, t0) =>
        LIVE
          ? getPipeline().runAllLiveArtifacts(project, t0, { aiAdapter: getAiAdapter() }).then((r) => r.result)
          : runAudit(project, t0),
      sinks: makeSinks(outDir),
      corpus: { catalogedCount: corpus.samples.length, rolesFor: (id) => roleById[id] },
      priorMeanFn: (fid) => findPriorRunMean(fid),
    });
  } catch (e) {
    if (e instanceof EvalRefusalError) {
      console.error(`[eval] REFUSED: ${e.message}`);
      process.exit(EVAL_REFUSAL_EXIT_CODE);
    }
    throw e;
  }
}

const INVOKED_AS_CLI =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (INVOKED_AS_CLI) {
  entry().catch((e) => {
    if (e instanceof EvalTopupMissingError) {
      console.error(`[eval] topup: no such archive ${e.message}`);
      process.exit(1);
    }
    console.error("[eval] harness failure:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
