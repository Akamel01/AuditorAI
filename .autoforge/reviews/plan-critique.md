# Plan Critique — Vault Memory Update (vault-state determinism + 2 gotcha settlements)

**Reviewer:** autoforge-reviewer (independent, read-only, ponytail, least-privilege)  
**Date:** 2026-09-02  
**Scope:** `.autoforge/plans/plan.md` (237 lines verbatim) + `.autoforge/execution/work-order.json` (140 lines verbatim) vs `.autoforge/discovery/tracker-index.md` (2 lines verbatim) + `.autoforge/discovery/report.md` (14 lines) + `.autoforge/requirements/grilling.md` (60 lines, Q1–Q10 R1–R6) + `.autoforge/architecture/report.md` (270 lines §1–§9) + `decisions.md` (112 lines AD-01–AD-10) + `vault/CHARTER.md:18-20,64-71` + `scripts/vault-sync.mjs:16-44` + `state/vault-notes.json:4,7-35`  
**Mode:** planning-only; no dispatch; read-only; 80k tok cap inherit `opencode/muse-spark-1.2-contributor-free 1M*0.30` respected  
**Skills:** `code-review` (two-axis), `ponytail` (ladder), `lean-build` smallest-diff, `codebase-design` seams

## Verdict

**APPROVED_WITH_NOTES**

Plan is complete, architecturally consistent, and safe to hold as planning-only. Enumeration covers both frontier tickets once, DAG is minimal and acyclic (`VG-01,VG-02 → VG-SYNC`), vault determinism guard (`scripts/vault-sync.mjs:16-44` HEAD worktree) is correctly isolated to VG-SYNC, staging hygiene and front-matter contract enforced, ponytail ceilings explicit. One hazard-normalization note (file-level disjoint guard) and one staging/documentation polish remain before parallel scheduler dispatch — neither blocks planning approval, neither is exploitable today (VG-01/VG-02 are the only prose writers, VG-SYNC is sole state writer, Phase 0 `vault-sync --check` currently green). No frozen-doctrine, irreversible, or speculative defect.

---

## 1. Enumeration completeness — PASS

- **Counting proof holds:** `tracker-index.md:1-2` `wc -l`=2 verified; `state/vault-notes.json:4` `note_count:25` with `notes[0] vault/gotchas/journal-deletions-and-tz.md status:"open" :12` and `notes[1] vault/gotchas/opencode-api-key-invocation.md status:"open" :26` (verified via `python3 -c` at review time). `discovery/report.md:7` confirms 2 open gotchas at `state/vault-notes.json:7-13,22-28`. `architecture/report.md:§1` counts same 2.
- **Plan enumerates 2 frontier modules + 1 infra closure:** `plan.md:20-23` table rows VG-01, VG-02 map 1:1 to tracker lines `tracker-index.md:1` and `:2` with verbatim citations; `plan.md:25` `2 frontier tickets = 2 frontier modules (VG-01, VG-02) + 1 infra closure module (VG-SYNC)` and `work-order.json:13` `tracker_count:2` + `work-order.json:19-73` modules `[VG-01,VG-02,VG-SYNC]` match. Notation `VG-SYNC — infra closure — not a frontier ticket` at `plan.md:107` and `work-order.json:58-60` correctly distinguishes machine-canonical compilation from frontier prose.
- **No merge, no omission, no invention:** Distinct operational domains cited — filesystem/append-only+TZ forensics (VG-01) vs keychain/eval invocation (VG-02) at `plan.md:25`; quoting front-matter vs journal bodies differ; dedup would fail. First-item-only failure mode explicitly called out at `plan.md:25` `First-item-only would be VG-01 alone → failure`.
- **Shared-state note correct:** `plan.md:27` `note_count:25` → single `state/vault-notes.json` serialized under `vault-state-single-writer` (AD-09) + tracker-index downstream mirror must co-commit (grilling Q4–Q5 `grilling.md:19-21`, arch `report.md:§6` hazard table). VG-SYNC is that co-committer.

## 2. Dependency ordering (DAG) — PASS

- **DAG minimal and acyclic:** `plan.md:134-140` diagram `VG-01 ──┐ ├──► VG-SYNC / VG-02 ──┘` + `plan.md:142-143` edges `VG-01→VG-SYNC`, `VG-02→VG-SYNC`; `work-order.json:75-78` edges with reason `prose must be in HEAD before HEAD worktree compile can reflect settled (vault-sync.mjs:17 worktree from HEAD)`; `work-order.json:79-84` `DAG.nodes [VG-01,VG-02,VG-SYNC] edges [[VG-01,VG-SYNC],[VG-02,VG-SYNC]] topological_order [[VG-01,VG-02],[VG-SYNC]]`. No edge `VG-01→VG-02` (`plan.md:144`, `work-order.json:83`).
- **Hazard vs semantic separation correct:** `plan.md:145` `No other DAG edges. All other overlaps are resource hazards serialized by vault-state-single-writer, not semantic DAG. blocked_by:[] for VG-01/VG-02 means hazard-only per grilling.md:14-15`. Matches `architecture/report.md:§6` sequencing `discovery→grilling→architect→settlement PRs→vault-sync→CI` where only data dependency is prose→HEAD→compile. No false `VG-01→VG-02` chain.
- **Phase gating correct:** `plan.md:47-52` Phase 0 baseline `--check` green else `vault-sync, commit, push`; Phase 1 P prose parallel, Phase 2 S determinism closure blocked by 1, Phase 3 proof gates `--check` + `git diff --exit-code` + `typecheck`. Verified at review time `node scripts/vault-sync.mjs --check` → `committed vault state matches HEAD compilation` exit 0, `git diff --exit-code -- vault/views state/vault-notes.json` exit 0 — gate satisfied, no pre-dispatch refresh needed before plan hold.

## 3. Architecture consistency — PASS

- **Three zones locked:** `plan.md:9-10` cites `vault/CHARTER.md:18-20` zones + front-matter contract `scripts/lib/frontmatter.mjs:78-109` + `vault-sync.mjs:16-44` determinism + `CHARTER.md:82-85` amendment — matches `architecture/report.md:§1` and `decisions.md:AD-01` (Prose/Views/Registries), `AD-02` (HEAD worktree ONLY), `AD-03` (append-only per-session), `AD-04` (gotcha `open→settled` + journal), `AD-05` (wholesale `rmSync`), `AD-07` (front-matter seam).
- **Seams reuse, not invention:** `plan.md:39` ponytail `Reuse frontmatter.mjs + paths.mjs + yaml already installed; stdlib (fs,path,crypto,child_process); no new deps, no new generic facade, no ORM, wholesale regen O(n) n=161 stays` matches `architecture/report.md:§2` seam inventory (front-matter parser `frontmatter.mjs:3-133`, vault-import `vault-import.mjs:14-90` sorted `path.localeCompare :79`, vault-export `vault-export.mjs:45-96` `sha :14-16` + `rmSync :46`, vault-sync `vault-sync.mjs:14-52` worktree+symlink+Buffer.equals `:31`). No `DistLockService`, no incremental patch, no `compileTrackerIndex()` — deferred per `decisions.md:AD-08` until n>10/1k.
- **Determinism invariant pinned:** `plan.md:34-35` guardrail `Never node scripts/vault-import.mjs / vault-export.mjs bare before commit. Only node scripts/vault-sync.mjs (sync) or --check` cites `scripts/vault-sync.mjs:2-6` `AGENTS.md:15-18` `decisions.md:AD-02`; `plan.md:35` byte-identical `sorted by path.localeCompare at vault-import.mjs:79, JSON stringify+"\n" at :88; views source_hash: sha(stateJSON).slice(0,12) at vault-export.mjs:14-16; CI git diff --exit-code -- vault/views state/vault-notes.json` matches `vault-sync.mjs:28-31` `Buffer.equals` and `ci.yml:50`. Verified `vault-sync.mjs:17` `git worktree add --detach ${tmp} HEAD`, `:19` symlink `node_modules`, `:21-22` compile-in-tmp, `:28-31` --check compare, `:42` sync `fs.writeFileSync(live,compiled)`, `:45-52` finally cleanup.
- **Least-privilege & ownership:** `plan.md:232` mapping human owns `vault/decisions|research-notes|gotchas` bodies (`CHARTER.md:66-67` agents propose, owner applies — but `owner:agent` here so agent may settle with journal proof at `plan.md:90`), agent may append journal only (`:18,64`), machines own `vault/views/**` + `state/*.json` — matches `decisions.md:AD-09` locks. Wayfinder deferred at `plan.md:61` `wayfinder only if frontier >10 (not now; kept hand-edited per AD-08)` — correct per `architecture/report.md:§8` Speculative tracker-index.

## 4. Touches overlap guard — PASS_WITH_NOTE

- **VG-01 vs VG-02 disjoint prose:** `plan.md:72` `touches: [vault/gotchas/journal-deletions-and-tz.md, vault/journal/*.md]` vs `plan.md:92` `touches: [vault/gotchas/opencode-api-key-invocation.md, vault/journal/*.md]` — distinct gotcha files, no shared file. `work-order.json:25` vs `:43` mirror. Good.
- **Journal directory overlap is file-level disjoint by convention:** Both `hazard_touches: [vault/journal/**]` at `plan.md:73,93` and `work-order.json:26,44` intersect at directory level. Plan marks `parallel_safe: true` with `parallel_notes: disjoint touches ... distinct journal filename` at `work-order.json:31,49` and `plan.md:76` `Wave: P — parallel_safe: true ... intersecting vault/journal/** only at directory level, not file level — guard is filename` plus `plan.md:85` `ponytail: global file-per-session ceiling; per-file lock deferred` and `architecture/report.md:§6` `per-session file level; no lock if naming holds`. Guard `plan.md:158` `disjoint touches (distinct gotcha file + distinct journal filename); no shared lock; may dispatch same turn as two Task calls` relies on scheduler enforcing distinct filenames (`vault/journal/YYYY-MM-DD-journal-deletions-settled.md` at `plan.md:79` vs `vault/journal/YYYY-MM-DD-opencode-key-settled.md` at `plan.md:91`).
- **VG-SYNC is sole state/views writer:** `plan.md:112` `touches: [state/vault-notes.json, vault/views/**, vault/views/evidence/**, .autoforge/discovery/tracker-index.md]` + `hazard_touches: [state/**, vault/views/**, .autoforge/discovery/tracker-index.md]` `blocked_by: [VG-01, VG-02]` `Wave: S — parallel_safe: false` + `work-order.json:61-72` locks `vault-state-single-writer modules [VG-SYNC] mode sequential` — correct. No concurrent `state/**` writer. Overlap with VG-01/VG-02 is read-only at compile time (worktree reads HEAD), not write-write — serialized by DAG, not lock.
- **Note N1 (non-blocking):** A strict `hazard_touches` glob scheduler would see `vault/journal/** ∩ vault/journal/**` and serialize VG-01↔VG-02 despite `parallel_safe:true`. Plan's escape is the filename guard. Before dispatch, normalize either (a) narrow `hazard_touches` to file-specific globs (`vault/journal/*-journal-deletions-*` vs `vault/journal/*-opencode-*`) or (b) keep directory glob but add explicit scheduler annotation `parallel_safe true iff journal filenames differ — enforce distinct slugs`. Current working-tree `work-order.json:113-116` shared_state_guard already documents file-level disjoint, so this is a normalization polish, not a blocking defect. No CHANGES_REQUIRED, but reviewer requires the note to be honored at dispatch.

## 5. Testability via `vault-sync --check` — PASS

Each module defines machine gates, not prose-only checkmarks:

- **Per-module dry check (VG-01/VG-02):** `plan.md:83,100` `parseFrontMatter` at `frontmatter.mjs:15-27` + `validateNoteFrontMatter` at `:78-109` must not throw; `plan.md:82,102` `rg -n "status: open"` →0; `plan.md:81` `No state/vault-notes.json or vault/views/** edited` (VG-SYNC owns it). Verified at review time both gotchas `status:open` parse correctly via `node --input-type=module` import — will flip to `settled` and remain valid per `frontmatter.mjs:99-106` `status:open|settled|superseded` required for `type:gotcha`.
- **VG-SYNC determinism gate (authoritative):** `plan.md:118-123` `node scripts/vault-sync.mjs --check → committed matches HEAD compilation at vault-sync.mjs:38` (exit 0) / `node scripts/vault-sync.mjs → refreshed` at `:42` + `git diff --exit-code -- vault/views state/vault-notes.json` green + CI `vault compile determinism (V2) at ci.yml:35-50 would pass` + `jq '.notes[] | select(.path=="vault/gotchas/...") | .status' → "settled"` + `jq '.note_count' = 25 + journals added` + `notes sorted localeCompare at vault-import.mjs:79` + `tracker-index drift 0` (`rg "journal-deletions-and-tz|opencode-api-key" tracker-index.md →0`) + `vault/views/graph-overview.md source_hash sha(gs).slice(0,12) at vault-export.mjs:85` + `evidence-index source_hash at :63` + `evidence/EV-*.md count 161`. All concrete, runnable with `jq`, `rg`, `git diff`.
- **Global proof before handoff:** `plan.md:174` `vault-sync --check pass + git diff --exit-code -- vault/views state/vault-notes.json pass + jq open-set empty + tracker alignment` — must be in every module's DoD. Currently both gates pass on working tree (verified exit 0).
- **Frozen doctrine not violated by gates:** Thresholds/judge prompts `docs/validation/eval-gates.md` frozen (`plan.md:41`, `AGENTS.md:eval gates`) — no CTR/quality change in this lane.

## 6. Parallel safety — PASS_WITH_NOTE

- **Waves correct:** `plan.md:155-160` `Wave P — prose parallel [VG-01,VG-02] parallel safe — may be dispatched same turn as two Task calls — disjoint touches + no state write` and `Wave S — state serial [VG-SYNC] sequential — holds vault-state-single-writer; blocked_by [VG-01,VG-02]`. `work-order.json:108-116` `parallel_safe_groups [[VG-01,VG-02]] sequential_groups [[VG-01,VG-02],[VG-SYNC]]` matches. Scheduler guidance `plan.md:162-164` `VG-SYNC blocked until both P members committed to HEAD (worktree reads HEAD at vault-sync.mjs:17). VG-SYNC never parallel with any other state/views writer`.
- **Resource locks minimal:** `work-order.json:85-106` `vault-state-single-writer modules [VG-SYNC] mode sequential`, `evidence-registry-single-writer [] read-only at vault-import.mjs:30-39`, `graph-state-single-writer [] subsumed at vault-export.mjs:78-95` — correct per `decisions.md:AD-09`. No over-locking; prose journals per-file append require no lock if names disjoint (`decisions.md:AD-09` hazard table).
- **Recommended schedule respects HEAD worktree:** `plan.md:168-172` `Baseline: --check → Turn P: dispatch VG-01+VG-02 parallel → Commit P: git add vault/gotchas/*.md vault/journal/*.md → Turn S: dispatch VG-SYNC single worker: node scripts/vault-sync.mjs → git diff → git add state/vault-notes.json vault/views .autoforge/discovery/tracker-index.md → verify jq settled + tracker drift 0 → commit` — correct ordering; VG-SYNC reads HEAD, so P must be committed first.
- **Staging poison guard:** `plan.md:41,148` `Explicit git add <paths> only; never git add -A` at `AGENTS.md:21-23` + VG-SYNC acceptance `plan.md:124` explicit `git add vault/gotchas/... vault/journal/... state/vault-notes.json vault/views .autoforge/discovery/tracker-index.md` — prevents foreign lane journal leak (discovery-ledger hazard seen in prior ops loop). Verified `git status --porcelain` currently clean for vault views/state.
- **Note N1 carries to parallelism:** See §4 N1 — scheduler must honor file-level disjoint, not directory glob, for P-wave parallelism. Wave P is safe today (distinct gotcha files + distinct journal slugs), but a lock-only scheduler honoring only `locks`+`hazard_touches` directory globs would incorrectly serialize P. Annotate before dispatch; no code change required.

## 7. Ponytail ladder — PASS

Ladder enforced per `plan.md:3` `Ponytail ladder enforced` and `plan.md:39,61,85,105,128` ceilings:

- **Rung 2 (reuse codebase):** `frontmatter.mjs` + `paths.mjs` + `yaml` already installed (`frontmatter.mjs:1` `parseYaml`) — cited at `plan.md:39` and `architecture/report.md:§2,§8` seams. No new helper invented.
- **Rung 3/4 (stdlib/native):** `fs,path,crypto,child_process` (`vault-sync.mjs:7-10`), `yaml` reuse — no new dep. `work-order.json:123` confirms.
- **Rung 6 (one line):** VG-01/VG-02 `one-line status edit + one journal file` at `plan.md:85,105` + `work-order.json:36,54`.
- **Rung 7 (minimum code):** Wholesale `rmSync` at `vault-export.mjs:46` `O(n) n=161` kept (`plan.md:85,128` `ponytail: wholesale regen O(n) n=161 ceiling until n>1k measurable`); tracker-index stays hand-edited while n=2 (`plan.md:128` `ponytail: ... compileTrackerIndex() deferred until frontier >10 per arch §8`); worktree+symlink `worktree+symlink ceiling; per-journal lock deferred` at `plan.md:85`.
- **What was skipped, when to add:** explicitly per module — FS immutable flag / pre-commit hook / new watcher code deferred until second deletion incident (`plan.md:85`), keychain helper / tsx wrapper deferred until latency >60s or rotation automation (`plan.md:105`), incremental view patch + `compileTrackerIndex()` deferred until n>10/1k (`plan.md:128`, `work-order.json:72`). Ceilings tagged with `ponytail:` comment pattern at `plan.md:85,105,128`.
- **Boundaries respected:** No abstraction with one implementation, no factory, no config for constant, no scaffolding for later — honest `plain paragraph` prose diff only.

## 8. Rollback / Failure handling — PASS

- **Vault poison rollback:** `plan.md:211` parallel journal poison → enforce `vault-sync.mjs:16-44` path, CI `--check` `:27-37`, `git diff` fails loud. Recovery is `node scripts/vault-sync.mjs` then commit — idempotent, no destructive migration.
- **Journal deletion bypass:** `plan.md:211` `rm` still possible → recovery runbook `stat`+`shasum` vs `git show HEAD:<path>` then `git restore` + deterrent `watch-vault-journal.sh` at `:40-44` logged outside repo (`plan.md:90` + `gotcha:journal-deletions-and-tz.md:40-44`). No FS immutable flag — deferred ceiling.
- **Orphan worktree/tmp:** `plan.md:215` `finally at vault-sync.mjs:45-52 best-effort worktree remove --force + rmSync(tmp)` WARN on catch (follow-on) — `ponytail: best-effort worktree cleanup ceiling` at `plan.md:128`.
- **Evidence_ids unresolvable:** fail-fast `vault-import.mjs:52-54` throws; pre-check `state/evidence-registry.json` exists at `:35` — `plan.md:213`.
- **Tracker drift:** `plan.md:215` `VG-SYNC co-commits state/vault-notes.json + tracker-index.md atomically; drift check jq … select(.status=="open") vs rg` — mitigates `plan.md:27,41` `tracker-index drift` risk.
- **Secret leak:** `plan.md:216` VG-02 body contains only `security find-generic-password` retrieval command, never key value; validator `rg -i "OPENCODE_API_KEY.*=[A-Za-z0-9]{20,}" vault/ →0` at `plan.md:125` — correct per `AGENTS.md:Secrets`.
- **No irreversible migration:** settlement is reversible: flip `status: settled → open` + add corrective journal; wholesale views `rmSync` is discard-by-design but regeneratable via `vault-export.mjs`.

## 9. Risks & mitigations — PASS

All `grilling.md:Q1–Q10` + `architecture/report.md:§7` risks carried into `plan.md:208-218`:

| Risk | Plan mitigation | Cite |
|---|---|---|
| Parallel journal poison | `vault-sync.mjs:16-44` + `--check` `:27-37` + `AGENTS.md:15-17` + `git diff` | `plan.md:210` |
| Journal deletion | `git restore` runbook + `watch-vault-journal.sh` deterrent | `plan.md:211` `gotcha:journal-deletions-and-tz.md:19` |
| TZ confusion | `date -u`, `TZ=... date` at `:35-36`; VG-SYNC logs UTC | `plan.md:212` |
| Evidence_ids unresolvable | fail-fast at `:53-54` + registry exists `:35` | `plan.md:213` |
| Hand-edit views lost | charter `68-71` + `rmSync` `:46` + `generated:true` + CI diff `:50` | `plan.md:214` |
| Tracker-index drift | co-commit + `jq` vs `rg` drift check | `plan.md:215` |
| Staging poison | explicit `git add <paths>` only | `plan.md:216` |
| Orphan tmp | `finally` best-effort + WARN | `plan.md:217` |
| Key paste | retrieve-only command, never value | `plan.md:218` |

No unmitigated high-severity risk; ceilings explicit.

## 10. Modularity — PASS

One module per frontier ticket (VG-01, VG-02) smallest diff, no bundling (filesystem vs keychain concerns kept separate per `decisions.md:AD-08` `one adapter = hypothetical`); infra closure VG-SYNC is separate module but may be batched as follow-up turn after P commits (`plan.md:61` `module boundary ≠ child-session boundary`). Touches scoped ≤2 files per VG plus distinct journal, ≤4 per VG-SYNC; reads via HEAD worktree. Wayfinder deferred at `plan.md:61` not needed at n=2.

## 11. Scope — PASS

Planning-only output per `plan.md:3` `planning-only. No product code dispatched, no tracker/map/ADR/state mutation.` Honored: `git diff HEAD --stat` shows plan/discovery/architecture/grilling tracked changes plus `state/discovery-ledger.json` (harvest side-effect, not vault lane) — no `vault/` or `state/vault-notes.json` or `vault/views` mutation beyond curated plan. Frozen doctrine preserved (`plan.md:41` + `work-order.json:123`).

## 12. Acceptance — PASS

Acceptance boxes concrete and testable (`plan.md:77-82,97-102,117-126`, `work-order.json:32,50,68`):

- VG-01: `status open→settled` preserves `title:"Journal deletions..." type:gotcha date:2026-08-23 owner:agent`, body unchanged except optional settlement note, new journal `type:journal status null owner:agent links.evidence_ids [] or resolves`, `parseFrontMatter+validateNoteFrontMatter` pass, no `state/views` edit, `rg status:open →0`.
- VG-02: same with `title:"OPENCODE_API_KEY handling..." date:2026-08-22`, body cites `security find-generic-password -a "$USER" -s auditorai/opencode -w` + `npx tsx scripts/run-eval.ts` + length check, no secret pasted.
- VG-SYNC: `--check` exit 0, `jq` both settled, `note_count` =25+delta (expected 27), sorted `localeCompare`, byte-identical, `source_hash` matches `sha(state)` at `vault-export.mjs:85,63`, tracker drift 0, explicit staging, `rg` secret 0, `typecheck/lint/build` green. Global proof `plan.md:174` enforced.

## 13. Vault-sync + git diff twin invariants — PASS

- `scripts/vault-sync.mjs:16-44` HEAD worktree compilation verified pass at review time (`vault-sync --check` exit 0, `git diff --exit-code -- vault/views state/vault-notes.json` exit 0, `note_count 25`, 23 journals, 161 evidence notes, `source_hash bcd420...` / `a5b0e44...` consistent).
- `work-order.json:118-124` `global_guardrails vault_determinism: node scripts/vault-sync.mjs --check` + `evidence_byte_identity: sorted keys + sha12` both preserved; VG-SYNC is the only writer that preserves byte-identity via `vault-import.mjs:79` sort + `vault-export.mjs:14-16` sha.
- No worker scheduled to mutate `state/vault-notes.json` concurrently without `vault-state-single-writer`; VG-01/VG-02 are read-only for state at compile time.

---

## Required changes before execution

All are directly resolvable, no `need-human.md` required (non-destructive, planning-only, gated by existing locks). None block `APPROVED` status — carry as dispatch notes.

### N1 — Hazard guard normalization for P-wave (file-level disjoint) — polish before dispatch

- **What:** Keep `work-order.json:26,44` `hazard_touches: ["vault/journal/**"]` as-is OR narrow to file-specific globs, but ensure scheduler annotation is honored. Current `work-order.json:115` `shared_state_guard: VG-01 and VG-02 touch vault/journal/** at directory level but file-level disjoint → parallel_safe true` and `plan.md:76` `parallel_safe: true ... guard is filename` correctly override directory overlap. Before dispatch, add one-line scheduler note to `plan.md:158` wave guard and `work-order.json:31,49` `parallel_notes`: `parallel_safe true iff journal slugs differ (journal-deletions-settled vs opencode-key-settled) — directory glob collision ignored at file level per CHARTER file-per-session §27`.
- **Why:** Strict `hazard_touches` intersect = sequential per instruction would serialize P-wave despite disjoint files. Architecture `report.md:§6` and `decisions.md:AD-03` explicitly allow per-file parallelism if naming holds. Annotate so a lock-only scheduler does not incorrectly serialize.
- **Lean fix:** No code, one-line comment. Alternatively set `hazard_touches` to `["vault/journal/*journal-deletions*"]` and `["vault/journal/*opencode*"]` to make glob-disjoint and remove the need for the annotation — either is acceptable; keep the annotation as minimum.

### N2 — Prose settlement lock documentation — informational

- **What:** `work-order.json:85-90` `vault-state-single-writer modules [VG-SYNC]` excludes VG-01/VG-02 who do write `vault/gotchas/**`. No fix needed because VG-SYNC does not write `vault/gotchas/**` and waves are sequential (`VG-01,VG-02 → VG-SYNC`), so no write-write race. Document at `plan.md:149` locks table: `vault-state-single-writer members in this lane: VG-SYNC only (prose gotcha edits are file-disjoint and wave-serialized before S; if future lane adds concurrent gotcha writers on same file, add to lock)`.
- **Why:** Aligns `decisions.md:AD-09` hazard `vault/gotchas/** settlement` under same lock family without over-locking today's disjoint P-wave. Keeps ponytail ceiling honest.

### Optional polish (not gating)

- Keep `plan.md:199` `node --input-type=module -e "import{parseFrontMatter...` form (correct ESM) and update `plan.md:80` legacy `require(...)` example to same ESM import to avoid confusion — trivial doc fix.

No irreversible, ambiguous, or doctrine-violating defect found. No `need-human.md`.

## References

- Vault determinism & byte-identity verified `vault-sync --check` pass, `git diff --exit-code -- vault/views state/vault-notes.json` pass at 2026-09-02 review time; `state/vault-notes.json:4 note_count:25` baseline; `state/graph-state.json` → `vault/views/graph-overview.md:2-5` `source_hash:bcd4207749e4` at `vault-export.mjs:85`; `state/evidence-registry.json` (161 records) → `vault/views/evidence-index.md:5` `source_hash:a5b0e4409061` at `:63`.
- Thresholds/judge/E5 frozen per `docs/validation/eval-gates.md:8-12`; ponytail ladder, no new deps; model budget `80k tok inherit muse-spark-1.2 1M*0.30 capped` — inputs sized `plan 237 + work-order 140 + tracker-index 2 + grilling 60 + report 270 + decisions 112` within cap.
- Architecture seams `scripts/lib/frontmatter.mjs:78-109` status contract, `vault-import.mjs:14-90` zone routing + sorted emit, `vault-export.mjs:45-96` wholesale + sha12, `vault-sync.mjs:16-44` HEAD worktree + symlink + Buffer.equals.

---
*Reviewer: independent, least-privilege read-only; no speculative vault implementation proposed; E5/judge/threshold frozen; vault determinism and evidence byte-identity preserved; ponytail ladder respected.*
