// Sample-corpus split plumbing (ADR-0007): consumer roles attach to samples
// with a sample-level firewall (no sample serves release-test together with
// engine-fewshot or judge-calibration), and the real-sample release-test tier
// stays dormant below the owner's 100-catalog floor.
export const RELEASE_TEST_CORPUS_FLOOR = 100;

export type SampleRole =
  | "engine-fewshot"
  | "judge-calibration"
  | "release-test"
  | "reserve"
  | "unassigned";

export type RoleSection = SampleRole | "unlinked";

/** Roles a cataloged sample carries; ids absent from the catalog yield undefined. */
export type SampleRoleLookup = (sampleId: string) => string[] | undefined;

export interface SplitFixture {
  fixture_id?: string;
  provenance?: { source_samples?: unknown };
}

export function canServeReleaseTest(roles: string[]): boolean {
  return (
    roles.includes("release-test") &&
    !roles.includes("engine-fewshot") &&
    !roles.includes("judge-calibration")
  );
}

/** Optional provenance convention: the cataloged sample ids backing a fixture. */
export function fixtureSampleIds(fixture: SplitFixture): string[] {
  const raw = fixture.provenance?.source_samples;
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string");
}

// When one fixture draws on samples of several roles, the leakiest consumer
// wins the section: test-tier exposure first, then prompt consumption.
const SECTION_PRECEDENCE: SampleRole[] = [
  "release-test",
  "engine-fewshot",
  "judge-calibration",
  "reserve",
  "unassigned",
];

export function fixtureRoleSection(
  sampleIds: string[],
  roleOf: SampleRoleLookup,
): RoleSection {
  const roles = new Set<string>(sampleIds.flatMap((id) => roleOf(id) ?? []));
  for (const section of SECTION_PRECEDENCE) {
    if (roles.has(section)) return section;
  }
  return "unlinked";
}

/**
 * Gate for any run claiming the real-sample release-test tier: refused while
 * dormant; once activated, every cited source sample must be firewall-virgin.
 */
export function assertReleaseTestSources(
  catalogedCount: number,
  fixtures: readonly SplitFixture[],
  roleOf: SampleRoleLookup,
): void {
  if (catalogedCount < RELEASE_TEST_CORPUS_FLOOR) {
    throw new Error(
      `release-test tier dormant until corpus >= ${RELEASE_TEST_CORPUS_FLOOR} cataloged (currently ${catalogedCount})`,
    );
  }
  for (const fixture of fixtures) {
    const fid = fixture.fixture_id ?? "<unnamed fixture>";
    for (const sampleId of fixtureSampleIds(fixture)) {
      const roles = roleOf(sampleId);
      if (!roles) {
        throw new Error(
          `${fid} cites release-test source "${sampleId}" not found in the sample catalog`,
        );
      }
      if (!canServeReleaseTest(roles)) {
        throw new Error(
          `${fid} cites release-test source "${sampleId}" whose roles [${roles.join(", ")}] break the ADR-0007 firewall — release-test excludes engine-fewshot and judge-calibration`,
        );
      }
    }
  }
}
