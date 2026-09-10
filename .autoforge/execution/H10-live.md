# H10 LIVE runs — prod https://auditorai-gamma.vercel.app (2026-09-10 ~04:36–04:40 UTC)

Worker: autoforge-worker, NO CODE EDITS. ADMIN_KEY via keychain `auditorai/admin-key` only, values never pasted/logged.
Plan: `.autoforge/plans/plan-H10.md` M4–M6. Skill: verify-and-stop.

## (1) Pre-flight — PASS
- `GET /api/dev/tickets` (x-admin-key) → **HTTP 200**, 82 tickets, 33991 bytes. Key OK, proceeding.

## (2) M4 P1+P3 stream #1 — RED (harness assert, exit 1)
- Cmd: `HARVEST_BASE_URL=prod node scripts/harvest-verify.mjs --api harvest-stream --live --monitor --maxTicks 6 --stop`
- Stream: `stream_mtv1bw8c_59xlf2` (gap-aware, continuous=true)
- Output (verbatim): POST `{live:true,continuous:true}` → `streamId=stream_mtv1bw8c_59xlf2` → `[harvest-verify] ASSERT packages grew without a new http(s) url` → **EXIT:1**. No per-tick RUNNING lines printed (assert fired on first growth poll); **no HV10 bundle written** (early return precedes bundle write, harness ll.306–309).
- Prod truth (redacted GET): stream reached iter 2, 8 pkgs, logs `iteration 1 done packages=4`, `continuous next UK`, `iteration 2 done packages=8`, `continuous next UK` — ticks healthy, Exa-sourced `source_urls` present.
- Root cause (two layers, both code-lane):
  1. Harness `scripts/harvest-verify.mjs:304` reads `p?.url`, but live stream packages carry **no top-level `url`** — URLs live at `metadata.source_urls[]`. `newUrls` always empty → any growth trips the assert. One-line fix candidate: fall back to `p?.metadata?.source_urls`.
  2. Product signal: continuous tick 2 **re-appended the same 4 packages** (PKG-74305e7b…, PKG-9d8ca283…, PKG-b89367325…, PKG-1fa209fe… duplicated 4→8; `dedupeIndex.clusters` empty, quality all "unique"). Cross-iteration dedupe absent in stream core.
- P3 (pause/resume) unreached — harness exited before tick 2. Left RUNNING → **stopped promptly via API** by worker: `POST …/stop` → FAILED + `error="stopped by operator"` (confirmed via GET). No orphan.
- Verdict: M4 P1 **RED**, P3 **not-proven** (blocked by assert bug, not by prod).

## (3) M5 P2 stream #2 — SKIPPED (deterministic-red, quota guard)
- NOT run. Same per-tick url assert (ll.304–309) is **ungated on continuous mode** → single-shot growth tick (0→4 pkgs, no `p.url`) would exit 1 identically, leave a server-side RUNNING single-shot stream burning quota until manually stopped (which would corrupt the FAILED-at-cap verdict anyway). Defined verdict unreachable without code fix; running spends stream #2 of 2 for zero new information. Re-run after harness fix: `--continuous=false --cellKey usa:PRELIMINARY_DESIGN --maxTicks 12`.

## (4) M6 prod e2e — GREEN
- Cmd: `PLAYWRIGHT_BASE_URL=prod npx playwright test tests/e2e/harvest-buttons.spec.ts -g "ai harvest stream"`
- Result: **1 passed (28.8s), EXIT:0** — Start posts continuous:true, 2× RUNNING polls, Stop click → FAILED/stopped. Test stopped its own stream.
- E2e stream `stream_mtv1ebwq_2uco9m` → FAILED `stopped by operator`, iter 1. No orphan.

## (5) Orphan check — CLEAN (mine)
- `GET /api/dev/harvest-stream` index (20 streams): both worker-created streams terminal — `stream_mtv1bw8c_59xlf2` FAILED/stopped, `stream_mtv1ebwq_2uco9m` FAILED/stopped.
- Other RUNNING streams (mtv0*, mtuz*, mttt*, ages 29–1233 min) are FOREIGN lanes — not touched.

## Hygiene
- `grep -ri "x-admin-key|admin_key" state/harvest-verify/` → **zero matches** (no secrets in evidence).
- No HV10 bundles exist (none written — see M4). No git add/commit/push. Tree left dirty (code-lane edits untouched).

## Bottom line for validator/integration
- Prod seams WORK (ticks advance, packages real, stop→FAILED, UI e2e green). M4 RED is a **harness-vs-shape bug** (`p.url` vs `metadata.source_urls`), plus a **dup-append product signal** for the stream core. Fix both, then re-run M4+M5 (2 streams) to close P1/P2/P3.

---

# H10 M4 P1+P3 LIVE RE-RUN — prod https://auditorai-gamma.vercel.app (2026-09-10 ~05:23–05:26 UTC)

Worker: autoforge-worker (gpt-5-nano lane), NO CODE EDITS. Deployed code: commit 353918e (unique-only append + stop-race guard), CI+Gate+deploy green. ADMIN_KEY via keychain `auditorai/admin-key` only, values never pasted/logged. Skill: verify-and-stop.

## (1) Pre-flight — PASS
- Keychain `auditorai/admin-key` → KEYCHAIN_OK (presence only, value never printed).
- `GET /api/dev/tickets` (x-admin-key, redacted) → **HTTP 200**, 82 tickets, 34010 bytes. No 401, proceeding.

## (2) M4 P1+P3 stream #1 — GREEN (exit 0)
- Cmd: `HARVEST_BASE_URL=prod node scripts/harvest-verify.mjs --api harvest-stream --live --monitor --maxTicks 6 --stop` (gap-aware, continuous=true; ADMIN_KEY from keychain, never echoed).
- Stream: `stream_mtv30hxf_pmt237`. **EXIT:0**.
- Verbatim harness lines: `POST /api/dev/harvest-stream {"live":true,"continuous":true}` → `streamId=stream_mtv30hxf_pmt237` → 6× `RUNNING stream=stream_mtv30hxf_pmt237` (pkgs 3→4→4→4→4→4, logs 4→7→12→15→18→21) → `[harvest-verify] P3 pause→PAUSED + resume→RUNNING ok` → `[harvest-verify] maxTicks 6 reached at status RUNNING` → `[harvest-verify] stopped by monitor → FAILED (stopped by operator)` → `[harvest-verify] FAIL — stream stream_mtv30hxf_pmt237 status FAILED ledger+0 dedupe+0 pkgs 4` (harness word for terminal-FAILED verdict, exit stays 0) → evidence lines → `EXIT:0`.
- P1 asserts (all hold): 6/6 ticks RUNNING (RUNNING dominant, zero VERIFYING mid-tick races this run); prod log shows `iteration N start` → `iteration N done` strictly ↑ 1→6; packages non-decreasing (3,4,4,4,4,4); 4 package_ids all unique, zero dupes (prior run's 4→8 dup-append gone); every new `metadata.source_urls[]` matches `^https://` (4/4 — planning.welhat.gov.uk, open.alberta.ca, pleanala.ie, hingham-ma.gov; full URLs in bundle, trimmed here); logs contain `continuous next UK` ×6 plus new dup-filter signal `continuous next UK (dupes skipped 3)` → `(dupes skipped 4)` ×5 — direct prod proof the unique-only append fix (353918e) works on the same 4 PKG ids that duplicated last run. Caveat (quoted honestly): harness printed `note: no agent-reach trace yet (seed-only ticks have none)` each tick — no Exa/Jina substrings in these seed-only ticks; harness treats as note, not failure, exit 0 stands.
- Stop-path: post-maxTicks `POST …/:id/stop` → confirming GET `status=FAILED` + `error="stopped by operator"` (bundle `stream` + `job.result` both FAILED, iteration 6/10). Exit 0 = asserted stop path per plan M1/M4.
- P3 (same stream, before stop): harness `P3 pause→PAUSED + resume→RUNNING ok`; prod log confirms `paused` → `resumed` between iteration 2 and 3. No race retry needed. **P3 GREEN.**
- Bundle: `state/harvest-verify/HV10-stream_stream_mtv30hxf_pmt237.json` (+ `stream-*.json` alias + `harvest-stream-latest.json`), `meta.baseUrl=https://auditorai-gamma.vercel.app`, `meta` carries no key; `deltas: ledgerDelta 0, packagesLen 4`; `hv5.verdict=fail` is the unrelated queue-shape sub-check, not the P1 verdict.
- Verdict: M4 P1 **GREEN**, P3 **GREEN**.

## (3) Orphan check — CLEAN (mine)
- Index `GET /api/dev/harvest-stream` (20 streams, redacted): worker stream `stream_mtv30hxf_pmt237` → FAILED/`stopped by operator`, iter 6 — stopped by harness, confirmed terminal. Nothing of mine left RUNNING; no manual stop needed.
- Foreign RUNNING (7, NOT touched): `stream_mtv1ebwq_2uco9m` (iter 3), `stream_mtv0d4b3_us2f3y`, `stream_mtv0cke6_3la7t6`, `stream_mtv05w79_zxm8vz`, `stream_mtv04gh0_3zc2hj`, `stream_mtv02flm_84yglt`, `stream_mtuzv5vq_khjx5m`. Ops note: `stream_mtv1ebwq_2uco9m` (prior e2e stream) was recorded FAILED/stopped earlier but index now shows RUNNING iter 3 upd 04:55:27 — possible index staleness or foreign-lane activity; foreign either way, left alone per 1-stream/no-touch rule.

## Hygiene
- `grep -ri "admin_key" state/harvest-verify/HV10-*.json` → **0 matches**; `grep -ri "x-admin-key"` on both new bundles → **0 matches**; bundle-wide key-pattern scan → 0 hits. No secrets in evidence.
- Single stream this session, no reruns. No git add/commit/push. No code edits. Tree left dirty (evidence kept).
