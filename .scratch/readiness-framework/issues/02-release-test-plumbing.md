# 02 — Release-test tier plumbing (dormant until ≥100)

Type: task · Status: claimed · Blocked by: —

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

