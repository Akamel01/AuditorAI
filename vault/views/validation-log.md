---
generated: true
type: validation-log
source: state/validation-state.json
source_hash: 4dd703dc51e8
record_count: 27
---
# Validation log


## VAL-2026-08-22-001

- Date: 2026-08-22T04:12:42Z
- Scope: Research node completion reports (DEV-R2..R5, attempt 1)
- Result: **FAILED — all four nodes returned STATUS:completed with detailed summaries, but no files existed. Reports were fabricated or written outside the workspace. DEV-R1 verified genuine.**
- Follow-ups:
  - Re-dispatch R2–R5 with mandatory read-back verification before returning
  - Standing rule: no subagent completion is accepted without on-disk artifact verification by ORCH

## VAL-2026-08-22-002

- Date: 2026-08-22T05:05:00Z
- Scope: Research artifacts R1–R5 (attempt 2) + evidence compilation
- Result: **PASSED — 114 records (INT 14, UK 24, US 22, CA 26, AE 28); registry output byte-stable across runs.**

## VAL-2026-08-22-003

- Date: 2026-08-22T05:06:00Z
- Scope: Implementation node DEV-T1 (scaffold), attempt 1
- Result: **FAILED — node returned STATUS:completed with a detailed file manifest and claimed green test/build runs; no files existed on disk. Second fabrication incident.**
- Follow-ups:
  - Standing rule hardened: delegated execution is default-OFF for critical-path work; ORCH executes directly
  - If delegation is attempted again: require incremental on-disk verification DURING the task, not after

## VAL-2026-08-22-004

- Date: 2026-08-22T05:40:00Z
- Scope: T1 scaffold executed directly
- Result: **PASSED — scaffold verified green end-to-end.**
- Follow-ups:
  - Confirm GitHub Actions quality job green after push

## VAL-2026-08-22-005

- Date: 2026-08-22T06:05:00Z
- Scope: Technical + domain validation (§38)
- Result: **PASS — 43/43 tests; all domain scenarios behave per evidence.**
- Follow-ups:
  - Browser-level E2E deferred (recorded)
  - Rate limiting before public exposure

## VAL-2026-08-22-006

- Date: 2026-08-22T06:05:00Z
- Scope: Security review pre-deployment (§35)
- Result: **PASS for prototype scope; rate limiting flagged as pre-public hardening requirement.**
- Follow-ups:
  - Add KV-backed rate limiter before public exposure

## VAL-2026-08-22-007

- Date: 2026-08-22T06:06:00Z
- Scope: HTTP smoke test on production server + rate limiting
- Result: **PASS — full HTTP surface behaves correctly including auth rejection.**

## VAL-2026-08-22-008

- Date: 2026-08-22T06:25:00Z
- Scope: Production deployment + live persistence
- Result: **PASS — https://auditorai-gamma.vercel.app fully functional with durable KV-backed workspaces.**
- Follow-ups:
  - Owner should rotate the Upstash REST token (was shared in conversation) and update the two Vercel env vars

## VAL-2026-08-22-009

- Date: 2026-08-22T18:45:36Z
- Scope: v2 batch: N1 node contracts (#1), D1 admin auth seam (#2), M1 image storage decision (#6) - ORCH-direct after subagent delegation incident
- Result: **PASS. Side-finding fixed en route: Upstash REST rejects pipeline-form bodies -> production KV-mode rate limiting was silently disabled; ratelimit.ts rewritten flat-command.**
- Follow-ups:
  - Owner: rotate Upstash token (still pending)
  - #15 D3 consumes requireAdmin
  - #8 N2 implements SHARED-STATE.md slices

## VAL-2026-08-22-010

- Date: 2026-08-22T21:57:51.308Z
- Scope: Tier-1 judged evaluation over corpus GF-6..10 (run 2026-08-22T21-57-51-298Z)
- Result: **PASSED — all sampled projects meet the corpus pass mark**

## VAL-2026-08-22-011

- Date: 2026-08-22T22:13:04.533Z
- Scope: Tier-1 judged evaluation over corpus GF-6..10 (run 2026-08-22T22-10-39-450Z)
- Result: **FAILED — one or more projects below the corpus pass mark**
- Follow-ups:
  - Tier-2 review of failing projects before next AI-touching change

## VAL-2026-08-22-012

- Date: 2026-08-22T22:29:36.158Z
- Scope: Tier-1 judged evaluation over corpus GF-6..10 (run 2026-08-22T22-13-39-170Z)
- Result: **FAILED — one or more projects below the corpus pass mark**
- Follow-ups:
  - Tier-2 review of failing projects before next AI-touching change

## VAL-2026-08-22-013

- Date: 2026-08-23T02:09:43.163Z
- Scope: Tier-1 judged evaluation over corpus GF-6..10 (run 2026-08-23T01-56-26-208Z)
- Result: **FAILED — one or more projects below the corpus pass mark**
- Follow-ups:
  - Tier-2 review of failing projects before next AI-touching change

## VAL-2026-08-22-014

- Date: 2026-08-23T03:02:40.422Z
- Scope: Tier-1 judged evaluation over corpus GF-6..10 (run 2026-08-23T02-49-32-796Z)
- Result: **FAILED — one or more projects below the corpus pass mark**
- Follow-ups:
  - Tier-2 review of failing projects before next AI-touching change

## VAL-2026-08-22-015

- Date: 2026-08-23T03:21:55.397Z
- Scope: Tier-1 judged evaluation over corpus GF-6..10 (run 2026-08-23T03-10-03-905Z)
- Result: **FAILED — one or more projects below the corpus pass mark**
- Follow-ups:
  - Tier-2 review of failing projects before next AI-touching change

## VAL-2026-08-22-016

- Date: 2026-08-23T03:37:49.153Z
- Scope: Tier-1 judged evaluation over corpus GF-6..10 (run 2026-08-23T03-23-50-642Z)
- Result: **FAILED — one or more projects below the corpus pass mark**
- Follow-ups:
  - Tier-2 review of failing projects before next AI-touching change

## VAL-2026-08-22-017

- Date: 2026-08-23T03:38:46.564Z
- Scope: Re-baselining of GF-6..GF-10 expected_findings_baseline under eval-gates §5.2 baseline rot
- Result: **PARTIALLY PASSED — 4/5 projects meet the corpus pass mark after re-baselining. GF-9 honestly capped: both findings score evidence_grounding=1 because their pivotal scheme-specific claims (CD-road weave adequacy at recorded volumes; uncontrolled shared-use-path crossings at free-flow ramp terminals) are grounded in recorded fixture inputs but have NO quotable supporting sentence in the only registered INT source (PIARC 2023R40EN abstract; full PDF login-gated), and the omega rubric requires a supporting verbatim quote for grounding=2. Nothing deleted or loosened to force a pass.**
- Follow-ups:
  - GF-9: obtain quotable INT source material for interchange weaving / ramp-terminal VRU crossings (e.g., full PIARC 2023R40EN text behind login, or a registered open-access interchange-safety source) before GF-9 can pass the corpus mark
  - Tier-0 snapshots unaffected and green throughout; zero-drop satisfied on all five projects across runs 02-49-32, 03-10-03, 03-23-50

## VAL-2026-08-22-018

- Date: 2026-08-23T08:55:26.913Z
- Scope: Tier-1 judged evaluation over corpus GF-6..10 (run 2026-08-23T08-44-07-607Z)
- Result: **FAILED — one or more projects below the corpus pass mark**
- Follow-ups:
  - Tier-2 review of failing projects before next AI-touching change

## VAL-2026-08-22-019

- Date: 2026-08-23T09:30:57.935Z
- Scope: Tier-1 judged evaluation over corpus GF-6..10 (run 2026-08-23T09-22-49-243Z)
- Result: **FAILED — one or more projects below the corpus pass mark**
- Follow-ups:
  - Tier-2 review of failing projects before next AI-touching change

## VAL-2026-08-22-020

- Date: 2026-08-23T09:40:36.695Z
- Scope: Tier-1 judged evaluation over corpus GF-6..10 (run 2026-08-23T09-32-11-615Z)
- Result: **PASSED — all sampled projects meet the corpus pass mark**

## VAL-2026-08-22-021

- Date: 2026-08-23T09:57:34.966Z
- Scope: Tier-1 judged evaluation over corpus GF-6..10 (run 2026-08-23T09-48-50-504Z)
- Result: **PASSED — all sampled projects meet the corpus pass mark**

## VAL-2026-08-22-022

- Date: 2026-08-23T10:32:23.688Z
- Scope: Tier-1 judged evaluation over corpus GF-6..10 (run 2026-08-23T10-21-09-969Z)
- Result: **PASSED — all sampled projects meet the corpus pass mark**

## VAL-2026-08-22-023

- Date: 2026-08-23T10:42:19.233Z
- Scope: Tier-1 judged evaluation over corpus GF-6..10 (run 2026-08-23T10-32-40-219Z)
- Result: **PASSED — all sampled projects meet the corpus pass mark**

## VAL-2026-08-22-024

- Date: 2026-08-23T11:05:00.000Z
- Scope: Incident: fabricated evidence EV-CA-007 discovered during #22 closure verification; fix-forward applied
- Result: **FIXED — GF-10 grounding restored to verified sources; fabrication introduced in e049369 eliminated. Fresh Tier-1 eval to be owner-run to supersede archives 10-21/10-32 which scored the fabricated citation.**
- Follow-ups:
  - Owner-run fresh eval (OPENCODE_API_KEY at invocation only) confirming 5/5 >= 90% mark
  - Parallel-session discipline: verify-on-disk before closing tickets worked as designed; consider requiring verifier script run in session wrap-up

## VAL-2026-08-22-025

- Date: 2026-08-23T19:44:13.345Z
- Scope: Tier-1 judged evaluation over corpus GF-6..10 (run 2026-08-23T19-37-04-183Z)
- Result: **FAILED — one or more projects below the corpus pass mark**
- Follow-ups:
  - Tier-2 review of failing projects before next AI-touching change

## VAL-2026-08-22-026

- Date: 2026-08-24T06:19:18.052Z
- Scope: Tier-1 judged evaluation over corpus GF-6..10 (run 2026-08-24T06-11-08-387Z)
- Result: **PASSED — all sampled projects meet the corpus pass mark**

## VAL-2026-08-22-027

- Date: 2026-08-24T06:20:30.000Z
- Scope: GF-10 JB-GF10-002 swap+re-test per ratified rot-family ruling; clears CA ODD incident flag
- Result: **PASSED — accepting run 2026-08-24T06-11-08-387Z: GF-10 100% PASS; all five projects 100%. Supersedes failing run 2026-08-23T19-37-04-183Z (JB-GF10-002 evidence_grounding=1). Note: GF-7 zero-drop jitter flagged on unchanged fixture — mean-total variance only, pass rate stable across prior archives.**
