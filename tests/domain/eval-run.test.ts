// C1 deepening: the E4 harness core is exercised through the src/lib/eval-run
// module interface with injected fake judges/sinks — hermetic, no fs writes
// outside tmpdirs. Covers transport delegation, retry backoff schedule, gate
// single-sourcing across main/topup paths, topup merge semantics, and the
// ADR-0007 refusal path.
import { describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  EVAL_REFUSAL_EXIT_CODE,
  EvalRefusalError,
  EvalTopupMissingError,
  buildScorecard,
  findPriorRunMean,
  judgeFinding,
  makeZenJudgeComplete,
  runEvalSuite,
  topupArchive,
  type EvalSinks,
  type FixtureDoc,
  type ValidationRecordInput,
} from "../../src/lib/eval-run";
import { DIMENSIONS, THRESHOLDS, type FindingVerdict } from "@/lib/eval-gates";
import type { AuditResult } from "@/domain/types";

const API_KEY = "sk-judge";

function fakeFetch(payloads: { status?: number; body?: string }[], calls: string[] = []) {
  let i = 0;
  return (async (url: string | URL | Request) => {
    calls.push(String(url));
    const p = payloads[Math.min(i, payloads.length - 1)];
    i += 1;
    const status = p.status ?? 200;
    if (status >= 400) return new Response(p.body ?? "", { status });
    return new Response(
      p.body ?? JSON.stringify({ choices: [{ message: { content: "{\"finding_id\":\"f1\"}" } }] }),
      { status },
    );
  }) as typeof fetch;
}

function verdict(id: string, substance = 2): FindingVerdict {
  return {
    finding_id: id,
    scores: {
      substance,
      evidence_grounding: 2,
      jurisdiction_correctness: 2,
      recommendation_quality: 2,
      vru_coverage: 1,
    },
    justifications: Object.fromEntries(
      DIMENSIONS.map((d) => [d, `${d} justified`]),
    ) as FindingVerdict["justifications"],
  };
}

function memorySinks(): EvalSinks & {
  json: Map<string, string>;
  md: Map<string, string>;
  vstate: ValidationRecordInput[];
} {
  const json = new Map<string, string>();
  const md = new Map<string, string>();
  const vstate: ValidationRecordInput[] = [];
  return {
    json,
    md,
    vstate,
    writeScorecardJson: (fileName, contents) => void json.set(fileName, contents),
    writeScorecardMd: (fileName, contents) => void md.set(fileName, contents),
    appendValidationState: (record) => void vstate.push(record),
  };
}

function fixtureDoc(overrides: Partial<FixtureDoc> = {}): FixtureDoc {
  return {
    fixture_id: "GF-T",
    name: "Test fixture",
    jurisdiction: "uk",
    native_stage_id: "stage-2",
    metadata: { name: "T", description: "", scheme_summary: "", authority: "", location: "" },
    inputs: {},
    ...overrides,
  };
}

/** Only the six fields the harness reads; cast keeps the fake hermetic. */
function fakeResult(findings: { finding_id: string }[]): AuditResult {
  return {
    findings,
    missing_information: [],
    jurisdiction: "uk",
    framework_name: "UK pack",
    native_stage_id: "stage-2",
    native_stage_display_name: "Stage 2",
  } as unknown as AuditResult;
}

describe("judge transport via makeZenJudgeComplete", () => {
  it("posts the rubric request to the zen gateway and returns message content", async () => {
    const calls: string[] = [];
    let capturedBody: Record<string, unknown> | null = null;
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push(String(url));
      capturedBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      return new Response(JSON.stringify({ choices: [{ message: { content: "VERDICT" } }] }), {
        status: 200,
      });
    }) as typeof fetch;

    const complete = makeZenJudgeComplete({
      baseUrl: "https://opencode.ai/zen/v1",
      apiKey: API_KEY,
      model: "x-preview-f-free",
      effort: "max",
      fetchImpl,
    });
    const out = await complete([{ role: "system", content: "sys" }]);

    expect(out).toBe("VERDICT");
    expect(calls).toEqual(["https://opencode.ai/zen/v1/chat/completions"]);
    expect(capturedBody!.model).toBe("x-preview-f-free");
    expect(capturedBody!.reasoning_effort).toBe("max");
  });

  it("propagates non-ok gateway responses as transport errors", async () => {
    const fetchImpl = fakeFetch([{ status: 503 }]);
    const complete = makeZenJudgeComplete({
      baseUrl: "https://opencode.ai/zen/v1",
      apiKey: API_KEY,
      model: "x-preview-f-free",
      effort: "max",
      fetchImpl,
    });
    await expect(complete([])).rejects.toThrow(/HTTP 503/);
  });

  it("throws when the response carries no message content", async () => {
    const fetchImpl = fakeFetch([{ body: JSON.stringify({ choices: [] }) }]);
    const complete = makeZenJudgeComplete({
      baseUrl: "https://opencode.ai/zen/v1",
      apiKey: API_KEY,
      model: "x-preview-f-free",
      effort: "max",
      fetchImpl,
    });
    await expect(complete([])).rejects.toThrow(/response missing .*content/);
  });
});

describe("judgeFinding retry schedule", () => {
  const ctx = { jurisdiction: "uk", framework: "uk pack", stage: "stage-2" };

  it("backs off 2s/4s/8s on transport errors and recovers on the 4th attempt", async () => {
    vi.useFakeTimers();
    try {
      const times: number[] = [];
      let calls = 0;
      const good = verdict("f1");
      const complete = vi.fn(async () => {
        times.push(Date.now());
        calls += 1;
        if (calls < 4) throw new Error("HTTP 503");
        return JSON.stringify(good);
      });

      const pending = judgeFinding({ finding_id: "f1" }, ctx, { complete });
      await vi.runAllTimersAsync();
      const out = await pending;

      expect(out).toEqual(good);
      expect(complete).toHaveBeenCalledTimes(4);
      expect(times[1] - times[0]).toBe(2000);
      expect(times[2] - times[1]).toBe(4000);
      expect(times[3] - times[2]).toBe(8000);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not sleep for rubric-shape failures; exhausts attempts into an error verdict", async () => {
    vi.useFakeTimers();
    try {
      const complete = vi.fn(async () => JSON.stringify({ finding_id: "f1", wrong: true }));
      // No timer advancement: shape failures must not schedule backoff sleeps.
      const out = await judgeFinding({ finding_id: "f1" }, ctx, { complete });
      expect(out).toEqual({ error: "verdict failed rubric shape" });
      expect(complete).toHaveBeenCalledTimes(4);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("findPriorRunMean", () => {
  it("reads the mean score from the most recent run containing the fixture", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "eval-scorecards-"));
    try {
      mkdirSync(path.join(dir, "run-a"), { recursive: true });
      mkdirSync(path.join(dir, "run-b"), { recursive: true });
      writeFileSync(path.join(dir, "run-a", "gf6.json"), JSON.stringify({ mean_score: 7.5 }));
      writeFileSync(path.join(dir, "run-b", "gf6.json"), JSON.stringify({ mean_score: 8.25 }));

      expect(findPriorRunMean("gf6", dir)).toBe(8.25);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("falls back to older runs and skips unparsable scorecards", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "eval-scorecards-"));
    try {
      mkdirSync(path.join(dir, "run-a"), { recursive: true });
      mkdirSync(path.join(dir, "run-b"), { recursive: true });
      writeFileSync(path.join(dir, "run-a", "gf9.json"), JSON.stringify({ mean_score: 6 }));
      writeFileSync(path.join(dir, "run-b", "gf9.json"), "{not json");

      expect(findPriorRunMean("gf9", dir)).toBe(6);
      expect(findPriorRunMean("gf404", dir)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns null when no scorecards directory exists", () => {
    expect(findPriorRunMean("gf1", path.join(os.tmpdir(), "no-such-dir-eval"))).toBeNull();
  });
});

describe("buildScorecard byte-compat shape", () => {
  it("emits the archived field order and correct gate fields", () => {
    const card = buildScorecard({
      fixtureId: "GF-1",
      fixtureName: "Known good",
      verdicts: [verdict("f1")],
      unscored: [],
      thresholds: THRESHOLDS,
      meta: {
        runId: "run-x",
        flavor: "dry-run",
        tier: "corpus",
        roleSection: "unlinked",
        subject: "engine-findings",
        judge: { complete: async () => "", model: "x-preview-f-free", effort: "max", gateway: "gw" },
        priorMean: 7,
        generatedAt: "2026-08-25T00:00:00.000Z",
      },
    });
    expect(Object.keys(card)).toEqual([
      "run_id",
      "fixture_id",
      "fixture_name",
      "mode",
      "run_tier",
      "role_section",
      "subject",
      "judge",
      "thresholds",
      "findings_scored",
      "findings_unscored",
      "pass_rate",
      "passes_corpus_mark",
      "mean_score",
      "regression_vs_prior",
      "tier2_review_required",
      "verdicts",
      "generated_at",
    ]);
    expect(card.pass_rate).toBe(1);
    expect(card.passes_corpus_mark).toBe(true);
    expect(card.tier2_review_required).toBe(false); // improvement over prior
  });

  it("forces the pass mark only when judging is disabled", () => {
    const failing: FindingVerdict[] = [verdict("f1", 0)];
    const metaBase = {
      runId: "r",
      flavor: "corpus" as const,
      tier: "corpus" as const,
      roleSection: "unlinked" as const,
      subject: "none" as const,
      judge: { model: "m", effort: "max" },
      priorMean: null,
      generatedAt: "2026-08-25T00:00:00.000Z",
    };
    const off = buildScorecard({
      fixtureId: "GF-1",
      fixtureName: "n",
      verdicts: failing,
      unscored: [],
      thresholds: THRESHOLDS,
      meta: { ...metaBase, judge: { ...metaBase.judge, complete: null } },
    });
    const on = buildScorecard({
      fixtureId: "GF-1",
      fixtureName: "n",
      verdicts: failing,
      unscored: [],
      thresholds: THRESHOLDS,
      meta: { ...metaBase, judge: { ...metaBase.judge, complete: async () => "" } },
    });
    expect(off.passes_corpus_mark).toBe(true); // --no-judge snapshot check cannot fail its gate
    expect(on.passes_corpus_mark).toBe(false);
  });
});

const GATE_FIELDS = [
  "pass_rate",
  "passes_corpus_mark",
  "mean_score",
  "regression_vs_prior",
  "tier2_review_required",
] as const;

describe("gate math single-sourced across paths", () => {
  it("main loop, builder, and topup merge agree on every gate field for identical verdict sets", async () => {
    const v1 = verdict("f1");
    const v2 = verdict("f2", 1); // passes per-dim minimums but substance<2 → fails finding gate
    const priorMean = 9; // above both means → zero-drop regression fires identically everywhere

    // Path A: full main-loop suite through injected sinks/judge.
    const sinksA = memorySinks();
    await runEvalSuite({
      files: [
        fixtureDoc({
          fixture_id: "GF-A",
          name: "A",
          metadata: { name: "A", description: "", scheme_summary: "", authority: "", location: "" },
        }),
      ],
      runId: "2026-08-25T00-00-00-000Z",
      flavor: "corpus",
      tier: "corpus",
      judge: {
        complete: vi
          .fn()
          .mockResolvedValueOnce(JSON.stringify(v1))
          .mockResolvedValueOnce(JSON.stringify(v2)),
        model: "j",
        effort: "max",
        gateway: "gw",
      },
      auditRunner: () => fakeResult([{ finding_id: "f1" }, { finding_id: "f2" }]),
      sinks: sinksA,
      corpus: { catalogedCount: 120, rolesFor: () => ["release-test"] },
      priorMeanFn: () => priorMean,
    });
    const cardA = JSON.parse(sinksA.json.get("GF-A.json")!) as Record<string, unknown>;

    // Path B: direct scorecard builder, same verdict set.
    const cardB = buildScorecard({
      fixtureId: "GF-A",
      fixtureName: "A",
      verdicts: [v1, v2],
      unscored: [],
      thresholds: THRESHOLDS,
      meta: {
        runId: "2026-08-25T00-00-00-000Z",
        flavor: "corpus",
        tier: "corpus",
        roleSection: "release-test",
        subject: "engine-findings",
        judge: { complete: async () => "", model: "j", effort: "max", gateway: "gw" },
        priorMean,
        generatedAt: cardA.generated_at as string,
      },
    });

    // Path C: topup merging a one-verdict parent into the same final set.
    const sinksC = memorySinks();
    await topupArchive("parent-run", {
      files: [fixtureDoc({ fixture_id: "GF-A", expected_findings_baseline: [{ finding_id: "f2" }] })],
      judge: { complete: async () => JSON.stringify(v2), model: "j", effort: "max" },
      sinks: sinksC,
      priorMeanFn: () => priorMean,
      parentArchive: {
        exists: () => true,
        readCard: () =>
          ({
            subject: "judge-baseline",
            verdicts: [v1],
            findings_unscored: [{ finding_id: "f2" }],
          }) as { subject: string; verdicts: FindingVerdict[]; findings_unscored: { finding_id: string }[] },
      },
    });
    const cardC = JSON.parse(sinksC.json.get("GF-A.json")!) as Record<string, unknown>;

    for (const field of GATE_FIELDS) {
      expect(cardA[field], `path A vs B: ${field}`).toEqual(cardB[field]);
      expect(cardB[field], `path B vs C: ${field}`).toEqual(cardC[field]);
    }
    // Sanity on the shared numbers themselves: mean (9+8)/2 = 8.5 vs prior 9.
    expect(cardB.pass_rate).toBe(0.5);
    expect(cardB.passes_corpus_mark).toBe(false);
    expect(cardB.regression_vs_prior).toEqual({ regression: true, delta: -0.5 });
    expect(cardB.tier2_review_required).toBe(true);
  });
});

describe("topupArchive merge semantics", () => {
  it("carries scored verdicts verbatim and merges only newly scored ones", async () => {
    const sinks = memorySinks();
    const v1 = verdict("keep-1");
    const v2 = verdict("keep-2", 1);
    const fresh = verdict("new-3");

    await topupArchive("parent-run", {
      files: [fixtureDoc({ expected_findings_baseline: [{ finding_id: "new-3" }] })],
      judge: { complete: async () => JSON.stringify(fresh), model: "j", effort: "max" },
      sinks,
      priorMeanFn: () => null,
      parentArchive: {
        exists: () => true,
        readCard: () =>
          ({
            subject: "judge-baseline",
            verdicts: [v1, v2],
            findings_unscored: [{ finding_id: "new-3" }],
            mode: "corpus",
          }) as unknown as { subject: string; verdicts: FindingVerdict[]; findings_unscored: { finding_id: string }[] },
      },
    });

    const merged = JSON.parse(sinks.json.get("GF-T.json")!) as {
      verdicts: FindingVerdict[];
      findings_scored: number;
      findings_unscored: unknown[];
      run_id: string;
      topup_of_run: string;
      subject: string;
      mode: string;
    };

    expect(merged.verdicts).toHaveLength(3);
    expect(merged.verdicts[0]).toEqual(v1); // carried over verbatim
    expect(merged.verdicts[1]).toEqual(v2);
    expect(merged.verdicts[2]).toEqual(fresh);
    expect(merged.findings_scored).toBe(3);
    expect(merged.findings_unscored).toEqual([]);
    expect(merged.run_id).toBe("parent-run-completed");
    expect(merged.topup_of_run).toBe("parent-run");
    expect(merged.subject).toBe("judge-baseline"); // untouched parent fields survive
    expect(merged.mode).toBe("corpus");
    const manifest = JSON.parse(sinks.json.get("manifest.json")!) as {
      parent_run: string;
      fixtures: { topped_up: string[] }[];
    };
    expect(manifest.parent_run).toBe("parent-run");
    expect(manifest.fixtures[0].topped_up).toEqual(["new-3"]);
  });

  it("records still-unscored findings when the judge errors on the top-up", async () => {
    const sinks = memorySinks();
    await topupArchive("p", {
      files: [fixtureDoc({ fixture_id: "GF-U", expected_findings_baseline: [{ finding_id: "u1" }] })],
      judge: {
        complete: async () => {
          throw new Error("judge exploded");
        },
        model: "j",
        effort: "max",
      },
      sinks,
      priorMeanFn: () => null,
      parentArchive: {
        exists: () => true,
        readCard: () =>
          ({
            subject: "judge-baseline",
            verdicts: [],
            findings_unscored: [{ finding_id: "u1" }],
          }) as unknown as { subject: string; verdicts: FindingVerdict[]; findings_unscored: { finding_id: string }[] },
      },
    });
    const merged = JSON.parse(sinks.json.get("GF-U.json")!) as {
      findings_unscored: { finding_id: string; reason: string }[];
    };
    expect(merged.findings_unscored).toEqual([{ finding_id: "u1", reason: "judge exploded" }]);
  });

  it("skips cards that are not judge baselines or have nothing unscored", async () => {
    const sinks = memorySinks();
    await topupArchive("p", {
      files: [fixtureDoc()],
      judge: { complete: async () => "", model: "j", effort: "max" },
      sinks,
      parentArchive: {
        exists: () => true,
        readCard: () =>
          ({
            subject: "engine-findings",
            verdicts: [],
            findings_unscored: [],
          }) as unknown as { subject: string; verdicts: FindingVerdict[]; findings_unscored: { finding_id: string }[] },
      },
    });
    expect(sinks.json.has("GF-T.json")).toBe(false);
    const manifest = JSON.parse(sinks.json.get("manifest.json")!) as { fixtures: unknown[] };
    expect(manifest.fixtures).toEqual([]);
  });

  it("throws the typed missing-archive error before any sink fires", async () => {
    const sinks = memorySinks();
    await expect(
      topupArchive("ghost", {
        files: [],
        judge: { complete: async () => "", model: "j", effort: "max" },
        sinks,
        parentArchive: { exists: () => false, readCard: () => null },
      }),
    ).rejects.toBeInstanceOf(EvalTopupMissingError);
    expect(sinks.json.size).toBe(0);
  });
});

describe("ADR-0007 refusal path", () => {
  it("refuses a dormant release-test tier via typed error mapped to exit code 2", async () => {
    const sinks = memorySinks();
    await expect(
      runEvalSuite({
        files: [fixtureDoc()],
        runId: "2026-08-25T00-00-00-000Z",
        flavor: "corpus",
        tier: "release-test",
        judge: { complete: null, model: "x-preview-f-free", effort: "max" },
        auditRunner: () => fakeResult([]),
        sinks,
        corpus: { catalogedCount: 99, rolesFor: () => undefined },
      }),
    ).rejects.toSatisfy((e: unknown) => {
      expect(e).toBeInstanceOf(EvalRefusalError);
      expect((e as Error).message).toMatch(/dormant until corpus >= 100/);
      expect((e as Error).message).toMatch(/currently 99/);
      return true;
    });
    expect(EVAL_REFUSAL_EXIT_CODE).toBe(2);
    expect(sinks.json.size).toBe(0); // refused before any archive write
  });
});

describe("runEvalSuite console + validation-state contract", () => {
  it("stamps scope GF-1..5 dry-run, prints legacy lines, counts readiness sections", async () => {
    const log: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      log.push(args.join(" "));
    });
    try {
      const sinks = memorySinks();
      await runEvalSuite({
        files: [fixtureDoc({ fixture_id: "GF-S" })],
        runId: "2026-08-25T00-00-00-000Z",
        flavor: "dry-run",
        tier: "corpus",
        judge: { complete: null, model: "x-preview-f-free", effort: "max" },
        auditRunner: () => fakeResult([]),
        sinks,
        corpus: { catalogedCount: 78, rolesFor: () => undefined },
      });

      expect(log).toContain("[eval] run 2026-08-25T00-00-00-000Z mode=dry-run(GF-1..5) tier=corpus judge=off@max");
      expect(log).toContain("[eval] GF-S: engine produced 0 findings, 0 MI");
      expect(log).toContain("[eval] GF-S [none]: scored=0 unscored=0 passRate=100% mark=PASS");
      expect(log.some((l) => l.includes("(dormant until corpus >= 100)"))).toBe(true);

      const record = sinks.vstate[0] as { validator_node: string; scope: string; result: string; method: string };
      expect(record.validator_node).toBe("E4 eval harness");
      expect(record.scope).toContain("GF-1..5 dry-run");
      expect(record.scope).not.toContain("[live]");
      expect(record.result).toMatch(/^PASSED/);
      expect(record.method).toContain("ox-alpha judge");
    } finally {
      spy.mockRestore();
    }
  });

  it("warns without failing when a fixture misses the corpus mark", async () => {
    const log: string[] = [];
    const warn: string[] = [];
    const logSpy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => void log.push(args.join(" ")));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => void warn.push(args.join(" ")));
    try {
      const summary = await runEvalSuite({
        files: [fixtureDoc({ fixture_id: "GF-F" })],
        runId: "r",
        flavor: "corpus",
        tier: "corpus",
        judge: {
          complete: vi.fn().mockResolvedValue(JSON.stringify(verdict("f1", 0))),
          model: "j",
          effort: "max",
        },
        auditRunner: () => fakeResult([{ finding_id: "f1" }]),
        sinks: memorySinks(),
        corpus: { catalogedCount: 120, rolesFor: () => ["release-test"] },
      });
      expect(summary.anyProjectFailed).toBe(true);
      expect(log).toContain("[eval] GF-F [engine-findings]: scored=1 unscored=0 passRate=0% mark=FAIL");
      expect(warn).toContain("[eval] NOTE: gate failure recorded; harness does not fail CI by design");
    } finally {
      logSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });
});
