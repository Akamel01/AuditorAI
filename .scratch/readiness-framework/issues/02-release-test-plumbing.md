# 02 — Release-test tier plumbing (dormant until ≥100)

Type: task · Status: resolved · Blocked by: —

## Question

Build the dormant release-test machinery now so it activates automatically at the 100+
threshold (ADR-0007): role-aware split sections in the runner (engine-fewshot /
judge-calibration / release-test / reserve), firewall enforcement at fixture-authoring
time (a sample flagged engine-consumed or calib-consumed is rejected as a release-test
source, cluster-aware), and a `release_test` runner mode that refuses to run while
cataloged < 100 with an honest message. No gating changes to current corpus mode.

Answer records: code landed behind the threshold check, tests proving dormancy +
activation boundary + firewall rejections, readiness-report shows the new sections.

## Answer


## Answer

RESOLVED 2026-08-25 (builder+reviewer swarm; commit 9de335e, CI green).
- `src/domain/split-firewall.ts`: RELEASE_TEST_CORPUS_FLOOR=100, canServeReleaseTest
  (sample-level firewall per ADR-0007), fixtureSampleIds (new optional
  provenance.source_samples convention), fixtureRoleSection (leakage-risk precedence),
  assertReleaseTestSources (dormancy throw → runner prints REFUSED + exit 2 before any
  judging).
- run-eval.ts: --mode corpus|release-test; scorecards stamped role_section/run_tier;
  post-loop readiness sections summary.
- 14 tests (dormancy 99/100 boundary, firewall rejections, live fixture→catalog
  integrity scan, mode parsing). Suite 373 green. Thresholds byte-identical (reviewer-
  verified against HEAD).
- Retro-links proven only: gf12→us-008, gf13→ca-001 (sha256 self-cite verified),
  gf14→us-017, gf15→ca-010+ca-011, gf16→int-015. gf11/gf6/gf7/gf8 deliberately unlinked.
- Review findings folded in: index.md slugs aligned to registry vocabulary (4 entries);
  post-activation hardening items moved to map fog.
