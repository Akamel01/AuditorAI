# H12 Validation Report (M1 e2e + M2 gate)

- Scope: repo root at /Users/akamel/Documents/AuditorAI
- Verdict: GO (joint acceptance gates satisfied in this run)

Criterion-by-criterion verdicts with collected evidence (quoted outputs)

1) Lint run must exit 0
- Condition: npm run lint
- Verdict: PASS
- Evidence: "" (no stdout); Exit code: 0

2) Typecheck run must exit 0
- Condition: npm run typecheck
- Verdict: PASS
- Evidence: "" (no stdout); Exit code: 0

3) Evidence head anchor check must pass and report fresh anchor to HEAD
- Condition: node scripts/check-evidence-head.mjs --strict --anchor --check --quiet
- Verdict: PASS
- Evidence: "Evidence HEAD fresh and anchored to current HEAD." (anchor path: HEAD)

4) Evidence bundle twin check must pass (cmp -s of two JSONs)
- Condition: cmp -s .autoforge/validation/ops-loop-evidence.json stages/07_validate/output/ops-loop-evidence.json
- Verdict: PASS
- Evidence: "EXIT:0"

5) YAML contract check for ci.yml and discovery-harvest.yml
- Condition: node -e 'yaml.parse(...)' for both YAMLs
- Verdict: PASS
- Evidence: "OK" (parsed ci.yml and discovery-harvest.yml)

6) Harvest verification gate (mock) passes three traces
- Condition: node scripts/harvest-verify.mjs --mock 3-pass
- Verdict: PASS
- Evidence: "harvest-verify --mock: three MemoryStore demos (no server, no credentials)" (summary line)

7) Vault determinism gate check passes
- Condition: node scripts/vault-sync.mjs --check
- Verdict: PASS
- Evidence: "[vault-sync] committed vault state matches HEAD compilation"

8) CI/Domain tests collection and run parity
- Condition: npx playwright test tests/e2e/harvest-buttons.spec.ts --list AND npx vitest run tests/domain/harvest-stream.test.ts tests/domain/ai-harvest.test.ts
- Verdict: PASS
- Evidence:
  - Playwright list:
    "Listing tests:\n  harvest-buttons.spec.ts:30:5 › @harvest gap via UI — Run this gap (Live) posts cellKey and polls 1.5s\n  harvest-buttons.spec.ts:71:5 › @harvest live harvest via UI — Run live harvest posts gap-aware and polls 1.5s\n  harvest-buttons.spec.ts:101:5 › @harvest ai harvest stream via UI — Start posts harvest-stream and polls 2s\nTotal: 3 tests in 1 file"
  - Vitest run:
    "Test Files 2 passed (2)\nTests 11 passed (11)"

Notes on outputs used as evidence
- The eight criteria above map to the M1 e2e and M2 gate checks described in plan-H12.md. All eight checks returned PASS in this execution run.
- The Playwright listing shows 3 tests collected in harvest-buttons.spec.ts, and Vitest ran 11 tests across two domain test files, all passing.

Artifact
- Validation report path: /Users/akamel/Documents/AuditorAI/.autoforge/validation/H12-report.md

End of report
