M-H13-GATES: wire lint gate into pre-commit and CI

Scope
- .githooks/pre-commit
- .github/workflows/ci.yml

What I changed
- Added a lint gate to pre-commit that runs the pinned lint gate script:
  npx tsx scripts/wayfinder-tickets.ts --lint
- Added a corresponding CI gate step in the quality workflow to run the same lint gate after the existing npm run lint step.

Rationale
- The gate ensures any invalid lint tickets discovered by Wayfinder are rejected early in both local commits and CI.
- The lint gate return code must be 0 for a clean tree; non-zero should fail the gate and block the commit or CI run.

Static verification notes
- pre-commit script is already guarded with set -e; the new gate uses the same pattern as the existing lint/typecheck blocks:
  echo "[pre-commit] lint gate..."
  npx tsx scripts/wayfinder-tickets.ts --lint
  if [ $? -ne 0 ]; then
    echo "[pre-commit] FAIL lint gate — invalid tickets found"
    exit 1
  fi
- The CI gate mirrors the pre-commit gate via a new step after npm run lint:
  - name: gate lint via wayfinder (lint gate)
    run: npx tsx scripts/wayfinder-tickets.ts --lint

How to verify locally
- Run pre-commit (or attempt a commit) and confirm the gate runs after lint:
  - Ensure you have a clean tree (no staged changes that would trip the vault determinism or YAML gates).
  - Run: git commit -m "test: gate lint" --no-verify
- Manually run the lint gate to verify the exit code handling:
  - npx tsx scripts/wayfinder-tickets.ts --lint
  - The command should exit with 0 on a clean tree; if it prints invalid tickets, it should exit non-zero and the pre-commit hook will fail.

Notes
- This change is isolated to the two gate files as requested.
- No test tickets were added or mutated.
- The new gate follows the same exit semantics as the rest of the gates (fail fast on non-zero).

Artifacts
- .githooks/pre-commit
- .github/workflows/ci.yml
- .autoforge/execution/M-H13-GATES.md (this document)
