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
