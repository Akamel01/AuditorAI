# ADR-0012: Prompt versioning — repo artifact, runtime load, hash stamping, trigger-path discipline

- Status: Accepted
- Date: 2026-08-25
- Deciders: owner (live grilling, learning-architecture wave), ORCH
- Context artifacts: `src/lib/ai.ts` (inline SYSTEM_PROMPT today), `prompts/` (new),
  eval-gates §2, ADR-0008/0009

## Context

SYSTEM_PROMPT lived as an inline string — invisible to diffs-as-artifacts, unstamped in
run records, and changeable without touching any gate. Prompt text is the single most
quality-sensitive artifact in the system; it needs registry-grade discipline.

## Decision

1. **Canonical artifact:** `prompts/system-prompt.md` — front-matter carries
   `version: N`, `supersedes: N-1`; body carries the exact prompt text; a change-log
   section records why each version differs.
2. **Runtime load + hash stamp:** the adapter loads the file at startup and stamps
   `prompt_version` + `prompt_hash` into every scorecard, CandidateOutcome row, and
   AI-run log. Missing/mismatched file = adapter refuses to enable (fail-closed).
3. **Trigger-path event:** any prompt edit requires a fresh Tier-1 archive over the
   full judged corpus before the change may merge (extends eval-gates §2 trigger list
   as item 6).
4. **No inline prompt strings:** `src/lib/ai.ts` keeps structure (message assembly,
   vocabulary injection) but all natural-language instruction text lives in the
   artifact.

## Consequences

- Any quality regression is attributable to a specific prompt version within one diff.
- The judge-side rubric remains separately frozen under existing doctrine; this ADR
  governs only the engine-side candidate-generation prompt.
