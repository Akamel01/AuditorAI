# Architecture decisions — Akamel01/AuditorAI#60 (harvest round 2)

Each entry: context, options, decision, consequences, requirements satisfied, files touched.

---

## D1 — Round-2 discovery lives in a script, not in a `DiscoveryProvider`

**Context.** The repo has a provider seam (`src/discovery/providers/provider-types.ts:19-29`) with
`seed-portals`, `brave-search`, `google-cse`, `ai-search`, `agent-reach-search`. Round 2 needs a
keyless, repeatable wide search. R1 forbids changing the runtime discovery pipeline.

**Options.**
(a) A new `DiscoveryProvider` adapter registered in `src/discovery/providers/index.ts`.
(b) A standalone script `scripts/harvest-round2-discover.ts`.
(c) A new `strategy` value inside the harvester.

**Decision.** (b).

**Consequences.** `src/**` stays untouched — the cleanest possible reading of R1 and R-6. The
provider seam keeps its meaning (runtime pipeline adapters, each gated on secrets); round 2 is a
one-shot corpus harvest, which is what `scripts/harvest-track-a.ts` already is. The cost: the
round-2 discovery is not wired into the app's discovery jobs, so a future ticket that wants that
must move the code. That is a separate, explicit ticket.

**Satisfies.** R1, R3, R5. **Touches.** `scripts/harvest-round2-discover.ts` (new).

---

## D2 — The search runs through agent-reach's Jina Reader channel, keylessly

**Context.** The ticket says to use the `agent-reach` skill. agent-reach's search branch is Exa via
`mcporter` (`/home/oc/.agents/skills/agent-reach/references/search.md`); its web branch is
`curl -s "https://r.jina.ai/URL"` (`references/web.md`, SKILL.md "零配置快速命令"). `mcporter`,
`agent-reach` and `opencli` are not installed and `EXA_API_KEY`/`OPENCODE_API_KEY` are absent, so
the Exa branch cannot run. Direct scraping of every search engine from this container is blocked
(DDG 202 challenge, Mojeek 403, Brave 429, searx browser-verification, Bing JS-wrapped). Jina
Reader over a search-engine URL works and returns parseable Canadian RSA candidates.

**Options.**
(a) Wait for the operator to provision Exa keys and use `mcporter`.
(b) Scrape a search engine directly.
(c) Use agent-reach's documented zero-config web channel (Jina Reader) over a search engine.

**Decision.** (c).

**Consequences.** The round runs keylessly and free today, and it honours the ticket's explicit
"use the agent-reach skill" by using the skill's own routing and its own zero-config command. The
report states that agent-reach's Exa branch was unavailable and why, so the reader can tell a
degraded search from a complete one. If the operator later provisions Exa, the existing
`agent-reach-search` provider (`src/discovery/providers/agent-reach-search.ts:149-241`) can be
enabled without new code — that is a later ticket.

**Satisfies.** O1, R3, R5. **Touches.** `scripts/harvest-round2-discover.ts`, and the round-2 report's
provenance section.

---

## D3 — The round-1 report stays byte-identical; the round-2 report carries before/after

**Context.** Appending to `docs/RSA-Documents/canada-intake-manifest.jsonl` changes the round-1
report's inputs (|A|, |B|, cell counts), so `tests/discovery/harvest-track-a-report.test.ts:251-252`
would fail unless the round-1 report is regenerated. The grilling offered Option A (regenerate) and
Option B (freeze the round-1 inputs).

**Options.**
(a) Regenerate `docs/RSA-Documents/track-a-harvest-report.md` so it absorbs round-2 rows.
(b) Point the round-1 generator at a frozen copy of the round-1 manifest.
(c) Filter round-2 rows out of the round-1 generator.

**Decision.** (c).

**Consequences.** The round-1 report stays the historical record of round 1 — its committed bytes
and its vitest guard stay green, with no regeneration and no extra committed file (b needs one).
The round-2 report computes "before" as the round-1 rows and "after" as all rows, and prints both
inline with the base commit sha. The rule functions are shared, so the two numbers are comparable
(R9).

**Satisfies.** R6, R9, R44, R-6. **Touches.** `scripts/harvest-track-a-report.ts`.

---

## D4 — A `candidate-list` strategy, not a `known-document-url` list per source

**Context.** The discovered URLs must reach the fetch path. `Source.strategy`
(`scripts/harvest-track-a.ts:67-71`) already has four strategies; `known-document-url` takes a
`known_document_urls[]` array per source.

**Options.**
(a) Put the discovered URLs into each source's `known_document_urls[]`.
(b) Add a `candidate-list` strategy that reads one committed candidates JSON.

**Decision.** (b).

**Consequences.** Discovery and fetching stay separable (R3), the candidates carry their query and
source attribution in one auditable file (R5, R29), and the source list stays a declaration of
*where to look* rather than a dump of *what was found*. The cost: one more strategy branch in
`candidatesFor`.

**Satisfies.** R3, R5, R29. **Touches.** `scripts/harvest-track-a.ts`, `docs/RSA-Documents/track-a-round2-sources.json`.

---

## D5 — French stage patterns go into `STAGE_RULES`

**Context.** `STAGE_RULES` (`scripts/harvest-track-a.ts:387-392`) matches English stage words only.
A French RSA falls back to `stage_hint` → `UNSTAGED` → unmapped → never coverage, i.e. it silently
vanishes.

**Options.**
(a) Add French patterns to `STAGE_RULES`.
(b) Add a separate French table and a second code path in `detectStage`.

**Decision.** (a).

**Consequences.** One classifier, one place. `detectStage` keeps its contract (text, hint) → stage,
and the multi-stage guard (`:405`) applies to French hits too. The cost: `STAGE_RULES` becomes
bilingual, so the report must say which patterns exist.

**Satisfies.** R32. **Touches.** `scripts/harvest-track-a.ts`.

---

## D6 — The byte-accounting file is JSON

**Context.** R36 requires `corpusBytesBefore`, `downloadedThisRound`, `corpusBytesAfter`,
`capBytes`, `remainingBytes`, `perDocumentCap` and `skippedForCap`.

**Options.** (a) JSON; (b) TSV.

**Decision.** (a).

**Consequences.** One named-field object with one consumer (the report generator and the test); the
arithmetic is assertable field by field. TSV's column discipline buys nothing for a single row.

**Satisfies.** R36, R37. **Touches.** `docs/RSA-Documents/track-a-round2-bytes.json` (new).

---

## D7 — The live round runs in this worktree; the box is used only to probe the model pool

**Context.** The harvester is Node/tsx. The box gateway's `run` verb executes only
`tools/eval/*.py` and `tools/research/*.py`, and the box container is the Python chat-worker
service. Network and `npm ci` are proven in this worktree.

**Options.** (a) the operator's machine; (b) the box runner; (c) this worktree, with the box used
for the pool probe only.

**Decision.** (c).

**Consequences.** No dependency on the operator and no Python re-implementation of the harvester's
classification rules — which R3 and R9 require to stay in one place. The box is still used, for
the one thing only it can do: decide whether the free-model pool answers.

**Satisfies.** A11 (superseded), O2 (superseded), D-7. **Touches.** `tools/research/pool_probe.py` (ephemeral, not committed).

---

## D8 — Free-model triage is probed, and is advisory-only if it answers

**Context.** The ticket asks for free models for triage. The pool `http://ollama-gen-lb:11434` does
not resolve from this container (DNS failure). `sme_ollama_gen_lb` is up on the box. The advertised
free models were free "until 2026-10-22" — today.

**Options.** (a) mandate model triage; (b) skip it; (c) probe it and let it pre-filter only.

**Decision.** (c).

**Consequences.** If the pool answers, the model may reject a candidate *before* its bytes are
fetched (cost control under the 5 GB cap) — it may never set a tier, stage, class, licence verdict
or a coverage count, and the report generator never calls it (R40). If it does not answer, the round
proceeds rule-only and the report says so in one sentence (R39/R41). The round never stalls.

**Satisfies.** R39, R40, R41. **Touches.** the round-2 report's provenance section.

---

## D9 — The candidate list and the candidate log are committed

**Context.** R5 wants the discovered candidates auditable; R29 wants a per-candidate outcome log.

**Options.** (a) commit both; (b) keep them ephemeral under `.autoforge/tmp/`.

**Decision.** (a).

**Consequences.** The precision and yield numbers can be re-derived from the committed tree by a
third party. The cost: two more files under `docs/RSA-Documents/`, and they must carry no secrets
and no extracted PDF text (R43).

**Satisfies.** R5, R29, A9. **Touches.** `docs/RSA-Documents/track-a-round2-candidates.json`,
`docs/RSA-Documents/track-a-round2-candidate-log.tsv` (both new).

---

## D10 — The source-type taxonomy is closed at seven types

**Context.** R18 fixes the taxonomy: `municipal-agenda-package`, `ea-class-ea-study`,
`university-repository`, `conference-proceedings`, `provincial-ministry-report`,
`open-data-portal`, `direct-known-document`.

**Options.** (a) closed set; (b) open, extended as new hosts appear.

**Decision.** (a).

**Consequences.** Every ingested document maps to exactly one source type and the yield table's
denominator is stable. A discovered host that fits no type is classified by the operator's
pre-registered rule (`direct-known-document`) rather than by inventing a type mid-round — which
would make the denominator uninterpretable (R11).

**Satisfies.** R18, R19, R20, R22. **Touches.** `docs/RSA-Documents/track-a-round2-sources.json`,
`scripts/harvest-track-a-round2-report.ts`.

---

## D11 — The grilling's "no outbound network" premise is rejected

**Context.** `.autoforge/requirements/grilling.md` concluded from one probe of `example.com`
(exit 7) that the container had no outbound network, and built R4, O2 and A11 on that premise.

**Options.** (a) accept the premise; (b) reject it on the orchestrator's own verification.

**Decision.** (b).

**Consequences.** R4 ("no new discovery-provider code") is superseded by D1; O2 and A11 are
superseded by D7. The requirements the grilling derived from the *repo mechanics* — the counting
rules, the licence gate, the split rule, the byte cap, the honesty rules (R6–R47) — are unaffected
and are carried forward in full.

**Satisfies.** O1, O2, A11, R4 (all superseded). **Touches.** `.autoforge/architecture/report.md` §2.
