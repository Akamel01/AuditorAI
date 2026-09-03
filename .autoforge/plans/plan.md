# Plan — Obsidian Vault Memory Update (vault-state determinism + 2 gotcha settlements)

**Scope:** planning-only. No product code dispatched, no tracker/map/ADR/state mutation. Ponytail ladder enforced; vault determinism (HEAD worktree) is hard constraint.

**Sources pinned (verbatim / summarized):**
- `.autoforge/discovery/tracker-index.md` (2 entries verbatim, 2026-09-02): `vault/gotchas/journal-deletions-and-tz.md — vault` , `vault/gotchas/opencode-api-key-invocation.md — vault`
- `.autoforge/discovery/report.md` (14 lines summarized): vault is hybrid memory Prose/Views/Registries at `vault/CHARTER.md:18-20`; `state/vault-notes.json` compiled from vault, checked byte-for-byte; 2 open gotchas at `state/vault-notes.json:7-13,22-28`; `note_count:25` (2 gotchas+23 journals, journals `status:null`); graph via `state/graph-state.json` → `vault/views/graph-overview.md`
- `.autoforge/requirements/grilling.md` (60 lines summarized): Q1–Q10 surface lifecycle/evidence_ids/status/governance/graph/journal-deletions/idempotence/monitoring; R1–R6 lazy-first (extend tracker-index, rely on `vault-sync.mjs`, views invariant, evidence_ids resolve, determinism test, runbook)
- `.autoforge/architecture/report.md` (270 lines, §1–§9) + `decisions.md` (112 lines, AD-01–AD-10): three zones locked, front-matter contract at `scripts/lib/frontmatter.mjs:78-109` (`title|type|date|owner|status|links`), head-worktree determinism at `scripts/vault-sync.mjs:16-44` (chosen over bare/stash/KV), file-per-session append-only journals, gotcha lifecycle `open→settled`+journal, wholesale `rmSync`+`source_hash` views, graph derived, deep seams inventory, locks `vault-state-single-writer`/`evidence-registry`/`graph-state`, wholesale O(n) n=161 ceiling
- `vault/CHARTER.md` (85 lines): zones Prose `vault/{journal,decisions,research-notes,gotchas}` human-curated append-only, Views `vault/views` machine `generated:true`, Registries `state/*.json` `schema_version:1.0.0` via compiles; front-matter contract `type: journal|decision|research-note|gotcha`, `status: open|settled|superseded` (journals omit), `owner: human|agent`, `links.evidence_ids` must resolve; conflict rules append-only/curated human-wins/views discard; amendment owner-only
- `scripts/vault-sync.mjs` (52 lines verbatim): `git worktree add --detach ${tmp} HEAD` at `:17`, symlink `node_modules` at `:19`, compile-in-tmp `vault-import`+`vault-export` at `:21-22`, `--check` compare `git show HEAD:state/vault-notes.json` vs compiled via `Buffer.equals` at `:28-31` or sync `fs.writeFileSync(live,compiled)` at `:42`, `finally` cleanup at `:45-52`
- `state/vault-notes.json` (382 lines verbatim): `schema_version:1.0.0` `compiled_at_commit_only:true` `note_count:25`, notes[0] `vault/gotchas/journal-deletions-and-tz.md` `status:"open"` `:12` `body_chars:1984`, notes[1] `vault/gotchas/opencode-api-key-invocation.md` `status:"open"` `:26` `body_chars:1190`, plus 23 journals `status:null`

**Blocked-by:** discovery done → grilling done → architect (report+decisions) done → **this plan**. No dispatch before `vault-sync --check` baseline green. Model budget: inherit `opencode/muse-spark-1.2-contributor-free 1M → 80k cap` (1M*0.30 capped). Skills: `codebase-design` (seam vocabulary), `wayfinder` only if frontier >10 (not now; kept hand-edited per AD-08).

---

## 1. Tracker and status reconciliation (MUST cover all — one module per frontier ticket)

| # | Tracker-index line (verbatim) | Frontier ticket (canonical) | State source | State status | Plan module |
|---|---|---|---|---|---|
| 1 | `vault/gotchas/journal-deletions-and-tz.md — vault` at `tracker-index.md:1` | `vault/gotchas/journal-deletions-and-tz.md` — gotcha: parallel-session deletion + UTC/PDT confusion, hard-won lesson | `state/vault-notes.json:7-20` `path:"vault/gotchas/journal-deletions-and-tz.md"` `status:"open"` `owner:"agent"` `body_chars:1984` | **OPEN** — mirrors tracker | **VG-01** |
| 2 | `vault/gotchas/opencode-api-key-invocation.md — vault` at `tracker-index.md:2` | `vault/gotchas/opencode-api-key-invocation.md` — gotcha: OPENCODE_API_KEY keychain + eval `tsx` invocation quirks | `state/vault-notes.json:22-35` `path:"vault/gotchas/opencode-api-key-invocation.md"` `status:"open"` `owner:"agent"` `body_chars:1190` | **OPEN** — mirrors tracker | **VG-02** |

**Counting proof:** `tracker-index.md` has 2 lines (`wc -l` =2). Discovery report `report.md:7` confirms 2 open gotchas in `state/vault-notes.json`. Architecture `report.md`  `§1` counts same 2. This plan enumerates **2 frontier tickets = 2 frontier modules (VG-01, VG-02)** + 1 infra closure module (VG-SYNC) that is **not** a frontier ticket but is the single writer that makes both settlements testable/deterministic. No merge: distinct operational domains (filesystem/append-only vs keychain/eval invocation); quoting front-matter or journal bodies differ; dedup cite would fail. First-item-only would be VG-01 alone → **failure** per instructions.

**Shared-state note:** Both gotchas compile into the single `state/vault-notes.json:4` `note_count:25` → any writer of `state/vault-notes.json` or `vault/views/**` must serialize under `vault-state-single-writer` (AD-09). Tracker-index `.autoforge/discovery/tracker-index.md:1-2` is downstream mirror of the open-set; update together or drift (grilling Q4–Q5, arch report §6 hazard table).

---

## 2. Global execution guardrails

| Guardrail | Enforcement | Cite |
|---|---|---|
| **Vault determinism (HEAD worktree only)** | Never `node scripts/vault-import.mjs` / `vault-export.mjs` bare before commit. Only `node scripts/vault-sync.mjs` (sync) or `node scripts/vault-sync.mjs --check` (CI). | `scripts/vault-sync.mjs:2-6` `AGENTS.md:15-18` `architecture/decisions.md:AD-02` |
| **Byte-identical registries → views** | `state/vault-notes.json` sorted by `path.localeCompare` at `vault-import.mjs:79`, JSON `stringify+ "\n"` at `:88`; views `source_hash: sha(stateJSON).slice(0,12)` at `vault-export.mjs:14-16`; CI `git diff --exit-code -- vault/views state/vault-notes.json` | `vault-export.mjs:14-16,45-48` `vault-import.mjs:79,88` `.github/workflows/ci.yml:50` |
| **Front-matter contract** | `scripts/lib/frontmatter.mjs:78-109` validates `title|type|date|owner|status|links`; `type:gotcha` must have `status:open|settled|superseded` at `:99-106`; `links.evidence_ids` normalized at `:111-123` and resolved at `vault-import.mjs:52-54` | `frontmatter.mjs:6-7,99-106` |
| **Staging hygiene** | Explicit `git add <paths>` only; never `git add -A` (foreign lane journals poison). | `AGENTS.md:21-23` `decisions.md:AD-09` |
| **Ponytail ladder** | Reuse `frontmatter.mjs` + `paths.mjs` + `yaml` already installed; stdlib (`fs`,`path`,`crypto`,`child_process`); no new deps, no new generic facade, no ORM, wholesale regen O(n) n=161 stays | `architecture/report.md:§2,§8` `decisions.md:AD-08` |
| **Single-writer locks** | `vault-state-single-writer` for any `state/vault-notes.json` / `vault/views/**` / `vault/gotchas/**` settlement / `.autoforge/discovery/tracker-index.md` co-commit; `evidence-registry-single-writer` if registry touched; journal append per-file no lock if names disjoint | `decisions.md:AD-09` `report.md:§6` |
| **Frozen doctrine (no scope creep)** | Thresholds/judge prompts `docs/validation/eval-gates.md` frozen; no CTR/quality change inside vault-memory lane | `AGENTS.md:eval gates` |

---

## 3. Phases — settlement → determinism → verification

```
Phase 0 — Baseline (gated):  vault-sync --check green? ──no──▶ run vault-sync, commit, push
                              │
Phase 1 — Prose settlements (parallel safe, disjoint touches):
                              ├──► VG-01  journal-deletions-and-tz  (gotcha edit + journal)
                              └──► VG-02  opencode-api-key          (gotcha edit + journal)
                              │         (can run same turn as separate Task calls; no shared file)
                              ▼
Phase 2 — Determinism closure (single writer, blocked by 1):
                              └──► VG-SYNC  HEAD worktree compile  (state + views + tracker-index)
                                        │
Phase 3 — Proof gates:  vault-sync --check  +  git diff --exit-code -- vault/views state/vault-notes.json  +  run/scripts lint/typecheck/build
```

Phase separation respects: **module boundary ≠ child-session boundary** — VG-01 and VG-02 are distinct modules but may be dispatched in one parallel Task batch because their `touches` are disjoint; VG-SYNC is separate module but may be batched as follow-up turn after both prose modules land. Ponytail: no extra phase for ADR/charter amendment (deferred until owner asks at `CHARTER.md:82-85`).

---

## 4. Modules — objective, inputs/outputs, touches, dependencies, acceptance, skills, agent

### VG-01 — Settle `journal-deletions-and-tz` gotcha — FRONTIER — Wave P

- **Objective:** Record that the `rm` bypass + TZ forensics lesson is now operationalized (deterrent script documented, recovery runbook triaged) and transition the gotcha from open to settled via charter-legal edit, with an append-only journal entry as audit trail. Ponytail: status flip + one journal file; no FS watcher new code; no immutable-flag code (ceiling deferred).
- **Inputs:** `vault/gotchas/journal-deletions-and-tz.md` front-matter `status:open` at `state/vault-notes.json:12`, body `body_chars:1984`, deterrent `scripts/watch-vault-journal.sh` reference at `vault/gotchas/journal-deletions-and-tz.md:40-44`, charter `CHARTER.md:64-66` append-only rule.
- **Outputs:** `vault/gotchas/journal-deletions-and-tz.md` with `status: settled` (validated at `frontmatter.mjs:99-106`), one new `vault/journal/YYYY-MM-DD-journal-deletions-settled.md` (or current date) with `type:journal` `status:null` `owner:agent` referencing the gotcha, ready for VG-SYNC compilation. No direct `state/*.json` write (VG-SYNC owns it).
- **touches:** [`vault/gotchas/journal-deletions-and-tz.md`, `vault/journal/*.md`]
- **hazard_touches:** [`vault/journal/**`] (disjoint filename, no writer conflict if next file name differs from VG-02's file)
- **blocked_by:** [] — frontier root; gated by architect (this plan) and Phase 0 baseline.
- **Lock:** none (per-file append-only); shares `vault-state-single-writer` only indirectly via VG-SYNC, so parallel with VG-02 allowed.
- **Wave:** P (prose-parallel) — **parallel_safe: true** with VG-02 (disjoint `touches`; intersecting `vault/journal/**` only at directory level, not file level — guard is filename).
- **Acceptance (testable):**
  - [ ] `vault/gotchas/journal-deletions-and-tz.md` front-matter diff is exactly `status: open → settled`, preserves `title:"Journal deletions by parallel sessions + UTC/local timestamp confusion"` `type:gotcha` `date:2026-08-23` `owner:agent`, body unchanged except optional settlement note line (if any, cited).
  - [ ] New journal file exists: `vault/journal/YYYY-MM-DD-*.md` with valid front-matter `title` (mentions `journal-deletions` + `settled`), `type:journal`, `date:YYYY-MM-DD`, `owner:agent`, `status` omitted/null per charter, `links.evidence_ids` either `[]` or resolves in `state/evidence-registry.json` (validated by `vault-import`), body references `vault/gotchas/journal-deletions-and-tz.md` and states recovery runbook verified (`stat`/`shasum` vs `git show HEAD:<path>`, `git restore`).
  - [ ] `node -e "require('./scripts/lib/frontmatter.mjs')"` or `node scripts/vault-import.mjs` does not throw for this file (front-matter passes `validateNoteFrontMatter`).
  - [ ] No `state/vault-notes.json` or `vault/views/**` edited in this module (VG-SYNC does).
  - [ ] `rg -n "status: open" vault/gotchas/journal-deletions-and-tz.md` returns 0; `grep -A2 settled` shows 1 hit.
- **Skills/tools/tests:** `lean-build` (reuse `frontmatter.mjs` seam), `codebase-design` (keep seams small), `verify-and-stop` for import dry-run.
- **Agent role:** `autoforge-worker (surgical — prose-only)` — **Reviewer:** `autoforge-reviewer` checks charter compliance, front-matter contract, no bare `vault-import` run, no view hand-edit.
- **Ponytail:** One-line status edit + one journal file. Skipped: FS immutable flag / git pre-commit hook / new watcher code. Add when second deletion incident measured. `ponytail: global file-per-session ceiling; per-file lock deferred`.

### VG-02 — Settle `opencode-api-key-invocation` gotcha — FRONTIER — Wave P

- **Objective:** Record that the OPENCODE_API_KEY keychain pattern and eval `tsx` invocation fix are now canonical (key stored via `security add-generic-password -s auditorai/opencode`, invoked via `OPENCODE_API_KEY="$(security find-generic-password … -w)" <command>`, length sanity `≈60+ chars`, use `npx tsx` via `scripts/run-eval.ts` at `.github/workflows/eval.yml:29`). Transition gotcha `open→settled` with journal audit trail. Ponytail: no new wrapper script; cite existing keychain + ci form.
- **Inputs:** `vault/gotchas/opencode-api-key-invocation.md` `status:open` at `state/vault-notes.json:26`, `body_chars:1190`, `vault/CHARTER.md` curated-note human-owned rule (`CHARTER.md:66-67` agents propose, owner applies — but `owner:agent` here so agent may settle with journal proof).
- **Outputs:** `vault/gotchas/opencode-api-key-invocation.md` with `status: settled`, one new `vault/journal/YYYY-MM-DD-opencode-key-settled.md` (disjoint filename from VG-01) with valid front-matter and body linking the gotcha and noting `npx tsx` canonical path + `~30s` judge budget.
- **touches:** [`vault/gotchas/opencode-api-key-invocation.md`, `vault/journal/*.md`]
- **hazard_touches:** [`vault/journal/**`] (filename-disjoint from VG-01, parallel safe)
- **blocked_by:** [] — frontier root; parallel with VG-01. No dependency between the two gotchas (orthogonal lessons; no shared file).
- **Lock:** none (per-file). `vault-state-single-writer` only via VG-SYNC.
- **Wave:** P — **parallel_safe: true** with VG-01; **sequential** with VG-SYNC (VG-SYNC blocked_by both).
- **Acceptance (testable):**
  - [ ] `vault/gotchas/opencode-api-key-invocation.md` diff is `status: open → settled`, preserves `title:"OPENCODE_API_KEY handling + eval invocation quirks"` `type:gotcha` `date:2026-08-22` `owner:agent`.
  - [ ] New journal file exists with valid front-matter (`type:journal`, `date`, `owner:agent`, `status` null/omitted), body contains `security find-generic-password -a "$USER" -s auditorai/opencode -w` snippet and `npx tsx scripts/run-eval.ts` citation + `echo ${#K}` length check note; `links.evidence_ids` resolves or `[]`.
  - [ ] `node scripts/vault-import.mjs --dry` equivalent does not fail on this file; `parseFrontMatter` at `frontmatter.mjs:15-27` + `validateNoteFrontMatter` at `:78-109` pass.
  - [ ] No `state/` or `vault/views/` mutated in this module.
  - [ ] `rg -n "status: open" vault/gotchas/opencode-api-key-invocation.md` → 0.
- **Skills/tools/tests:** `lean-build`, `domain-modeling` for gotcha glossary, `verify-and-stop`.
- **Agent role:** `autoforge-worker (surgical — prose-only)` — **Reviewer:** `autoforge-reviewer` verifies no secret pasted (key never in file), body does not contain key material, only retrieval command.
- **Ponytail:** Minimal prose diff. Skipped: new keychain helper script / tsx wrapper. Add when `npx tsx` latency measured >60s or key rotation automation needed. `ponytail: doc-only ceiling`.

### VG-SYNC — Head-worktree determinism refresh + tracker-index alignment — INFRA CLOSURE — Wave S

- **Objective:** Compile the settled prose (VG-01 + VG-02 journals+gotchas) deterministically from HEAD via the hardened worktree path and co-commit the machine-canonical outputs, aligning `.autoforge/discovery/tracker-index.md` with the new open-set (expected empty or without the two lines). This is the ONLY writer of `state/vault-notes.json` + `vault/views/**` in this lane, enforcing `vault-state-single-writer`. Ponytail: reuse existing `vault-sync.mjs` + `vault-import/export` + `frontmatter.mjs` seams; no incremental view logic.
- **Inputs:** HEAD tree after VG-01+VG-02 prose landed (committed or staged), `scripts/vault-sync.mjs:16-44`, `scripts/vault-import.mjs:14-90` (`CHARTERED_ZONES` at `:14-19`, `listMarkdown` sorted at `:27`, `loadRegistryIds` at `:30-39`, `notes.sort localeCompare` at `:79`), `scripts/vault-export.mjs:45-96` (`rmSync` wholesale at `:46`, `sha` at `:14-16`, deterministic sorts at `:51,67`), `state/evidence-registry.json` (161 records), `state/graph-state.json`, `state/validation-state.json`, `.autoforge/discovery/tracker-index.md:1-2` (pre-state).
- **Outputs:** `state/vault-notes.json` refreshed (`schema_version:1.0.0`, `compiled_at_commit_only:true`, `note_count:27` if both settlements add one journal each? or `25` if journals reuse date? — assert `note_count` = prior 25 + new journals count, both gotchas now `status:"settled"`), `vault/views/**` wholesale regenerated (`evidence-index.md` + `evidence/EV-*.md` 161, `graph-overview.md` `source_hash: sha(gs).slice(0,12)` at `vault-export.mjs:85`, `validation-log.md`), `.autoforge/discovery/tracker-index.md` updated to reflect remaining open set (0 lines if both settled, or trimmed by 2). All byte-identical via sorted serialization.
- **touches:** [`state/vault-notes.json`, `vault/views/**`, `vault/views/evidence/**`, `.autoforge/discovery/tracker-index.md`]
- **hazard_touches:** [`state/**`, `vault/views/**`, `.autoforge/discovery/tracker-index.md`] — **single-writer**; intersects both VG-01/VG-02 only at compile time (reads their prose), but writes are exclusive to this module.
- **blocked_by:** [`VG-01`, `VG-02`] — must run after both prose modules land in HEAD worktree (see DAG). Also blocked_by Phase 0 baseline (`vault-sync --check` before handoff).
- **Lock:** `vault-state-single-writer` — **mode: sequential** — no concurrent `vault-import/export/sync` (arch `§6` hazard table); `evidence-registry-single-writer` not needed (registry read-only); `graph-state-single-writer` subsumed.
- **Wave:** S (state-serial) — **parallel_safe: false** — must be alone on that lock; cannot parallel with any other `state/**` or `vault/views/**` writer.
- **Acceptance (testable — machine gates):**
  - [ ] `node scripts/vault-sync.mjs --check` → `committed vault state matches HEAD compilation` at `vault-sync.mjs:38` (exit 0). Before: run `node scripts/vault-sync.mjs` then `git diff --exit-code -- vault/views state/vault-notes.json` → exit 0 (byte-identical). CI job `vault compile determinism (V2)` at `.github/workflows/ci.yml:35-50` would pass.
  - [ ] `cat state/vault-notes.json | jq '.notes[] | select(.path=="vault/gotchas/journal-deletions-and-tz.md") | .status'` → `"settled"`; same for `opencode-api-key-invocation.md` → `"settled"`.
  - [ ] `jq '.note_count' state/vault-notes.json` = 25 + `ls vault/journal/*.md | wc -l` delta (expected 27 if two journals added, 26 if one combined — assert delta = journals added). No `status:"open"` remains for those two paths; at most 0 open gotchas left.
  - [ ] `jq '.notes | sort_by(.path) | .[].path' state/vault-notes.json` is sorted `localeCompare` (import invariant at `vault-import.mjs:79`).
  - [ ] `cat .autoforge/discovery/tracker-index.md | wc -l` = 0 (if both settled) or =0 with no stale `— vault` lines; or if policy keeps file with comment, then `rg "journal-deletions-and-tz|opencode-api-key" .autoforge/discovery/tracker-index.md` → 0 hits. Drift check: open-set from `state/vault-notes.json` `notes[] | select(.status=="open") | .path` equals tracker lines.
  - [ ] `vault/views/graph-overview.md` front-matter `generated: true` `source: state/graph-state.json` `source_hash: <12hex>` matches `sha(state/graph-state.json).slice(0,12)` via `vault-export.mjs:85`; `vault/views/evidence-index.md` `source_hash` matches `sha(evidence-registry)` at `:63`; `evidence/EV-*.md` count 161.
  - [ ] Explicit staging: `git add vault/gotchas/journal-deletions-and-tz.md vault/gotchas/opencode-api-key-invocation.md vault/journal/YYYY-MM-DD-*.md state/vault-notes.json vault/views/* .autoforge/discovery/tracker-index.md` (or `git status --porcelain` shows only those lanes); no `git add -A`.
  - [ ] No secret in diff: `rg -i "OPENCODE_API_KEY.*=[A-Za-z0-9]{20,}" vault/` → 0; only `security find-generic-password` command shape present.
- **Skills/tools/tests:** `surgical-patch` (narrowest writer), `codebase-design` (seam locality), `verify-and-stop` for determinism gate.
- **Agent role:** `autoforge-worker (determinism guard)` — **Reviewer:** `autoforge-reviewer` + `autoforge-validator` (must see `vault-sync --check` log + `git diff` null + `jq` status proof before approve). One approval blocks merge if determinism fails.
- **Ponytail:** Reuse `vault-sync.mjs` worktree+symlink ceiling. Skipped: incremental view patch (keep `rmSync` wholesale at `vault-export.mjs:46` O(n) n=161), tracker-index compiler fn (keep hand-edited while n=2; deepen via `compileTrackerIndex()` only when frontier >10 per arch §8). `ponytail: wholesale regen O(n) ceiling until n>1k measurable; best-effort worktree cleanup ceiling at vault-sync.mjs:45-52`.

---

## 5. Execution work order (DAG + resource serialization + waves)

**DAG (blocked_by edges — semantic ordering, not just hazard locks):**

```
VG-01 ──┐
        ├──► VG-SYNC
VG-02 ──┘
```

- `VG-01 → VG-SYNC` — prose must exist in HEAD before compiled state can reflect `settled` (determinism seam at `vault-sync.mjs:17` worktree from HEAD).
- `VG-02 → VG-SYNC` — same.
- No edge `VG-01 → VG-02` nor `VG-02 → VG-01` (disjoint touches, parallel safe).
- No other DAG edges. All other overlaps are **resource hazards** serialized by `vault-state-single-writer`, not semantic DAG. `blocked_by:[]` for VG-01/VG-02 means hazard-only per `grilling.md:14-15` + prior plan `393-395` pattern.

**Resource locks (single-writer guards):**

| Lock | Members in this plan | Policy | Touches that force serialization |
|---|---|---|---|
| `vault-state-single-writer` | `VG-SYNC` (only writer in this lane) — but if VG-01/VG-02 were to write state directly (rejected), they'd be members; kept solo to make guard explicit | sequential; `vault-sync --check` before handoff; `vault-sync` is correctness not concurrency | `state/vault-notes.json`, `vault/views/**`, `vault/gotchas/**` settlement, `.autoforge/discovery/tracker-index.md` co-commit |
| `evidence-registry-single-writer` | none in this lane (read-only at `vault-import.mjs:30-39`) | N/A | `state/evidence-registry.json` |
| `graph-state-single-writer` | none (read-only via `state/graph-state.json` → `graph-overview.md`) | subsumed by `vault-state-single-writer` | `state/graph-state.json` → `vault/views/graph-overview.md` |

**Waves (= parallel groups):**

| Wave | Members | Parallel? | Guard / rationale |
|---|---|---|---|
| **P — prose parallel** | `VG-01`, `VG-02` | **parallel safe** — may be dispatched same turn as two `Task autoforge-worker` calls | disjoint `touches` (`vault/gotchas/journal-deletions-and-tz.md` vs `vault/gotchas/opencode-api-key-invocation.md` plus distinct `vault/journal/*.md` filenames); no `state/**` write; intersecting `vault/journal/**` directory only, file-level disjoint so no lock |
| **S — state serial** | `VG-SYNC` | **sequential** — alone; cannot parallel with P if P not yet committed to HEAD, but can follow in next turn after P commits land | holds `vault-state-single-writer`; touches `state/vault-notes.json` + `vault/views/**` + `.autoforge/discovery/tracker-index.md` which no other writer touches |

**Parallelization guard flags:**
- `VG-01` + `VG-02` parallel **allowed** (disjoint `touches`, no shared lock). Scheduler may batch as one turn.
- `VG-SYNC` **blocked** until both P members are committed to HEAD (worktree reads HEAD at `vault-sync.mjs:17`). `VG-SYNC` **never** parallel with any other `state/**` or `vault/views/**` writer (none other here, but would hold if exists).
- `vault-state` writers cannot parallel with any `state/**` hazard — enforced by `vault-state-single-writer`. Staging: explicit `git add <paths>` per `AGENTS.md:21-23`; no blanket add that would pull foreign `vault/journal/**` lanes.

**Recommended schedule:**
1. Baseline: `node scripts/vault-sync.mjs --check` (if fail, `node scripts/vault-sync.mjs && git add state/vault-notes.json vault/views && git commit` before plan).
2. Turn P: dispatch `VG-01` + `VG-02` in parallel (two workers, disjoint files). Each writes one gotcha edit + one journal file.
3. Commit P: `git add vault/gotchas/*.md vault/journal/YYYY-MM-DD-*.md && git commit -m "vault: settle two gotchas (prose)"` (explicit paths, no `-A`).
4. Turn S: dispatch `VG-SYNC` single worker: `node scripts/vault-sync.mjs` → `git diff --exit-code -- vault/views state/vault-notes.json` (should show changes) → `git add state/vault-notes.json vault/views .autoforge/discovery/tracker-index.md` → verify `jq` settled + tracker drift 0 → commit.
5. Proof: `node scripts/vault-sync.mjs --check` + `git diff --exit-code -- vault/views state/vault-notes.json` green + `npm run typecheck`/`lint` green.

**Global proof before handoff (must be in every module's DoD):** `node scripts/vault-sync.mjs --check` pass + `git diff --exit-code -- vault/views state/vault-notes.json` pass + `jq` open-set empty + tracker alignment.

---

## 6. Skills & agent roles per module

| Skill | When in this plan |
|---|---|
| **lean-build** | every module — reuse `frontmatter.mjs`/`paths.mjs`/`yaml`, stdlib, smallest diff, no new deps |
| **codebase-design** | seam awareness — VG-01/VG-02 keep prose→registry seam small (front-matter contract), VG-SYNC keeps import/export/sync seams deep (large behaviour, small CLI/file interface) |
| **domain-modeling** | glossary for `gotcha` `journal` `status:open|settled` `vault-state-single-writer` |
| **wayfinder** | **not needed** at n=2 (tracker-index stays hand-edited shallow per arch §8 `Speculative`); invoke only if frontier grows >10 and `compileTrackerIndex()` deepening requested |
| **tdd / verify-and-stop** | VG-SYNC determinism gate (`vault-sync --check` + `git diff` + `jq`) |
| **surgical-patch** | VG-SYNC narrowest writer (only refresh needed) |

**Agent roles:**
- `VG-01`, `VG-02` → `autoforge-worker (surgical — prose)` — reviewer checks charter front-matter + no secret + append-only.
- `VG-SYNC` → `autoforge-worker (determinism guard)` — reviewer `autoforge-reviewer` + `autoforge-validator` (validator must see determinism log + byte-identity proof). One validator approval required.

**Task grouping for `05_execute`:** Parallel group `[VG-01, VG-02]` may be dispatched same turn as separate `Task autoforge-worker` calls (disjoint `touches`). Sequential group `[VG-01, VG-02] → [VG-SYNC]` (VG-SYNC blocked_by both). `vault-state` writers (VG-SYNC only) cannot parallel with any `state/**` hazard — no other writer in this lane, so wave S is inherently serial.

---

## 7. Verification — no new infra, testability via vault-sync + git diff

- **Per-module dry check (VG-01/VG-02):** `node --input-type=module -e "import{parseFrontMatter,validateNoteFrontMatter} from './scripts/lib/frontmatter.mjs'; import{readFileSync} from 'fs'; const t=readFileSync('vault/gotchas/journal-deletions-and-tz.md','utf8'); const {fields}=parseFrontMatter(t,'vault/gotchas/journal-deletions-and-tz.md'); validateNoteFrontMatter('vault/gotchas/journal-deletions-and-tz.md',fields,'gotcha'); console.log(fields.status)"` → `settled`; same for opencode file. No throw.
- **VG-SYNC determinism gate:** `node scripts/vault-sync.mjs --check` → `[vault-sync] committed vault state matches HEAD compilation` at `:38` when clean. `node scripts/vault-sync.mjs` → `[vault-sync] state/vault-notes.json refreshed from HEAD compilation` at `:42` and `git diff --exit-code -- vault/views state/vault-notes.json` reflects intended changes then green after commit.
- **Bloom second-order:** `jq '.notes[] | select(.status=="open") | .path' state/vault-notes.json` → empty after both settled; `tracker-index.md` line count 0 matches. `sha` checks: `node -e "import{createHash} from 'crypto'; import{readFileSync} from 'fs'; const j=JSON.parse(readFileSync('state/graph-state.json')); console.log(createHash('sha256').update(JSON.stringify(j)).digest('hex').slice(0,12))"` equals `source_hash` in `vault/views/graph-overview.md`.
- **No harness:** `npm run typecheck` + `lint` + `build` stay green (no code path changed). Frontier is vault-only, so no `vitest` suite needed beyond determinism gates; if charter demands one test, add single `assert` self-check: `node -e "import fs from 'fs'; const s=JSON.parse(fs.readFileSync('state/vault-notes.json')); console.assert(s.notes.every(n=>['journal','gotcha','decision','research-note'].includes(n.type)))"`.

---

## 8. Risks & mitigations (carried from grilling Q1–Q10 + arch §7)

| Risk | Where it bites | Mitigation in this plan | Ponytail ceiling |
|---|---|---|---|
| **Parallel journal poison** — foreign uncommitted `vault/journal/**` leaks into committed `state/vault-notes.json` | `AGENTS.md:7-10` `vault-sync.mjs:2-6` `ci.yml:50` | Enforce `vault-sync.mjs` path only (`:16-44`); CI `--check` at `:27-37`; `AGENTS.md:15-17` + `git diff` fails loud | `worktree+symlink ceiling; per-journal lock deferred` |
| **Journal deletion bypasses append-only** — `rm` still possible, FS not immutable | `gotcha:journal-deletions-and-tz.md:11-21` `CHARTER.md:64` | Recovery runbook `stat`+`shasum` vs `git show HEAD:<path>` then `git restore`; `watch-vault-journal.sh` deterrent at `:40-44` logged outside repo | `shell-deterrent+restore ceiling; FS immutable flag deferred` |
| **TZ confusion** — UTC vs PDT burns forensics | `journal-deletions-and-tz.md:33-36` | Convert first: `date -u`, `TZ=... date` at `:35-36`; VG-SYNC logs UTC | doc fix only |
| **Evidence_ids unresolvable** — typo in `links.evidence_ids` | `vault-import.mjs:52-54` throws | Fail-fast at `:53-54`; pre-check `state/evidence-registry.json` exists at `:35`; pin frozen thresholds | `loud-fail ceiling; pre-commit hook deferred` |
| **Hand-edit of views lost** — human edits `vault/views/**` discarded | `CHARTER.md:68-71` `vault-export.mjs:46` `rmSync` | Charter rule + CI `git diff` at `ci.yml:50`; front-matter `generated:true` warns | intentional discard |
| **Tracker-index drift** — open-set in `state/vault-notes.json` ≠ `tracker-index.md` | `state/vault-notes.json:7-35` vs `tracker-index.md:1-2` `grilling:Q4-Q5` | VG-SYNC co-commits `state/vault-notes.json` + `tracker-index.md` atomically; drift check `jq … select(.status=="open")` vs `rg` | `co-commit ceiling; compileTrackerIndex() deferred until n>10` |
| **Staging poison** — `git add -A` commits foreign lanes | `AGENTS.md:21-23` | Explicit `git add <paths>` only in VG-SYNC acceptance | `doc ceiling; pre-commit porcelain hook deferred` |
| **Orphan worktree/tmp** — crash leaves `vault-head-*` | `vault-sync.mjs:14,45-52` | `finally` best-effort `worktree remove --force` + `rmSync(tmp)`; WARN on catch (follow-on) | `best-effort ceiling; tmp reaper cron deferred` |
| **Key paste secret leak** — OPENCODE_API_KEY in prose | `gotcha:opencode-api-key-invocation.md:13-22` | VG-02 body contains only `security find-generic-password` retrieval command, never key value; validator `rg` for 60+ char key | `retrieve-only ceiling` |

---

## 9. Interfaces & seam traceability (reference)

```
vault/  ──front-matter contract──▶  state/*.json  ──sha12+sorted emit──▶  vault/views/*
(prose)    scripts/lib/frontmatter.mjs:78-123       scripts/vault-*.mjs       (generated)
human-     validateNoteFrontMatter                 vault-import: md→json     emitFrontMatter
 curated   + normalizeLinks                        vault-export: json→md     generated:true
           parseFrontMatter:YAML guard             vault-sync: HEAD worktree source_hash:sha12
```

Least-privilege: human owns `vault/decisions|research-notes|gotchas` bodies (`CHARTER.md:66-67`); agent may `append journal` only (`:18,64`); machines own `vault/views/**` + `state/*.json` via compiles (`:19-20`). Wayfinder markdown canonical `TRACKER.md` not used here (n=2); `tickets.ts` seam deferred.

---

*Evidence anchoring for this plan:* `state/vault-notes.json:4` `note_count:25` baseline; `tracker-index.md:1-2` 2 open; `vault-sync.mjs:17,31,42` determinism seam; `frontmatter.mjs:6-7,99-106` status contract; `ci.yml:50` `git diff` gate; `CHARTER.md:18-20,64-71` zone boundary. Next anchor after execution: `state/vault-notes.json` both `status:"settled"` + `note_count:27` (or +journals) + `vault-sync --check` pass + `cmp` `vault/views` byte-identical.

