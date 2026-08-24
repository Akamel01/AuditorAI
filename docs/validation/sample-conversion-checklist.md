# Sample → Fixture Conversion Checklist

Industrialized from the proven pattern (GF-6..13, eight conversions; grounding failures
encountered and fixed twice). Every step cites where it was learned. Follow in order;
do not skip Tier-0.

## 0. Eligibility gate
- Sample must be cataloged (`tests/fixtures/samples/<J>/index.md`) with licence recorded.
  **No explicit licence → stop** (WelHat precedent, GF-11 journal).
- Target cell must be mapped or IN in `policies/odd.json`. Structurally absent → never.
- Firewall check (`state/sample-corpus.json`): if the sample is flagged consumed-by-engine,
  it may still become a judged fixture — but record that it can never serve release-test.

## 1. Extract & verify quotes
- `qpdf --check` → decrypt if needed → pypdf extraction with `===== PAGE N =====` markers.
- Every quote you will cite must pass the whitespace-normalized substring check against
  the extracted text. Byte-verbatim otherwise. (Registry discipline.)

## 2. Author the baseline from the document, not from memory
- Transcribe problems/findings verbatim into `expected_findings_baseline`
  (GF-11 decision-log transcription is the model).
- Respect redactions by omission, never by invention (EIR reg. 11(2) note in GF-11).

## 3. Register pivotal sample facts as evidence FIRST
- The judge grounds each finding against registry quotes. A fact that exists only in the
  sample PDF **will fail** `evidence_grounding` until the sample itself becomes a
  quote-bearing evidence record (learned GF-12/GF-13, fixed via EV-US-033 / EV-CA-039).
- Pattern: new `EV-<JJ>-NNN` in `docs/research/<jurisdiction>-rsa-research.md`, quote =
  the pivotal sentence(s), source = sample provenance row; cite as primary
  `supports_concern`; generic normative quotes stay secondary.

## 4. Fixture mechanics
- File: `tests/fixtures/gf<N>-<jur>-<slug>-<stage>.json`; register in
  `tests/domain/corpus-fixtures.test.ts` FILES and `scripts/run-eval.ts` corpus list.
- `expected.questions_min_count`: set from the actual pack surface for that stage —
  count, don't assume (GF-13 correction).

## 5. Tier-0 determinism suite (before any judging)
- Full `npm test`. Engine output must reproduce the baseline without judge involvement.

## 6. Tier-1 judged run
- Fresh archive required when §2 trigger paths apply (pack edits, declaration bumps).
- `unscored` baselines are transport flakes — retry for a fully-scored archive before
  declaring success; unscored never fails the mark but a clean archive is the standard.

## 7. Bookkeeping (same commit)
- `state/evidence-registry.json` recompile → `vault-export`.
- `policies/odd.json` fixture_ids deepened if cell is IN; declaration log entry.
- Journal entry; stage only your lane (parallel sessions own other files).

## Worked instances
| Fixture | Sample | Lesson |
|---|---|---|
| GF-6 | M5 J10 | first real-scheme conversion |
| GF-11 | A9 Ballinluig | licence gate; redaction-by-omission |
| GF-12/13 | Hingham / NEAHD | pivotal-fact evidence records |
