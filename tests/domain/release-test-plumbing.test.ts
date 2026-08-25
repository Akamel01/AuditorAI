// Release-test tier plumbing gates (ticket 02 / ADR-0007): dormancy boundary
// at the 100-catalog floor, sample-level firewall rejections, live-fixture
// provenance integrity against the corpus catalog, and runner --mode parsing.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  assertReleaseTestSources,
  canServeReleaseTest,
  fixtureRoleSection,
  fixtureSampleIds,
  RELEASE_TEST_CORPUS_FLOOR,
} from "@/domain/split-firewall";
import { parseRunMode, RUN_MODE } from "../../scripts/run-eval";

const ROLES: Record<string, string[]> = {
  "rt-virgin": ["release-test"],
  "tainted-engine": ["engine-fewshot", "release-test"],
  "tainted-judge": ["judge-calibration", "release-test"],
  "engine-only": ["engine-fewshot"],
  "judge-only": ["judge-calibration"],
};

const lookup = (id: string): string[] | undefined => ROLES[id];

describe("release-test dormancy gate", () => {
  it("refuses below the floor with an honest dormant message", () => {
    expect(() => assertReleaseTestSources(99, [], lookup)).toThrowError(/dormant/);
    expect(() => assertReleaseTestSources(99, [], lookup)).toThrowError(/currently 99/);
  });

  it("activates at exactly the floor", () => {
    expect(RELEASE_TEST_CORPUS_FLOOR).toBe(100);
    expect(() => assertReleaseTestSources(100, [], lookup)).not.toThrow();
  });
});

describe("ADR-0007 sample-level firewall", () => {
  it("admits firewall-virgin release-test samples", () => {
    expect(canServeReleaseTest(["release-test"])).toBe(true);
  });

  it("rejects samples co-assigned to engine-fewshot", () => {
    expect(canServeReleaseTest(["engine-fewshot", "release-test"])).toBe(false);
  });

  it("rejects samples co-assigned to judge-calibration", () => {
    expect(canServeReleaseTest(["judge-calibration", "release-test"])).toBe(false);
  });

  it("enforces rejections through assertReleaseTestSources once activated", () => {
    const virgin = { fixture_id: "GF-V", provenance: { source_samples: ["rt-virgin"] } };
    const tainted = { fixture_id: "GF-B", provenance: { source_samples: ["tainted-engine"] } };
    expect(() => assertReleaseTestSources(120, [virgin], lookup)).not.toThrow();
    expect(() => assertReleaseTestSources(120, [virgin, tainted], lookup)).toThrowError(
      /GF-B.*tainted-engine.*engine-fewshot/,
    );
  });

  it("rejects fixtures citing samples absent from the catalog", () => {
    const ghost = { fixture_id: "GF-G", provenance: { source_samples: ["nope-999"] } };
    expect(() =>
      assertReleaseTestSources(120, [ghost], lookup),
    ).toThrowError(/not found in the sample catalog/);
  });
});

describe("fixture provenance convention", () => {
  it("falls back to no linked samples when source_samples is absent", () => {
    expect(fixtureSampleIds({})).toEqual([]);
    expect(fixtureSampleIds({ provenance: {} })).toEqual([]);
  });

  it("reads cataloged ids when present", () => {
    const fx = { provenance: { source_samples: ["us-008-ma-hingham-derby-st-route3-rsa"] } };
    expect(fixtureSampleIds(fx)).toEqual(["us-008-ma-hingham-derby-st-route3-rsa"]);
  });

  it("sections fixtures by role with leakage-risk precedence and unlinked fallback", () => {
    expect(fixtureRoleSection([], lookup)).toBe("unlinked");
    expect(fixtureRoleSection(["rt-virgin"], lookup)).toBe("release-test");
    expect(fixtureRoleSection(["engine-only"], lookup)).toBe("engine-fewshot");
    expect(fixtureRoleSection(["judge-only"], lookup)).toBe("judge-calibration");
    expect(fixtureRoleSection(["rt-virgin", "tainted-engine", "tainted-judge"], lookup)).toBe("release-test");
  });
});

describe("live fixture/corpus integrity", () => {
  const corpus = JSON.parse(
    readFileSync(path.join(process.cwd(), "state", "sample-corpus.json"), "utf8"),
  ) as { samples: { id: string }[] };
  const catalogIds = new Set(corpus.samples.map((s) => s.id));

  const files = readdirSync(path.join(process.cwd(), "tests/fixtures"))
    .filter((f) => /^gf\d+-.*\.json$/.test(f))
    .sort();

  it("links fixtures only to ids that exist in the sample catalog", () => {
    for (const file of files) {
      const fx = JSON.parse(
        readFileSync(path.join(process.cwd(), "tests/fixtures", file), "utf8"),
      ) as { fixture_id: string; provenance?: { source_samples?: unknown } };
      for (const id of fixtureSampleIds(fx)) {
        expect(catalogIds.has(id), `${fx.fixture_id} (${file}) cites uncataloged sample "${id}"`).toBe(true);
      }
    }
  });
});

describe("runner mode flag", () => {
  it("defaults to corpus and imports the runner without executing main", () => {
    expect(RUN_MODE).toBe("corpus");
    expect(parseRunMode([])).toBe("corpus");
  });

  it("accepts corpus and release-test explicitly", () => {
    expect(parseRunMode(["--mode", "corpus"])).toBe("corpus");
    expect(parseRunMode(["--mode", "release-test"])).toBe("release-test");
  });

  it("rejects unknown or missing mode values", () => {
    expect(() => parseRunMode(["--mode", "yolo"])).toThrowError(/--mode/);
    expect(() => parseRunMode(["--mode"])).toThrowError(/--mode/);
  });
});
