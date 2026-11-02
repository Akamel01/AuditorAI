---
title: Free-model candidates for the auditor under test and the judge pair
date: 2026-11-02
status: complete
ticket: Akamel01/AuditorAI#96
map: Akamel01/AuditorAI#93
scope: research only — no application code changed
---

# Free-model candidates for the auditor under test and the judge pair

Answers ticket [#96](https://github.com/Akamel01/AuditorAI/issues/96), part of map
[#93](https://github.com/Akamel01/AuditorAI/issues/93). The calibration doctrine this
serves is in [#92](https://github.com/Akamel01/AuditorAI/issues/92) §5 (deterministic
match, then two independent free-model judges must agree) and §12 (configured product
model plus a one-off comparison of 2–3 free candidates).

**This file is not an evidence-registry source.** `scripts/compile-evidence.mjs` reads
only the five named jurisdiction files (`docs/research/README.md`), so adding this file
does not change `state/evidence-registry.json`.

## TL;DR

1. **The current product default is not a candidate — it is dead.**
   `src/lib/ai.ts:76` still pins `x-preview-f-free`; the gateway returns
   `400 Model is unavailable` for it, and it is absent from both catalogs and the CLI
   registry [S1][S2][S3][S7].
2. **The current judge default is also dead.** `scripts/run-eval.ts:56` still pins
   `muse-spark-1.3-contributor-free`; the gateway returns `400 Model is unavailable`
   on both Zen and Go, and it is absent from both catalogs [S1][S2][S7].
3. **Free inventory today:** 8 free models on Zen and 2 on Go. Only four have image
   input; only one has a 1M context window *and* image input (Nemotron 3.5 Super VL).
4. **Recommended auditors:** `opencode/deepseek-v4.1-flash-free`,
   `opencode/glm-5.3-flash-free`, and `opencode/nemotron-3.5-super-vl-free`
   (the last with a confidentiality caveat). Reasons in §5.
5. **Recommended judge pair:** `opencode-go/beam-free` (family `beam`) +
   `opencode/flint-40b-free` (family `flint`) for the one-off three-way comparison.
   Both are family-disjoint from all three auditor candidates. If Flint's data-use
   term is unacceptable, use Beam + whichever of GLM-5.3-Flash Free / DeepSeek V4.1
   Flash Free is not the auditor under test, recorded per scorecard (§6.3).
6. **The binding operational limit is not RPM.** It is one daily free pool on Zen:
   on 2026-11-02 all eight catalog-listed free models returned the same
   `FreeUsageLimitError` with a reset instant of `2026-11-03T00:00:0xZ`. The pool is
   therefore unusable for a judging batch that also competes with the agent fleet
   [S5][S7].
7. **Every free model is "limited time"** (docs). A judge or auditor pin needs a
   recorded fallback, and any swap on the runtime or eval path is a Tier-1 trigger
   (`docs/validation/eval-gates.md` §2).

## 1. What was measured, and against which primary source

| Ref | Source | What it establishes | Retrieved |
|---|---|---|---|
| S1 | `GET https://opencode.ai/zen/v1/models` — Console/Zen gateway catalog | Current model ids, families, context/output, input modalities, reasoning efforts, zero price | 2026-11-02 07:53Z |
| S2 | `GET https://opencode.ai/inference/go/v1/models` — Go gateway catalog | Same for Go models | 2026-11-02 07:53Z |
| S3 | `opencode models --verbose` (opencode 1.18.20) | CLI registry: `status`, `limit`, `capabilities`, `variants` | 2026-11-02 07:52Z |
| S4 | <https://opencode.ai/docs/zen/> and <https://opencode.ai/docs/go/> | Free/paid lists, endpoints, free-period and privacy terms, Go monthly limits | 2026-11-02 |
| S5 | `python3 ~/.claude/skills/opencode-orchestrate/scripts/route.py status`; `~/.opencode-runs/_models/` (`attention.log`, `watch.log`, `preempt.log`, marks) | Live routing picks and observed limit marks | 2026-11-02 |
| S6 | `~/.local/share/opencode/log/opencode.log` | 12-day observed call/error record (2026-10-21T22:00Z → 2026-11-02T07:57Z) | 2026-11-02 |
| S7 | Live probe, 2026-11-02 07:54–07:56Z: `POST {base}/chat/completions`, `max_tokens: 8`, prompt `Reply with the single word OK.` | Callability and rate/quota headers for every candidate | 2026-11-02 |
| S8 | Repository files, cited by `path:line` | Product default, judge default, eval doctrine | HEAD `0a2f5b3` |
| S9 | `~/.claude/skills/opencode-orchestrate/models.json` | Dispatcher routing config (not a product catalog) | 2026-11-02 |

Probe commands (keys read from the local auth store and never printed):

```bash
curl -sS https://opencode.ai/zen/v1/models -H "Authorization: Bearer $OPENCODE_API_KEY"
curl -sS https://opencode.ai/inference/go/v1/models -H "Authorization: Bearer $OPENCODE_GO_API_KEY"
curl -sS -D - https://opencode.ai/zen/v1/chat/completions \
  -H "Authorization: Bearer $OPENCODE_API_KEY" -H "Content-Type: application/json" \
  -d '{"model":"glm-5.3-flash-free","messages":[{"role":"user","content":"Reply with the single word OK."}],"max_tokens":8}'
```

Limits of this method, stated up front:

- No numeric RPM/RPD is published for Zen free models (S4). The only numbers below are
  observed, never inferred.
- The Zen probe ran after the account's free pool was already exhausted, so it proves
  callability and the existence of the pool, not per-model success.
- The probe used the same key as the agent fleet, so the exhaustion time reflects the
  fleet's consumption too; a separate production key's headroom is **unmeasured**.
- Image support is reported from the gateway catalog and CLI modalities (primary
  metadata), not from an image round-trip. An image smoke test is still owed before
  the auditor default is switched (see §8).

## 2. All free models reachable today

"Free" means zero input and zero output price in the gateway catalog [S1][S2], matching
the CLI registry [S3]. "Variants" are the reasoning efforts the gateway advertises and
the CLI exposes.

### 2.1 Zen (`opencode/*`)

| Model id | Family | Context / max out | Image input | Reasoning variants | Free-period data terms [S4] | Availability evidence |
|---|---|---|---|---|---|---|
| `opencode/glm-5.3-flash-free` | `glm-flash` | 200,000 / 32,000 | Yes (JPEG, PNG; video too) | `low`, `high`, `max` | Zero retention; not used for training | Catalog + CLI today; 2 calls on 2026-11-01, 0 errors [S6]; quota-blocked 2026-11-02 [S7] |
| `opencode/deepseek-v4.1-flash-free` | `deepseek-flash` | 200,000 / 32,000 | Yes (JPEG, PNG, GIF, WebP) | `low`, `high`, `max` | Zero retention; not used for training | Catalog + CLI today; 624 calls over 5 days, 31 errors (rate-limit + daily quota) [S6]; quota-blocked 2026-11-02 [S7] |
| `opencode/nemotron-3.5-super-vl-free` | `nemotron` | 1,048,576 / 131,072 | Yes (JPEG, PNG) | `none`, `minimal`, `low`, `medium`, `high`, `xhigh` | NVIDIA trial: no personal/confidential data; logged to improve NVIDIA products | Catalog + CLI today; 2 calls on 2026-11-01, 0 errors [S6]; quota-blocked 2026-11-02 [S7] |
| `opencode/mimo-v2.6-flash-free` | `mimo` | 200,000 / 32,000 | Yes (+ audio/video) | Reasoning on; no effort variants | Data may be used to improve the model during the free period | Catalog + CLI today; 2 calls on 2026-11-01, 0 errors [S6]; quota-blocked 2026-11-02 [S7] |
| `opencode/beam-free` | `beam` | 1,048,576 / 131,072 | No (text) | `low`, `medium`, `high`, `xhigh`, `max` | Not used for training; 30-day retention | Catalog + CLI today; no observed calls in this lane [S6]; quota-blocked 2026-11-02 [S7] |
| `opencode/flint-40b-free` | `flint` | 262,144 / 65,536 | No (text) | `low`, `medium`, `high`, `xhigh`, `max` | Data may be used to improve the model; 30-day retention | Catalog + CLI today; released 2026-10-21; no observed calls [S6]; quota-blocked 2026-11-02 [S7] |
| `opencode/nemotron-3.5-lightning-free` | `nemotron` | 262,144 / 262,144 | No (text) | Reasoning on; no effort variants | NVIDIA trial: no personal/confidential data; logged | Catalog + CLI today; 10 calls as title model, 0 errors [S6]; quota-blocked 2026-11-02 [S7] |
| `opencode/big-pickle` | `big-pickle` | 200,000 / 32,000 | No (text) | Reasoning on; no effort variants | Data may be used to improve the model during the free period | Catalog + CLI today; 7 calls, 3 rate-limit errors [S6]; quota-blocked 2026-11-02 [S7] |

### 2.2 Go (`opencode-go/*`)

| Model id | Family | Context / max out | Image input | Reasoning variants | Data terms [S4] | Availability evidence |
|---|---|---|---|---|---|---|
| `opencode-go/beam-free` | `beam` | 1,048,576 / 131,072 | No (text) | `low`, `medium`, `high`, `xhigh`, `max` | Not used for training; 30-day retention | Catalog + CLI today; **200 OK on the probe** [S7]; 8,986 stream log lines (8,814 starts), 172 errors, all rate-limit bursts on 2026-10-21/22/25 plus 5 isolated "other" [S6]; "Unlimited" on the Go plan [S4] |
| `opencode-go/iceman-contributor-free` | — | 262,144 / 131,072 | No (text) | Reasoning on; no effort variants | Trains on request data | Catalog + CLI today; probe `400` — workspace privacy blocks training endpoints [S7] |

Notes:

- `models.json` [S9] still lists five ids that are **not** offered any more:
  `opencode/muse-spark-1.3-contributor-free`, `opencode/space-bunny-free`,
  `opencode-go/longcat-2.5-preview-free`, `opencode/nemotron-3-ultra-free`, and
  `opencode-go/minimax-m3.1-flash-free` (absence confirmed in [S1][S2][S3]). It also
  misses `flint-40b-free` and `iceman-contributor-free`. Treat it as routing config,
  not a product catalog.
- The Zen `beam-free` and Go `beam-free` are the same model (`family=beam`, same
  release date and limits) served by two providers [S1][S2]. They are **not**
  independent judges of each other.

## 3. Models that are gone (do not recommend)

| Id | Evidence | Consequence |
|---|---|---|
| `x-preview-f-free` | `400 Model is unavailable` [S7]; absent from [S1][S2][S3]; still pinned at `src/lib/ai.ts:76` | The product default is dead. A swap is a Tier-1 trigger (`docs/validation/eval-gates.md` §2 item 1). |
| `muse-spark-1.3-contributor-free` | `400 Model is unavailable` on Zen **and** Go [S7]; absent from [S1][S2][S3]; still pinned at `scripts/run-eval.ts:56` | The judge default is dead. Also, the `muse-spark-*` prefix routes to `/responses` (`src/lib/eval-run.ts:120-125`), so a non-Muse successor uses `/chat/completions`. |
| `minimax-m3.1-flash-free` | `400 Model is unavailable` [S7]; 50 `unavailable` stream errors on 2026-10-22 [S6]; retired mark `until 2026-10-29T09:33Z` [S5] | Dead; remove from `models.json` chains [S9]. |
| `nemotron-3-ultra-free` | Docs still list it [S4]; absent from both catalogs [S1][S2]; `400 Model is unavailable` [S7] | Docs lag reality; do not select. |
| `jev-1.13-free` | Docs list it [S4]; absent from the chat catalogs [S1][S2]; not a chat model (System One endpoint) [S4] | Not usable on the auditor/judge chat path. |

## 4. Observed rate, quota, and availability (the last two weeks)

### 4.1 Zen free pool

- **Shape:** one account-level daily free pool, not per-model. On 2026-11-02, all eight
  catalog-listed free models returned `FreeUsageLimitError` with `Retry-After ≈ 57,85x`
  seconds; the computed reset instant for every one of them was
  `2026-11-03T00:00:0xZ`, i.e. the same wall-clock instant, differing only by the
  seconds elapsed between probes [S7]. The API does not document the pool's scope, so
  "account-level" is an inference from that identical reset, labelled as such.
- **No published numbers:** the Zen docs publish no RPM/RPD for free models; they only
  say each is free "for a limited time" [S4]. The ticket's "as observed" is therefore
  the only honest form.
- **Earlier daily exhaustion (through OpenCode):** `opencode/deepseek-v4.1-flash-free`
  hit `Free usage limit reached` on 2026-10-22 at 04:57, 05:58, 07:03 and 08:53Z; the
  watcher marked it `quota` and rechecked hourly [S5][S6]. That confirms the limit is
  real on the OpenCode path too, not just on direct HTTP.
- **Transient throttling on top of the pool:** `opencode/deepseek-v4.1-flash-free`
  recorded 10 `Rate limit exceeded` errors on 2026-10-21 and 7 on 2026-10-22, separate
  from the 14 quota errors [S6].

### 4.2 Go free models

- **Beam Free:** the Go plan lists it as `Unlimited` [S4], but that is a billing term,
  not a throughput guarantee. The 12-day record shows 8,814 starts and 172 errors,
  almost all `Rate limit exceeded`, concentrated on 2026-10-21/22/25; the last of those
  bursts was 61 non-retry `AI_APICallError` rate-limit lines in one day (the same day
  also had 54 `AI_RetryError` lines, for 115 stream errors total) [S6]. It carried the fleet on 2026-10-23, 27, 28,
  Nov 1 and Nov 2 without recorded errors; 2026-10-29 has 3 client-side
  `prompt_rendering_failed` errors, not provider availability [S6]. It answered `200`
  on the probe [S7].
- **Iceman Contributor Free:** listed `Unlimited` [S4] but unusable in this workspace
  until the operator allows "paid endpoints that train on request data" in privacy
  settings; the probe returns `400` with that instruction [S7].

### 4.3 Per-model observed table

Counts are `message=stream` lines in [S6] split into starts (total minus
`message="stream error"` lines) and errors. A start with no error line is the only
success signal the log exposes, so treat the counts as call volume, not pass rate.

| Model | Dates with calls | Starts | Errors | Error kinds |
|---|---:|---:|---:|---|
| `opencode-go/beam-free` | 10 | 8,814 | 172 | rate-limit bursts; 5 other |
| `opencode/deepseek-v4.1-flash-free` | 5 | 593 | 31 | rate-limit (17), daily quota (14) |
| `opencode-go/minimax-m3.1-flash-free` | 2 | 7,151 | 51 | unavailable (50) |
| `opencode/nemotron-3.5-lightning-free` | 3 | 10 | 0 | — |
| `opencode/big-pickle` | 2 | 4 | 3 | rate-limit |
| `opencode/glm-5.3-flash-free` | 1 | 2 | 0 | — |
| `opencode/mimo-v2.6-flash-free` | 1 | 2 | 0 | — |
| `opencode/nemotron-3.5-super-vl-free` | 1 | 2 | 0 | — |
| `opencode/beam-free`, `opencode/flint-40b-free` | 0 | 0 | 0 | not observed in this lane |

The `~/.opencode-runs/_models/` marks are a snapshot, not a two-week series: today
`route.py status` reports `out: none`, with planner/reviewer on `opencode-go/deepseek-v4.1-flash`
(paid Go), griller/discovery/worker on `opencode-go/beam-free`, and chores on
`opencode/nemotron-3.5-lightning-free` [S5]. The surviving marks are an expired
`gpt-5.6-luna` quota mark, an expired `big-pickle` probe mark, and the expired
`minimax-m3.1-flash-free` retirement mark [S5]. The rotation is why [S6] is used for
the two-week view.

### 4.4 What "free" does not buy

- **No independence between the two Beam endpoints.** Zen and Go serve the same model.
- **No confidentiality for most free models.** Only three free families are
  no-training: `deepseek-flash` and `glm-flash` (zero retention) and `beam`
  (30-day retention) [S4]. MiMo,
  Flint, Big Pickle and the NVIDIA Nemotrons have free-period data-use terms;
  Iceman trains outright [S4].
- **No long-term pin.** Every free model is a limited-time offer [S4]. The replacement
  of `x-preview-f-free` and the `muse-spark-1.3-contributor-free` retirement are the
  worked examples [S7].

## 5. Recommended auditor candidates

The auditor under test must support images (the product's vision path is
`MAX_IMAGES_PER_CALL = 4`, `src/lib/ai.ts:25`; the adapter budgets ≤3 calls per run,
`docs/adr/0008-ai-candidate-generation.md:36-37`), should expose reasoning effort, and
should be free. Three candidates:

1. **`opencode/deepseek-v4.1-flash-free` — continuity candidate.**
   - 200,000 / 32,000; image input; `low|high|max` [S1][S3].
   - Zero-retention and no training [S4].
   - Reason: it is the free sibling of `opencode-go/deepseek-v4.1-flash`, the paid model
     this orchestrator session and the fleet already use (`route.py status` [S5]), with
     the same family and request shape. A free→paid fallback stays inside one family,
     which keeps behaviour stable when the daily pool is exhausted. It also has the
     richest observed record of the Zen free models (624 calls, 5 days) [S6].
   - Risk: 31 observed errors, including daily-quota exhaustion [S6].

2. **`opencode/glm-5.3-flash-free` — independent-family candidate.**
   - 200,000 / 32,000; image input; `low|high|max` [S1][S3].
   - Zero-retention and no training [S4].
   - Reason: together with DeepSeek it is one of only two vision-capable free models
     with clean data terms *and* explicit effort tiers; it is a different family from
     the paid DeepSeek the fleet runs, so the one-off comparison tests a genuinely
     different model rather than a sibling.
   - Risk: only 2 observed calls [S6]; the daily free pool blocks it today [S7].

3. **`opencode/nemotron-3.5-super-vl-free` — long-context candidate.**
   - 1,048,576 / 131,072; image input; six effort levels [S1][S3].
   - Reason: the only free, vision-capable model that can hold a whole report plus
     drawings without truncation; it is the right A/B against the 200k models when the
     input is long.
   - **Caveat:** NVIDIA trial terms say "do not submit personal or confidential data"
     and log requests to improve NVIDIA products [S4]. Use it only on the public
     harvested corpus, never on client scheme data.

Why the others are not auditor candidates:

- `mimo-v2.6-flash-free` — vision and 200k, but no effort variants and free-period
  data used to improve the model [S1][S4]. Comparison-only.
- `beam-free` (Zen or Go) — 1M but text-only [S1][S2]; it would silently drop the
  drawing path.
- `flint-40b-free`, `nemotron-3.5-lightning-free`, `big-pickle` — text-only [S1][S3].
- `iceman-contributor-free` — trains on request data and is blocked by the workspace
  privacy setting [S4][S7].

## 6. Recommended judge pair

Hard constraint from #96: no judge may share a model family with the auditor under
test. Operational constraint from #92 §5: two *independent* models must agree, and the
operator spot-checks 10 %. Matching is deterministic first, so the judge decides
semantic matches on finding text and location — text-only judges are sufficient unless
#98 decides the judge must see the drawing.

### 6.1 Primary pair (one-off three-way comparison)

| Role | Model | Family | Why |
|---|---|---|---|
| Judge A | `opencode-go/beam-free` | `beam` | 1M / 131k, text, `low…max`, no training (30-day retention) [S1][S2][S4]. It is the only free judge that answered the probe today (`200`) [S7] and it has the largest observed record (8,814 starts) [S6]. The Go plan lists it `Unlimited` [S4]. Disjoint from all three auditor candidates. |
| Judge B | `opencode/flint-40b-free` | `flint` | 262k / 65k, text, `low…max` [S1][S3]. Disjoint from all three auditor candidates and from Beam. Explicit `max` effort matches the current `JUDGE_EFFORT = "max"` (`scripts/run-eval.ts:56-57`) without the retry-without-effort path (`src/lib/inference.ts:123-131`). |

Family matrix:

| Auditor under test | Beam (beam) | Flint (flint) | Disjoint? |
|---|---|---|---|
| `glm-5.3-flash-free` (glm-flash) | ✓ | ✓ | Yes |
| `deepseek-v4.1-flash-free` (deepseek-flash) | ✓ | ✓ | Yes |
| `nemotron-3.5-super-vl-free` (nemotron) | ✓ | ✓ | Yes |

**Caveats:**

- Both judges are text-only, which is sufficient for semantic matching on finding text
  and location (see the assumption at the top of §6). If #98 requires the judge to see
  the drawing, this pair cannot serve; use MiMo (§6.2) as the vision judge instead.
- Judge A is also the fleet's griller/discovery/worker model (`route.py status` [S5]),
  so a judging batch competes with the fleet on the same burst-limited endpoint.
- Flint is new (released 2026-10-21) and its free period allows the provider to use
  inputs to improve the model with 30-day retention [S4]. Use it only on the public
  calibration corpus, never on customer data. If that term is unacceptable, use §6.3
  instead.

### 6.2 Why not the obvious pairs

- **Zen `beam-free` + Go `beam-free`** — same model, not independent [S1][S2].
- **`mimo-v2.6-flash-free`** — would be a vision-capable judge, but it has no effort
  variants and its free period uses inputs for improvement [S1][S4]. Keep it as the
  fallback only if #98 requires the judge to see drawings.
- **`nemotron-3.5-lightning-free`** — same family as the Nemotron auditor candidate;
  using it as a judge would violate the constraint when Nemotron is under test.
- **`big-pickle`** — observed rate-limit failures, stealth model, data-use term
  [S4][S6].

### 6.3 Fallback pair for a fully no-training setup

If the operator rejects Flint's data term, use a **standing pair of Beam + whichever
no-training family is not the auditor under test** (GLM or DeepSeek):

| Auditor under test | Judge A | Judge B |
|---|---|---|
| `glm-5.3-flash-free` | `opencode-go/beam-free` | `opencode/deepseek-v4.1-flash-free` |
| `deepseek-v4.1-flash-free` | `opencode-go/beam-free` | `opencode/glm-5.3-flash-free` |
| `nemotron-3.5-super-vl-free` | `opencode-go/beam-free` | `opencode/glm-5.3-flash-free` (or DeepSeek free) |

Both judges are then no-training (GLM/DeepSeek are zero-retention; Beam retains 30 days), different families, and disjoint from
the auditor. The cost: the pair changes with the auditor, so record **which pair**
judged each scorecard. The one-off comparison loses strict cross-auditor
comparability; the standing scorecards gain a clean confidentiality posture.

## 7. Consequences for the build (not done in this ticket)

1. **Both pins are dead and must move.** `src/lib/ai.ts:76` and
   `scripts/run-eval.ts:56` both name unavailable models [S7]. A model swap on either
   path is a Tier-1 trigger: #92 §12 says so explicitly, and a `src/lib/ai.ts` change is
   also `docs/validation/eval-gates.md` §2 item 1. A scorecard without judge provenance
   is invalid (§3). Two more stale `x-preview-f-free` pins sit outside the runtime:
   `.github/workflows/opencode.yml:31` and the judge-identity row of
   `docs/validation/eval-gates.md:34`.
2. **The harness is single-judge today.** `scripts/run-eval.ts` has one `JUDGE_MODEL`
   and one `makeZenJudgeComplete`; #92 §5 requires two independent judges agreeing.
   That is a build gap for the scorecard ticket (#99), not a model-selection issue.
3. **The judge transport is model-prefix-routed.** `muse-spark-*` goes to
   `/responses`; everything else goes to `/chat/completions`
   (`src/lib/eval-run.ts:120-145`). Beam and Flint are chat-completions models [S4], so
   no transport change is needed — only the model id and, for Go Beam, the Go base URL
   and key (`https://opencode.ai/inference/go/openai/v1` [S4]).
4. **Quota contention is real.** The Zen free pool behaves as one daily account-level
   budget — all free models shared the same reset instant, though the API does not
   document the scope [S7]. A judging batch that runs alongside the agent fleet will
   starve itself; the Go Beam model is the throughput escape hatch, and it is free but
   rate-limited in bursts [S6].
5. **Do not present a free judge as more than it is.** #93's honesty rules apply: record
   model, effort, gateway, prompt version/hash, and the data-use term on every
   scorecard. The existing provenance block already has the shape
   (`state/eval-scorecards/2026-08-25T19-54-07-248Z/GF-10.json:8-16`).

## 8. Not established (stated rather than guessed)

- **Numeric RPM/RPD for any free model.** Not published [S4]; not derivable from the
  observed logs without the account's total request count.
- **Per-model success rate.** The log records stream starts and errors, not completions;
  the "starts" column is call volume, not a pass rate.
- **Image round-trip on the recommended models.** The Zen free pool was exhausted at
  probe time, and image support is taken from gateway/CLI metadata [S1][S3]. Smoke-test
  one image call per candidate before the default is switched.
- **Flint's real-world reliability.** It was released 2026-10-21 and has no observed
  calls in this lane [S6].
- **A production key's headroom.** The probe used the fleet key; a separate production
  key may have a different free allowance (unmeasured).
- **Whether "free-tier chat models require OpenCode" (S4) is a client gate or merely a
  recommendation.** The probe's error was a quota error, not a client rejection, and
  H7 previously used a free model from direct HTTP; the sentence is ambiguous and is not
  resolved here.

## 9. Sources

- **[S1]** OpenCode Console/Zen gateway catalog,
  `GET https://opencode.ai/zen/v1/models`, retrieved 2026-11-02. Used for ids, families,
  context/output, input modalities, reasoning efforts, and zero prices.
- **[S2]** OpenCode Go gateway catalog,
  `GET https://opencode.ai/inference/go/v1/models`, retrieved 2026-11-02.
- **[S3]** `opencode models --verbose`, opencode `1.18.20`, run 2026-11-02. Used for
  `status`, `limit`, `capabilities`, and `variants`.
- **[S4]** OpenCode docs: <https://opencode.ai/docs/zen/> (Console models, pricing, free
  models, privacy, deprecated models, endpoints) and <https://opencode.ai/docs/go/>
  (Go plans, usage limits, free models, endpoints, privacy), retrieved 2026-11-02.
- **[S5]** `python3 ~/.claude/skills/opencode-orchestrate/scripts/route.py status` and
  `~/.opencode-runs/_models/{attention.log,watch.log,preempt.log,transient.json,*}`
  (marks), read 2026-11-02.
- **[S6]** `~/.local/share/opencode/log/opencode.log`, lines from 2026-10-21T22:00Z to
  2026-11-02T07:57Z, aggregated by `modelID` for `message=stream` and
  `message="stream error"`.
- **[S7]** Live probe on 2026-11-02 07:54–07:56Z: `GET` on both catalogs and `POST` on
  both chat endpoints with `max_tokens: 8` for the ids in §2 and §3. Results:
  all eight catalog-listed Zen free models `429 FreeUsageLimitError` with
  `Retry-After` resolving to `2026-11-03T00:00Z`; `opencode-go/beam-free` `200`;
  `opencode-go/iceman-contributor-free` `400` privacy gate;
  `x-preview-f-free`, `muse-spark-1.3-contributor-free`,
  `minimax-m3.1-flash-free`, `nemotron-3-ultra-free` `400 Model is unavailable`.
- **[S8]** Repository: `src/lib/ai.ts:25,75-76,371,527,654-666`;
  `scripts/run-eval.ts:55-58`; `src/lib/eval-run.ts:111-145`;
  `src/lib/inference.ts:106-135`; `docs/validation/eval-gates.md` §2–§3;
  `docs/adr/0008-ai-candidate-generation.md:22,36-37`;
  `docs/adr/0019-judge-model-migration-horizon-order.md`;
  `docs/dev-notes/llm-brain-access.md`;
  `docs/research/README.md`;
  `state/eval-scorecards/2026-08-25T19-54-07-248Z/GF-10.json:8-16`.
- **[S9]** `~/.claude/skills/opencode-orchestrate/models.json`, read 2026-11-02 (routing
  chains; contains retired ids, see §2).
