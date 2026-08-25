// ADR-0008 §3 / ADR-0011 gates: deterministic few-shot cascade (native exact →
// canonical → jurisdiction → global generic), k cap, absolute release-test/
// reserve exclusion, programme-cluster dedupe, store compile byte-determinism,
// firewall rejection at compile, and the live wiring's store loader.
import { afterEach, describe, expect, it, vi } from "vitest";
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  loadFewshotStore,
  selectFewshots,
  type FewshotRecord,
  type FewshotStore,
} from "@/lib/fewshot";

const QUERY = {
  jurisdiction: "US" as const,
  native_stage_id: "us-fhwa:preliminary-design",
  canonical_stage: "PRELIMINARY_DESIGN" as const,
};

function rec(over: Partial<FewshotRecord> & { exemplar_id: string }): FewshotRecord {
  return {
    sample_ids: ["us-008-ma-hingham-derby-st-route3-rsa"],
    jurisdiction: "US",
    native_stage_id: QUERY.native_stage_id,
    canonical_stage: QUERY.canonical_stage,
    inherited_role: "engine-fewshot",
    provenance_outcome_id: null,
    approved_by: "owner",
    approved_at: "2026-08-25",
    candidate_snapshot: {} as FewshotRecord["candidate_snapshot"],
    ...over,
  };
}

function store(records: FewshotRecord[], storeVersion = 1): FewshotStore {
  return { schema_version: "1.0.0", store_version: storeVersion, records };
}

describe("selectFewshots cascade", () => {
  it("orders native exact → canonical → jurisdiction → global generic", () => {
    const s = store([
      rec({ exemplar_id: "FS-D-GLOBAL", native_stage_id: "uk:S1", canonical_stage: null }),
      rec({ exemplar_id: "FS-C-JUR", native_stage_id: "uk:S1" }),
      rec({ exemplar_id: "FS-B-CANON", native_stage_id: "uk:S1", canonical_stage: "DETAILED_DESIGN" }),
      rec({ exemplar_id: "FS-A-NATIVE" }),
    ]);
    // The global fill tier walks every eligible record by id, so the
    // canonical-tier record (not yet chosen) precedes the global-only one.
    expect(selectFewshots(QUERY, s)).toEqual(["FS-A-NATIVE", "FS-C-JUR", "FS-B-CANON"]);
    expect(selectFewshots(QUERY, s, 4)).toEqual([
      "FS-A-NATIVE",
      "FS-C-JUR",
      "FS-B-CANON",
      "FS-D-GLOBAL",
    ]);
  });

  it("falls through tiers when higher ones match nothing", () => {
    const s = store([
      rec({ exemplar_id: "FS-JUR", native_stage_id: "ca:S2", canonical_stage: null }),
      rec({ exemplar_id: "FS-GLOB", jurisdiction: "UK", native_stage_id: "uk:S9", canonical_stage: null }),
    ]);
    expect(selectFewshots(QUERY, s)).toEqual(["FS-JUR", "FS-GLOB"]);
  });

  it("caps at k=3 by default and respects an explicit k", () => {
    const s = store(
      ["E", "D", "C", "B", "A"].map((n) => rec({ exemplar_id: `FS-${n}` })),
    );
    expect(selectFewshots(QUERY, s)).toEqual(["FS-A", "FS-B", "FS-C"]);
    expect(selectFewshots(QUERY, s, 2)).toEqual(["FS-A", "FS-B"]);
    expect(selectFewshots(QUERY, s, 10)).toHaveLength(5);
  });

  it("never returns release-test or reserve exemplars, even as the only matches", () => {
    const excluded = store([
      rec({ exemplar_id: "FS-RT", inherited_role: "release-test" }),
      rec({ exemplar_id: "FS-RSV", inherited_role: "reserve" }),
    ]);
    expect(selectFewshots(QUERY, excluded)).toEqual([]);

    const mixed = store([
      rec({ exemplar_id: "FS-RT", inherited_role: "release-test" }),
      rec({ exemplar_id: "FS-OK" }),
    ]);
    expect(selectFewshots(QUERY, mixed)).toEqual(["FS-OK"]);
  });

  it("dedupes same-programme clusters so one scheme cannot dominate the prompt", () => {
    const s = store([
      rec({ exemplar_id: "FS-P1-A", programme: "a9-corridor" }),
      rec({ exemplar_id: "FS-P1-B", programme: "a9-corridor" }),
      rec({ exemplar_id: "FS-SOLO", programme: null }),
    ]);
    expect(selectFewshots(QUERY, s)).toEqual(["FS-P1-A", "FS-SOLO"]);
  });

  it("is deterministic across repeated calls and record orderings", () => {
    const a = store([rec({ exemplar_id: "FS-X" }), rec({ exemplar_id: "FS-Y" })]);
    const b = store([rec({ exemplar_id: "FS-Y" }), rec({ exemplar_id: "FS-X" })]);
    expect(selectFewshots(QUERY, a)).toEqual(selectFewshots(QUERY, b));
    expect(selectFewshots(QUERY, a)).toEqual(selectFewshots(QUERY, a));
  });
});

describe("compiled store + runtime loader", () => {
  it("loads the committed store and selects the seeded us-008→gf12 exemplar for its cell", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const loaded = loadFewshotStore();
    warn.mockRestore();
    expect(loaded).not.toBeNull();
    expect(loaded?.store_version).toBeGreaterThan(0);
    expect(
      selectFewshots(
        { jurisdiction: "US", native_stage_id: "us-fhwa:preliminary-design", canonical_stage: "PRELIMINARY_DESIGN" },
        loaded!,
      ),
    ).toContain("FS-US-008-GF12");
  });
});

describe("compile-fewshot.mjs (ADR-0011)", () => {
  const OUT = path.join(process.cwd(), "state", "few-shot-store.json");
  const COMPILE = path.join(process.cwd(), "scripts", "compile-fewshot.mjs");

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is byte-deterministic across runs and matches the committed store", () => {
    const committed = readFileSync(OUT);
    execSync(`node ${COMPILE}`, { cwd: process.cwd(), stdio: "pipe" });
    const first = readFileSync(OUT);
    execSync(`node ${COMPILE}`, { cwd: process.cwd(), stdio: "pipe" });
    const second = readFileSync(OUT);
    expect(second.equals(first)).toBe(true);
    expect(first.equals(committed)).toBe(true); // no drift vs the committed tree
  });

  it("rejects a source sample holding the release-test role (firewall inheritance)", () => {
    const root = mkdtempSync(path.join(tmpdir(), "fewshot-compile-"));
    try {
      mkdirSync(path.join(root, "state"), { recursive: true });
      writeFileSync(
        path.join(root, "state", "sample-corpus.json"),
        JSON.stringify({
          samples: [
            { id: "rt-001-secret-eval", roles: ["release-test"] },
            { id: "jc-001-outputs", roles: ["judge-calibration"] },
          ],
        }),
      );
      mkdirSync(path.join(root, "vault", "fewshot"), { recursive: true });
      writeFileSync(
        path.join(root, "vault", "fewshot", "README.md"),
        "---\nstore_version: 1\n---\n\n# Few-shot sources\n",
      );
      writeFileSync(
        path.join(root, "vault", "fewshot", "FS-BAD.md"),
        [
          "---",
          "exemplar_id: FS-BAD",
          "sample_ids:",
          "  - rt-001-secret-eval",
          "jurisdiction: US",
          "native_stage_id: us-fhwa:preliminary-design",
          "canonical_stage: PRELIMINARY_DESIGN",
          "provenance_outcome_id: null-seed",
          "approved_by: owner",
          "approved_at: 2026-08-25",
          "---",
          "",
          "```json",
          JSON.stringify({
            kind: "safety_concern",
            category: "c",
            statement: { text: "t" },
            evidence: [{ evidence_id: "EV-US-001" }],
            assumptions: [],
            rationale: "r",
            recommendation: null,
            producer: "safety-reasoning-agent",
          }),
          "```",
          "",
        ].join("\n"),
      );

      let failed = false;
      try {
        execSync(`node ${COMPILE}`, { cwd: root, stdio: "pipe" });
      } catch (e) {
        failed = true;
        const stderr = String((e as { stderr?: Buffer }).stderr ?? "");
        expect(stderr).toContain("FIREWALL");
        expect(stderr).toContain("rt-001-secret-eval");
        expect(stderr).toContain("release-test");
      }
      expect(failed).toBe(true);

      // And a non-engine-fewshot source is equally impossible (ADR-0008 §3).
      writeFileSync(
        path.join(root, "vault", "fewshot", "FS-BAD.md"),
        readFileSync(path.join(root, "vault", "fewshot", "FS-BAD.md"), "utf8").replace(
          "rt-001-secret-eval",
          "jc-001-outputs",
        ),
      );
      failed = false;
      try {
        execSync(`node ${COMPILE}`, { cwd: root, stdio: "pipe" });
      } catch (e) {
        failed = true;
        const stderr = String((e as { stderr?: Buffer }).stderr ?? "");
        expect(stderr).toContain("engine-fewshot");
      }
      expect(failed).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
