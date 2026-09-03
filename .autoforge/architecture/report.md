# Architecture Report — Obsidian Vault Memory Update

Date: 2026-09-02
Scope: `vault/CHARTER.md`, `vault/journal/**`, `vault/gotchas/**`, `vault/views/**`, `state/vault-notes.json`, `state/evidence-registry.json`, `state/graph-state.json`, `state/validation-state.json`, `scripts/vault-sync.mjs`, `scripts/vault-import.mjs`, `scripts/vault-export.mjs`, `scripts/lib/frontmatter.mjs`, `AGENTS.md`, `.github/workflows/ci.yml:35-50`, `.autoforge/discovery/report.md`, `.autoforge/discovery/tracker-index.md`, `.autoforge/requirements/grilling.md`
Status: design-only — no implementation. Ponytail ladder enforced, vault determinism as hard constraint. Model budget 80k tok (inherit orchestrator `opencode/muse-spark-1.2-contributor-free` 1M*0.30 capped).
Blocked-by: discovery + grilling. Inputs sized to fit: `tracker-index.md` (2 entries verbatim), `grilling.md` (Q1–Q10 + R1–R6), `CHARTER.md` (85 lines summarized), `vault-sync/import/export` + `state/vault-notes.json` read verbatim.
Skills invoked: `codebase-design` (module/interface/seam/depth vocabulary throughout), `improve-codebase-architecture` (selectively — deepening candidates §8).

## 1. Findings — boundaries as they exist

**Three zones, locked at charter** [vault/CHARTER.md:16-20]:

| Zone | Paths | Canonical form | Owner | Who writes |
|---|---|---|---|---|
| **Prose** | `vault/journal/`, `vault/decisions/`, `vault/research-notes/`, `vault/gotchas/` | Markdown + YAML front-matter | human-curated | agents: append journals; propose curated edits via PR-style; never overwrite |
| **Views** | `vault/views/` | Generated Markdown (`generated: true` + `source_hash`) | machines | `scripts/vault-export.mjs` wholesale; humans must never hand-edit |
| **Registries** | `state/*.json` (outside vault) | JSON `schema_version: "1.0.0"`, sorted keys, byte-identical | machines + validated compiles | only through `vault-import.mjs`/`vault-sync.mjs` with determinism checks |

**Front-matter contract** [vault/CHARTER.md:38-54][scripts/lib/frontmatter.mjs:78-109] — every prose file carries `title`, `type` (`journal|decision|research-note|gotcha` at `frontmatter.mjs:6`), `date: YYYY-MM-DD` (`DATE_RE` at `:4`), `owner: human|agent` (`:95`), `status: open|settled|superseded` required for non-journal (`:99-106`, journals omit/null), `links: {evidence_ids, issues, adr}` normalized at `:111-123` where `evidence_ids` MUST resolve in `state/evidence-registry.json` (validated at `vault-import.mjs:52-54`).

**Determinism invariant** [AGENTS.md:7-10][scripts/vault-sync.mjs:2-6][.github/workflows/ci.yml:35-50]:
- `state/vault-notes.json` is compiled from vault, checked byte-for-byte against committed tree. CI runs bare `vault-export.mjs` + `vault-import.mjs` then `git diff --exit-code -- vault/views state/vault-notes.json` (`ci.yml:48-50`).
- Parallel sessions hold uncommitted journal edits; compiling with those poisons the commit → fails `vault compile determinism (V2)` (`AGENTS.md:9-10`).
- `vault-sync.mjs:16-44` is the hardened path: detached HEAD worktree (`git worktree add --detach ${tmp} HEAD` at `:17`), symlink `node_modules` at `:19`, compile in tmp at `:21-22`, then either `--check` compare `git show HEAD:state/vault-notes.json` vs compiled (`:28-36`) or sync write `fs.writeFileSync(live, compiled)` (`:42`).

**Current memory gaps** [state/vault-notes.json:7-35][.autoforge/discovery/tracker-index.md:1-2]: 2 open gotchas — `vault/gotchas/journal-deletions-and-tz.md` (`status: "open"` at `:12`) and `vault/gotchas/opencode-api-key-invocation.md` (`:26`). Total `note_count: 25` at `state/vault-notes.json:4` (2 gotchas + 23 journals, journals `status: null` at e.g. `:42` per charter "journals omit status").

**Views regeneration** [scripts/vault-export.mjs:45-96][vault/views/graph-overview.md:1-9]: `rmSync(VIEWS,{recursive:true})` at `vault-export.mjs:46` then `mkdirSync` + `emitFrontMatter` with `generated: true` + `source_hash: sha(stateJSON).slice(0,12)` (`:14-15`). Three view families: `evidence-index.md` + `evidence/EV-*.md` from `state/evidence-registry.json` (`:50-76`), `graph-overview.md` from `state/graph-state.json` (`:78-95`, front-matter `generated:true, type:graph-overview, source:state/graph-state.json, source_hash:bcd420…` at `vault/views/graph-overview.md:1-5`), `validation-log.md` from `state/validation-state.json` (`:97-113`). Ordering deterministic: records sorted by `evidence_id` (`:51`), jurisdictions sorted (`:67`), `notes.sort(localeCompare)` in import at `vault-import.mjs:79`.

**Obsidian graph** [vault/views/graph-overview.md:7-56][state/graph-state.json:graphs.audit_graph]: audit pipeline graph surfaced as human-readable view; source is `state/graph-state.json` `graphs.audit_graph` (nodes `AG-PROJECT` … `AG-PERSIST`, edges `AG-PROJECT→…→AG-PERSIST`). Hash linkage `source_hash: sha(gs)` at `vault-export.mjs:85` ties view staleness to registry commit.

**Journal append-only** [vault/CHARTER.md:64-66][AGENTS.md:5-10]: journals one file per session `YYYY-MM-DD-slug.md` (`CHARTER.md:27`), append-only, corrections as new entries referencing old. No `status` field (null in compiled state). Concurrent human+agent edits target different files by construction; curated-note conflicts human wins, agents re-propose (`CHARTER.md:73-74`). Gotcha `journal-deletions-and-tz.md` documents violation mode: shell `rm` bypasses append-only, cost >5 min forensics (`vault/gotchas/journal-deletions-and-tz.md:11-21`), deterrent `scripts/watch-vault-journal.sh` via `fswatch`.

## 2. Seam inventory — reuse before inventing (ponytail rung 2)

| Seam | File:line | Interface | Depth notes |
|---|---|---|---|
| **Front-matter parser** | `scripts/lib/frontmatter.mjs:3-133` | `parseFrontMatter(text,file) → {fields,bodyStart}`, `validateNoteFrontMatter(file,fields,expectedType)`, `normalizeLinks`, `emitFrontMatter(entries)` | Deep module: small interface (3 fns) hides YAML guard (`guardPlainScalars` at `:29-42`, `guardFlowItems` at `:44-58`), date/type/status validation, evidence_id normalization. Leverage: every prose→JSON path routes through it. Locality: fix quoting/bracket handling once. |
| **Vault import seam** | `scripts/vault-import.mjs:14-90` | `CHARTERED_ZONES: [zone,expectedType]` at `:14-19` → `listMarkdown` sorted at `:21-28` → `loadRegistryIds` at `:30-39` → `notes.sort` at `:79` → `state/vault-notes.json` `{schema_version, compiled_at_commit_only, note_count, notes}` at `:80-85` | Deep: large behaviour (zone routing, validation, body_chars accounting) behind single output file interface. Deletion test: removing it scatters validation across callers. |
| **Vault export seam** | `scripts/vault-export.mjs:14-116` | `sha(json)→12hex` at `:14-16` + `writeView` at `:18-20` → `vault/views/*.md` with `emitFrontMatter` | Deep: 3 registry families behind one `main()`. Locality: hash/ordering/rmSync policy in one place. |
| **Vault sync determinism seam** | `scripts/vault-sync.mjs:14-52` | `--check` vs sync mode (`check` flag at `:13`), uses HEAD worktree + symlink + compile-in-tmp | Module's interface is CLI flag + console exit code. Depth: hides worktree lifecycle, symlink, compiled-vs-committed byte compare (`committed.equals(compiled)` at `:31`). |
| **Evidence registry seam** | `state/evidence-registry.json` + `scripts/compile-evidence.mjs` | 161 records (INT 26, UK 25, US 35, CA 39, AE 36), `evidence_id` PK, `evidence_records[].evidence_id` validated by import | Canonical for `evidence_ids` resolution. |
| **Graph state seam** | `state/graph-state.json` | `graphs.audit_graph.{nodes,edges}` | Only producer of `graph-overview.md`. |
| **Tracker-index seam** | `.autoforge/discovery/tracker-index.md` | 2 lines mirroring open notes | Shallow today (no parse/classify) — candidate to deepen if frontier grows (see §8). |

No new dependencies needed. `yaml` already installed for front-matter (`frontmatter.mjs:1` `parseYaml`).

## 3. Alternatives — design-it-twice per concern

### 3.1 Vault sync determinism (core tradeoff)

**Problem:** parallel sessions with uncommitted `vault/journal/**` poison `state/vault-notes.json` if compiled bare, failing CI `git diff --exit-code` at `ci.yml:50`.

- **A) HEAD worktree compile — CHOSEN (current `vault-sync.mjs:16-44`)**
  - `git worktree add --detach ${tmp} HEAD` isolates committed tree; symlink `node_modules`; `node scripts/vault-import.mjs && vault-export.mjs` in tmp; byte-compare or `fs.writeFileSync(live, compiled)`.
  - Pros: immune to foreign uncommitted edits by construction; CI `--check` (`:27-36`) is repo-truth; no stash side-effects; stdlib only (`child_process`, `fs`, `os`, `path`).
  - Cons: tmp dir + worktree add/remove cost (~100ms + node_modules symlink); leaves orphan `vault-head-*` on crash if `finally` at `:45-52` skipped (best-effort `rmSync`).
  - Ponytail rung: 3 (stdlib) + 5 (reuse installed `yaml`/`node_modules`). No new dep.

- **B) Bare compile (`node scripts/vault-import.mjs` directly in working tree)**
  - Pros: one command, no tmp.
  - Cons: includes uncommitted foreign journals → committed `vault-notes.json` diverges from HEAD → CI failure deterministic; silent poison. Violates `AGENTS.md:15-18` rule.
  - Rejected: fails correctness invariant; not least-privilege (reads more than committed truth).

- **C) Stash-then-compile (`git stash push --keep-index && vault-import && git stash pop`)**
  - Pros: no worktree.
  - Cons: loses untracked journals (`--include-untracked` needed, still races); stash pop conflicts with concurrent edits; slower; `stash` workaround explicitly deprecated at `AGENTS.md:19` ("If you stash…stop — vault-sync replaces that").
  - Rejected: fragile, non-atomic, deprecated.

- **D) KV/DB-backed vault state (store notes in Upstash/Vercel KV)**
  - Pros: cross-instance visibility.
  - Cons: second source of truth, splits `vault/` vs `state/` canonicality, violates charter `state/` JSON-canonical (`CHARTER.md:20`), adds network dep for local determinism check.
  - Rejected: speculative, violates YAGNI (one-file `vault-notes.json` is sufficient).

**Tradeoff matrix — determinism tooling:**

| Criterion | A HEAD worktree | B Bare | C Stash |
|---|---|---|---|
| Correctness vs poison | ✅ HEAD only | ❌ includes dirty | ⚠️ loses untracked |
| CI `git diff` green | ✅ | ❌ | ⚠️ flaky |
| Stdlib only | ✅ | ✅ | ✅ (git) |
| Atomic / no side-effect | ✅ tmp isolated | ✅ but wrong | ❌ mutates index |
| Ponytail pick | **chosen** | rejected | deprecated |

### 3.2 Journal append-only vs mutable history

- **A) File-per-session append-only + corrective entry — CHOSEN** [vault/CHARTER.md:64-66][vault/CHARTER.md:27]
  - One file per session `vault/journal/2026-08-23-ticket-21-verify-close.md` style, `status: null`, never edit yesterday's file; corrections as new dated entry referencing old; `vault/gotchas/journal-deletions-and-tz.md:17-21` documents recovery (`stat` + `shasum` vs `git show HEAD:<path>`, then `git restore`).
  - Pros: git history is truth; `vault-import` deterministic (`readdirSync` sorted at `vault-import.mjs:27`); Obsidian conflict-free (different files per session at `CHARTER.md:72-73`).
  - Ponytail: zero code, convention depth.

- **B) Mutable journal (edit in place, add `status` field)**
  - Cons: breaks `status:null` contract (`state/vault-notes.json:42`), loses audit trail, creates merge conflicts, violates charter.
  - Rejected.

- **C) Indexed append log (single `journal.md` with seq: lines, KV-style index)**
  - Pros: single file, easy tail.
  - Cons: concurrent append races (same `ledger.ts` race that R2 hardened elsewhere), needs lock; Obsidian graph per-file navigation lost.
  - Rejected: shallower than file-per-session (more coordination for less leverage).

### 3.3 Gotchas lifecycle

- **A) Status field `open|settled|superseded` + owner + tracker-index mirror — CHOSEN** [vault/CHARTER.md:38-54][frontmatter.mjs:7][state/vault-notes.json:12,26]
  - Gotcha file front-matter `status: open` (e.g., `vault/gotchas/journal-deletions-and-tz.md:5`), `owner: agent` at `:6`; compiled `notes[].status`; `tracker-index.md:1-2` lists open items verbatim; settlement is front-matter edit `open→settled` (+ new journal entry recording decision).
  - Pros: deterministic (`validateNoteFrontMatter` at `frontmatter.mjs:99-106`), Obsidian-readable, `vault-notes.json` single source for gap queries.
  - Cons: tracker-index drifts if manual edit forgotten (same drift noted in grilling Q4–Q5 at `.autoforge/requirements/grilling.md:20-21`).

- **B) Separate `state/gotchas-registry.json` (duplicate registry)**
  - Cons: second canonical, must keep in sync with `vault/gotchas/*.md` → violates charter single prose-canonical for gotchas (`CHARTER.md:66`, human-owned).
  - Rejected: speculative abstraction, one interface with one implementation.

- **C) GitHub Issues only**
  - Cons: offline Obsidian lost; issue ↔ vault link still needed (`links.issues` at `frontmatter.mjs:111`), but gotcha body (hard-won lesson) belongs in vault prose per charter skeleton `CHARTER.md:31`.
  - Rejected.

### 3.4 Views regeneration

- **A) Wholesale `rmSync` + deterministic re-emit — CHOSEN** [scripts/vault-export.mjs:45-48][vault/views/graph-overview.md:1-6]
  - `rmSync(VIEWS,{recursive:true})` then `mkdirSync` + sorted emit; `source_hash: sha(registry).slice(0,12)` ties staleness; `generated:true` marks machine-owned (`CHARTER.md:60-61`).
  - Pros: no stale files (evidence records removed → note removed, `VIEWS/evidence/EV-*.md` at `:72-76`), byte-identical (`JSON.stringify` + sorted keys via `createHash` at `:15`).
  - Cons: re-writes all evidence notes (161 files) on any evidence change — ~tens of ms, acceptable; ponytail ceiling: `ponytail: wholesale regen O(n) n=161, incremental deferred until n>1k measurable`.

- **B) Incremental patch (diff registries, write only changed views)**
  - Pros: less I/O.
  - Cons: needs diff logic, stale-file GC, hash cache; complexity for unmeasured gain.
  - Rejected: YAGNI, violates pony ladder rung 6 (one-liner `rmSync` beats bespoke patch).

- **C) No views (read `state/*.json` directly in Obsidian via dataview)**
  - Cons: breaks Obsidian `[[EV-*.md]]` wikilinks (`vault/views/evidence/*.md` at `vault-export.mjs:74-76`), `[[evidence-index]]` navigation, `graph-overview.md` pipeline reference; charter mandates `vault/views/` as generated zone (`CHARTER.md:19,32`).
  - Rejected.

### 3.5 Obsidian graph surface

- **A) `state/graph-state.json` → `vault/views/graph-overview.md` generated view — CHOSEN** [scripts/vault-export.mjs:78-95][vault/views/graph-overview.md:7-56]
  - `gs.graphs.audit_graph.nodes/edges` rendered as bullet lists + `impl:` backticks; `source_hash: sha(gs)` at `:85` detects drift.
  - Pros: deterministic, versioned in git, testable (`git diff` check); complements but never replaces audit pipeline graph canonical in `state/`.

- **B) Vault-canonical graph (edit `graph-overview.md` by hand, compile to `state/graph-state.json`)**
  - Cons: inverts charter `state/` wins when both exist (`CHARTER.md:70-71`); hand edits lost on export by design.
  - Rejected.

- **C) Obsidian plugin auto-generates graph (dataviewjs/graph plugin)**
  - Pros: live.
  - Cons: outside repo, non-deterministic, not CI-checked, requires plugin dep.
  - Rejected: new dep violates ladder.

## 4. Recommendation — smallest correct change

**Keep three seams, enforce via `vault-sync` path, settle gotchas via status transition, keep wholesale views:**

1. **Determinism** — keep `scripts/vault-sync.mjs:16-44` as ONLY writer of `state/vault-notes.json` before commit; forbid bare `vault-import/export` in `AGENTS.md:15-18`. CI stays `vault determinism (V2)` at `ci.yml:35-50`. `ponytail: worktree is ceiling; per-journal locking deferred until parallel-write measurable`.
2. **Journal discipline** — file-per-session append-only (`CHARTER.md:64`); recovery runbook is `git status --porcelain` for ` D`, `shasum` vs `git show HEAD:<path>`, `git restore <path>` (`vault/gotchas/journal-deletions-and-tz.md:19`), plus `scripts/watch-vault-journal.sh` deterrent (`:40-44`). No code change.
3. **Gotcha settlement** — for the 2 open gotchas, transition is front-matter `status: open → settled` (validated at `frontmatter.mjs:104-105`) + one journal entry referencing the gotcha (append-only), then `node scripts/vault-sync.mjs` + commit `state/vault-notes.json` + `vault/views/*` in one commit with explicit `git add` per `AGENTS.md:21-23`. `tracker-index.md:1-2` updated to empty or remaining open set (see §5 dependencies).
4. **Views** — keep `vault-export.mjs:46` `rmSync` + sorted emit; no incremental logic. `source_hash` already links staleness.
5. **Graph** — keep `graph-state.json`→`graph-overview.md` pipeline; do not hand-edit views (`CHARTER.md:68`).

No new dependencies, no new modules. The lazy version covers it; if settlement needs formal ADR, add `docs/adr/NNNN-vault-gotcha-settlement.md` only when owner requests.

## 5. Interfaces — `vault/` ↔ `state/*.json` ↔ `vault/views/*`

```
vault/  ──front-matter contract──▶  state/*.json  ──sha12+sorted emit──▶  vault/views/*
(prose)    scripts/lib/frontmatter.mjs:78-123       scripts/vault-*.mjs       (generated)
human-     validateNoteFrontMatter                 vault-import: md→json     emitFrontMatter
 curated   + normalizeLinks                        vault-export: json→md     generated:true
           parseFrontMatter:YAML guard             vault-sync: HEAD worktree source_hash:sha12
```

**Interface vault/prose → registries (import direction)** [scripts/vault-import.mjs:14-90]:
- Input: `vault/{journal,decisions,research-notes,gotchas}/*.md` filtered by `listMarkdown` at `:21-28` (sorted, `*.md` only).
- Contract: `parseFrontMatter` (`:49`, `frontmatter.mjs:15-27` via `splitFrontMatter` `:9-13` + `guardPlainScalars` `:29-42`) → `validateNoteFrontMatter` (`:50`, `frontmatter.mjs:78-109`) → `normalizeLinks` (`:51`, `frontmatter.mjs:111-123`) → `registryIds.has` check (`:52-54`).
- Output: `state/vault-notes.json` `{schema_version:"1.0.0", compiled_at_commit_only:true, note_count, notes:[{path,zone,title,type,date,status,owner,links:{evidence_ids,issues,adr},body_chars}]}` at `:80-85`.
- Ordering: `CHARTERED_ZONES` at `:14-19` + `notes.sort(localeCompare)` at `:79` → byte-identical (`:87-88` `JSON.stringify(out,null,2)+"\n"`).
- Error mode: `errors[]` collected at `:44-69`, then `process.exit(1)` at `:76` with `malformed chartered front-matter` + fail-loud unknown `evidence_ids` (`:53-54`).

**Interface registries → vault/views (export direction)** [scripts/vault-export.mjs:14-116]:
- Inputs: `state/evidence-registry.json` (`:50`, 161 records), `state/graph-state.json` (`:79`), `state/validation-state.json` (`:98`).
- Contract: `emitFrontMatter(entries)` at `frontmatter.mjs:125-133` produces `---\nkey: value\n---\n`; `sha(json)→slice(0,12)` at `vault-export.mjs:14-16` gives `source_hash`; deterministic sorts (`:51,67` for evidence, `:79-88` for graph).
- Output: `vault/views/evidence-index.md` + `evidence/EV-*.md` (`:71-76`), `graph-overview.md` (`:81-95`), `validation-log.md` (`:99-113`), all with `generated:true` (`:24,60,82,100`) + `source` + `source_hash`.
- Invariant: machine-owned, `rmSync` wholesale (`:46`) → hand edits discarded by design (`CHARTER.md:68`, `AGENTS.md:11`).

**Interface determinism guard** [scripts/vault-sync.mjs:2-52][AGENTS.md:15-18]:
- `--check` mode: `git show HEAD:state/vault-notes.json` at `:28` vs `compiled` at `:24` via `Buffer.equals` at `:31`; on mismatch `exit 1` with `Fix: run node scripts/vault-sync.mjs` at `:35`.
- Sync mode: `fs.writeFileSync(live, compiled)` at `:42` → working tree carries HEAD-clean state regardless of foreign journal edits (`:40-41` comment).
- Worktree lifecycle at `:17-19` + `finally` at `:45-52` (`worktree remove --force` + `rmSync tmp`) — seam where alteration without editing occurs (head vs dirty).

**Least-privilege mapping:**
- Human: owns `vault/decisions|research-notes|gotchas` bodies (`CHARTER.md:66-67`), `vault/CHARTER.md` via amendment (`:82-85`); agents propose, owner applies.
- Agent: may `append journal entries` only (`CHARTER.md:18,64`); must never silently overwrite curated notes or hand-edit views.
- Machine: owns `vault/views/**` + `state/*.json` writes via compiles (`CHARTER.md:19-20`).

## 6. Dependencies & sequencing (blocked_by as text, not DAG)

```
discovery done (.autoforge/discovery/report.md:7-13  2 open gotchas)
   │
   ▼
grilling done (.autoforge/requirements/grilling.md Q1-Q10, R1-R6)
   │
   ▼
this architecture report (seams, alternatives, recommendation)
   │
   ├──► settlement PRs (per-gotcha: front-matter status + journal entry)
   │         │
   │         ▼
   │    node scripts/vault-sync.mjs  (or --check pre-push)
   │         │
   │         ▼
   │    state/vault-notes.json + vault/views/* byte-identical (ci.yml:48-50 git diff check)
   │
   └──► CI vault determinism (V2) gate at .github/workflows/ci.yml:35-50
```

- `vault-import` blocked by `state/evidence-registry.json` existence (fails at `:35-38` if missing) — requires `scripts/compile-evidence.mjs` first.
- `vault-export` blocked by all three `state/*.json` registries (evidence, graph, validation) — missing → hard fail at `readFileSync`.
- `vault-sync` blocked by both import+export success; `node_modules` symlink seam at `:18-19` assumes `npm ci` already ran.
- `tracker-index.md` is downstream of `state/vault-notes.json` open-set query (`state/vault-notes.json:7-35` → `.autoforge/discovery/tracker-index.md:1-2`); update together or lose gating.

**Touches / hazard (single-writer):**

| Concern | Touches | Hazard | Lock (serialize) |
|---|---|---|---|
| Determinism compile | `scripts/vault-sync.mjs`, `state/vault-notes.json`, `vault/views/*` | `state/**`, `vault/views/**` | `vault-state-single-writer` — no concurrent `vault-import/export/sync` |
| Journal append | `vault/journal/YYYY-MM-DD-*.md` | `vault/journal/**` | per-session file level; parallel sessions target different files by convention — no lock if naming holds |
| Gotcha settlement | `vault/gotchas/*.md`, `state/vault-notes.json`, `.autoforge/discovery/tracker-index.md`, `vault/journal/*` (new entry) | `state/**`, `vault/gotchas/**` | same `vault-state-single-writer` + explicit `git add <paths>` (`AGENTS.md:21`) |
| Views regen | `scripts/vault-export.mjs`, `vault/views/**` | `vault/views/**` | same writer — never run bare in parallel with sync |
| Evidence resolution | `vault/**/front-matter links.evidence_ids`, `state/evidence-registry.json` | `state/evidence-registry.json` | `evidence-registry` single-writer (compile-evidence) |

## 7. Risks, gotchas & mitigations

| Risk | Where it bites | Mitigation | Upgrade path (ponytail ceiling) |
|---|---|---|---|
| **Parallel journal poison** — uncommitted foreign `vault/journal/**` leaks into committed `state/vault-notes.json` | `AGENTS.md:7-10`, `vault-sync.mjs:2-6`, `ci.yml:50` | Enforce `vault-sync.mjs` path (`:16-44`) not bare compile; CI `--check` at `:27-37`; `AGENTS.md:15-17` rule + `git diff --exit-code` fails loud | `ponytail: worktree + symlink is ceiling; per-file journal lock deferred until Vercel lambda contention measurable` |
| **Journal deletion (append-only is convention not FS guarantee)** — `rm` bypasses charter, >5 min forensics | `vault/gotchas/journal-deletions-and-tz.md:11-21`, `CHARTER.md:64` | Recovery runbook at gotcha `:19-21`; `scripts/watch-vault-journal.sh:40-44` `fswatch` → `~/Library/Logs/auditorai-journal-watch.log`; `git restore <path>` not rewrite-from-memory | `ponytail: shell-deterrent + restore is ceiling; FS immutable flag / git hooks deferred` |
| **TZ confusion burning triage time** — GitHub UTC vs PDT UTC-7 | `vault/gotchas/journal-deletions-and-tz.md:33-36` | Convert first: `date -u`, `TZ=... date` (`:35-36`); log UTC in `watch-vault-journal.sh` | none — doc fix |
| **Evidence_ids unresolvable** — `evidence_ids` with typo/removed EV id | `vault-import.mjs:52-54` throws, `frontmatter.mjs:111-123` normalizes | Fail-fast at `:53-54` with actionable `evidence_ids do not resolve`; pre-check `state/evidence-registry.json` exists at `:35`; pin threshold `E5` frozen (`docs/validation/eval-gates.md`) | `ponytail: loud fail is ceiling; pre-commit hook deferred` |
| **Hand-edit of views lost** — human edits `vault/views/graph-overview.md` discarded on next export | `CHARTER.md:68-71`, `vault-export.mjs:46` `rmSync`, `vault/views/graph-overview.md:2-6` `generated:true` | Charter rule + `ci.yml:50` `git diff` enforces machines-only; Obsidian note at `vault/views/evidence-index.md: Compiled … do not edit` | none — intentional discard |
| **Orphan tmp/worktree leaves** — crash leaves `vault-head-*` tmp or detached worktree | `vault-sync.mjs:14,45-52` | `finally` best-effort `worktree remove --force` + `rmSync(tmp,{recursive:true,force:true})`; `node_modules` symlink only if `fs.existsSync(nm)` at `:19` | `ponytail: best-effort cleanup ceiling; tmp reaper cron deferred` |
| **Tracker-index drift** — open gotchas in `state/vault-notes.json` ≠ `.autoforge/discovery/tracker-index.md` | `state/vault-notes.json:7-35` vs `tracker-index.md:1-2`, `grilling.md:19,40` | Update together in same commit as settlement; CI could add `cmp` between compiled open-set and tracker-index (not yet) | `ponytail: co-commit is ceiling; tracker-index compilation from notes deferred until frontier >10` |
| **Staging poison** — `git add -A` commits foreign lane journals | `AGENTS.md:21-23` | Explicit `git add <paths>` only; no blanket add | `ponytail: doc is ceiling; pre-commit `git status --porcelain` hook deferred` |
| **View hash drift undetected locally** — stale `source_hash` in committed views | `vault-export.mjs:14-16,63,85,103` | `vault-sync.mjs:22` recompiles export in tmp too; CI `git diff -- vault/views` at `ci.yml:50` catches drift | none |
| **`node_modules` symlink seam missing** — `npm ci` not run in fresh clone | `vault-sync.mjs:18-19` | Guard `if(fs.existsSync(nm))` at `:19`; worktree compile still runs but may fail on missing `yaml` import — fail loud, ask `npm ci` | none |

## 8. Deepening opportunities (improve-codebase-architecture lens)

- **Shallow boundary — tracker-index** (`tracker-index.md:1-2` as raw lines vs `state/vault-notes.json` open-set). Today `tracker-index.md` is hand-maintained shallow mirror. If frontier grows past ~10, deepen into pure fn `compileTrackerIndex(state/vault-notes.json)→tracker-index.md` (two adapters: current 2-entry file, future CI-compiled file). Deletion test: removing the compile concentrates tracker drift bugs, passing.
  **Recommendation:** `Speculative` — keep hand-edited while n=2; deepen when `note_count` at `state/vault-notes.json:4` pushes frontier.

- **Locality leak — `guardPlainScalars` + `guardFlowItems`** (`frontmatter.mjs:29-58`). Quoting logic for `issues: [#20]` (`frontmatter.mjs:48-55` handling `#`/leading-zero) spreads knowledge between YAML parse and `validateNoteFrontMatter`. Already deep (hidden behind `parseFrontMatter`), but split across two helpers.
  **Recommendation:** `Worth exploring` only if front-matter errors recur — consolidate guard tests in one place.

- **Worktree cleanup as shallow `finally`** (`vault-sync.mjs:45-52`). `finally` swallows `worktree remove` errors (`catch {}` at `:48-50`) with no observable. Bugs hide in silent swallow.
  **Recommendation:** `Worth exploring` — emit `WARN` token on `catch` instead of silent `best effort`, for log-searchable failure.

- **`vault-export.mjs` family-local repetition** — three blocks (evidence/graph/validation) repeat `emitFrontMatter + sha + writeView` pattern at `:59-65,81-86,99-105` and `writeView` at `:18-20` is thin adapter.
  **Recommendation:** `Speculative` — repetition is 3× and domain-distinct (jurisdiction buckets vs nodes/edges vs validations); keep locality per-family until fourth family appears (`ponytail: triplicated emit is ceiling until fourth view family`).

- **`vault-import.mjs` zone routing** (`:14-19` `CHARTERED_ZONES`) — adding `vault/decisions/` etc already covered, `fromRoot` path helper in `scripts/lib/paths.mjs:6` is correct seam; depth is sufficient. No deepening needed.

Overall: current seams are deep where they need to be (front-matter parser, import, export, sync guard each hide large behaviour behind small CLI/file interface). Keep locality; defer abstractions until second concrete variation appears (one adapter = hypothetical).

## 9. Verification — no new infra

- `node scripts/vault-sync.mjs --check` → `committed vault state matches HEAD compilation` (`:38`) when clean.
- `node scripts/vault-sync.mjs` → `state/vault-notes.json refreshed from HEAD compilation` (`:42`) and `git diff --exit-code -- vault/views state/vault-notes.json` green.
- `npm run test` (`vitest`) + `npm run lint` + `npm run typecheck` + `npm run build` remain green — no harness added.
- For gotcha settlement: edit `vault/gotchas/<name>.md` `status:open→settled` → add `vault/journal/YYYY-MM-DD-<gotcha-settled>.md` → `node scripts/vault-sync.mjs` → `cat state/vault-notes.json | grep -A2 <gotcha>` shows `status: settled` + `note_count` unchanged or +1 journal, `tracker-index.md` trimmed accordingly → commit with explicit `git add vault/gotchas/... vault/journal/... state/vault-notes.json .autoforge/discovery/tracker-index.md` → push → CI `vault compile determinism (V2)` green.

---
No new dependencies. No generic facades. All prose↔registry↔views variation stays behind the three chartered seams. Smallest correct change per concern; wholesale regen + worktree guard are the pony ceilings.
