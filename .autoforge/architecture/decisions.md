# Architecture Decisions — Obsidian Vault Memory Update

Date: 2026-09-02
Source: `vault/CHARTER.md:1-85`, `.autoforge/discovery/report.md:1-14`, `.autoforge/discovery/tracker-index.md:1-2` (2 open gotchas), `.autoforge/requirements/grilling.md` Q1–Q10/R1–R6, `scripts/vault-sync.mjs:1-52`, `scripts/vault-import.mjs:1-92`, `scripts/vault-export.mjs:1-118`, `scripts/lib/frontmatter.mjs:1-133`, `state/vault-notes.json:1-382`, `.github/workflows/ci.yml:35-50`, `AGENTS.md:5-23`
Ponytail: reuse `yaml` + `scripts/lib/frontmatter.mjs` + `scripts/lib/paths.mjs` seams, stdlib only, no new deps, no generic facades.

## AD-01 — Three zones as architecture boundary (charter-locked)

**Decision:** Keep charter zones as hard boundaries [vault/CHARTER.md:16-20]:
- Prose `vault/journal|decisions|research-notes|gotchas` — human-curated, Markdown+YAML, `owner: human|agent` at `CHARTER.md:47-48`.
- Views `vault/views` — machine-owned, `generated:true` + `source_hash` at `CHARTER.md:60`, `vault-export.mjs:24,60,82,100`.
- Registries `state/*.json` — machine-canonical JSON (`schema_version:1.0.0`, `compiled_at_commit_only:true` at `state/vault-notes.json:2-3`), written only through compiles.

**Interface distinction:** charter fixes *where things live and who owns them* (`CHARTER.md:79-80`), not how agents read/write per session (MUST-READ wired elsewhere). One-way `registry→view` and back via front-matter validated by V2 determinism job (`CHARTER.md:69-70`).

**Rejected:** collapsing vault into `state/` (loses Obsidian graph), or making `vault/` canonical over `state/` (inverts `state/` wins at `CHARTER.md:70-71`).

## AD-02 — Vault determinism via HEAD worktree (never bare compile)

**Decision:** `scripts/vault-sync.mjs:16-44` is the ONLY path to refresh `state/vault-notes.json` before commit. Bare `node scripts/vault-import.mjs` / `vault-export.mjs` forbidden before committing [AGENTS.md:15-18].

- Mechanism: `git worktree add --detach ${tmp} HEAD` at `vault-sync.mjs:17`, symlink `node_modules` at `:19`, `execSync("node scripts/vault-import.mjs",opts)` + `vault-export.mjs` at `:21-22` in tmp, then byte-compare `git show HEAD:state/vault-notes.json` vs `compiled` via `Buffer.equals` at `:28-31` (`--check` at `:27-37`) or `fs.writeFileSync(live, compiled)` at `:42`.
- CI is `vault compile determinism (V2)` at `.github/workflows/ci.yml:35-50`: bare `vault-export+import` then `git diff --exit-code -- vault/views state/vault-notes.json` at `:50`.

**Rejected:** bare compile (poisons commit with foreign uncommitted journals → CI fail), `git stash --keep-index` (loses untracked, deprecated at `AGENTS.md:19`), KV-backed vault state (second truth, charter violation).

**Boundary:** `vault-sync.mjs` owns worktree lifecycle + `finally` cleanup at `:45-52`; `vault-import.mjs` owns zone routing/validation; `vault-export.mjs` owns wholesale re-emit + hashing. No writer touches `state/vault-notes.json` or `vault/views/**` concurrently — `vault-state-single-writer` serialize.

`ponytail: worktree + symlink ceiling; per-journal lock deferred.`

## AD-03 — Journal append-only, per-session files

**Decision:** Journals append-only, one file per session `vault/journal/YYYY-MM-DD-slug.md` [vault/CHARTER.md:27-28,64-66], `status: null` in compiled state (`state/vault-notes.json:42`), corrections as new entries referencing old. Agents may `append journal entries` only [CHARTER.md:18]; curated edits via proposal, never silent overwrite.

- Conflict rule: concurrent sessions target different files by construction (`CHARTER.md:72-73`); curated-note conflicts human wins, agents re-propose at `:73-74`.
- Recovery: on unexpected ` D` in `git status --porcelain`, verify `stat`+`shasum` vs `git show HEAD:<path>`, then `git restore <path>` — never rewrite from memory [vault/gotchas/journal-deletions-and-tz.md:19-21].
- Deterrent: `scripts/watch-vault-journal.sh` via `brew install fswatch` → `~/Library/Logs/auditorai-journal-watch.log` with UTC timestamps [vault/gotchas/journal-deletions-and-tz.md:40-44].

**Rejected:** mutable journal with status field (breaks contract), single indexed `journal.md` append log (races, loses Obsidian per-file graph).

## AD-04 — Gotchas lifecycle: status field + tracker-index mirror

**Decision:** Gotcha is human-owned prose [CHARTER.md:66] with front-matter `status: open|settled|superseded` (validated at `scripts/lib/frontmatter.mjs:99-106`, required `PROSE_TYPES` at `:6` + `STATUSES` at `:7`). Settlement is `status: open→settled` edit + one journal entry recording rationale, then `vault-sync.mjs` + co-commit of `state/vault-notes.json` + `.autoforge/discovery/tracker-index.md`.

- Current open set: `vault/gotchas/journal-deletions-and-tz.md` (`status:open` at `state/vault-notes.json:12`, `:5` in file) and `vault/gotchas/opencode-api-key-invocation.md` (`:26`, file `:5`) — mirrored in `.autoforge/discovery/tracker-index.md:1-2`.
- `tracker-index.md` is downstream of compiled open-set; must be updated atomically with settlement (`grilling.md:20-21` Q4–Q5, `:40` dependency).

**Rejected:** separate `state/gotchas-registry.json` (duplicate canonical), GitHub Issues only (loses hard-won lesson body in vault per `CHARTER.md:31`), status field on journals (violates `:47` journals omit status).

## AD-05 — Views are machine-owned wholesale regeneration

**Decision:** `scripts/vault-export.mjs:45-48` `rmSync(VIEWS,{recursive:true,force:true})` + `mkdirSync` then deterministic re-emit for all families. Hand edits discarded by design [vault/CHARTER.md:68, `vault-export.mjs:3-4`].

- Staleness: `source_hash: sha(stateJSON).slice(0,12)` at `vault-export.mjs:14-16` (`createHash sha256` + `slice(0,12)`), emitted for evidence-index (`:63`), per-record (`:54,27`), graph (`:85`), validation (`:103`) and surfaced in front-matter `generated:true` (`:24,60,82,100`).
- Determinism: sorted orders — evidence records by `evidence_id` at `:51`, jurisdictions sorted at `:67`, implementation nodes as-is + stable edge order; import side sorted by `path.localeCompare` at `vault-import.mjs:79`.
- CI enforcement: `git diff --exit-code -- vault/views state/vault-notes.json` at `ci.yml:50` — any hand-edit or missing regen fails.

**Rejected:** incremental patch (bespoke diff/GC for n=161), no views (breaks `[[EV-*.md]]` wikilinks at `vault-export.mjs:71-76` + `[[evidence-index]]` nav), mutable views with human edits.

`ponytail: wholesale O(n) n=161 ceiling; incremental deferred until n>1k.`

## AD-06 — Obsidian graph derived from registry, not vault-canonical

**Decision:** `vault/views/graph-overview.md:1-6` front-matter `generated:true, type:graph-overview, source:state/graph-state.json, source_hash:bcd420…` proves derivation from `state/graph-state.json:graphs.audit_graph` (nodes `AG-PROJECT`…`AG-PERSIST`, edges `CONTROL|DATA|…` at `state/graph-state.json:graphs`). Rendered at `vault-export.mjs:78-95`: header `Audit graph (§19)` + Nodes ` - **ID** — role \n  - impl: \`path\`` at `:88-90` + Edges `from → to (type): payload` at `:92-94`.

**Rejected:** vault-canonical graph (inverts `state/` wins at `CHARTER.md:70-71`, edits lost on export), plugin-generated live graph (non-deterministic, not CI-checked, new dep).

## AD-07 — Front-matter contract as seam

**Decision:** `scripts/lib/frontmatter.mjs:1-133` is the single seam for prose↔registry. External interface is small (`parseFrontMatter`, `validateNoteFrontMatter`, `normalizeLinks`, `emitFrontMatter`); large behaviour hidden (YAML `guardPlainScalars` at `:29-42` quoting `: `-containing scalars, `guardFlowItems` at `:44-58` quoting `issues: [#20]` `#`/leading-zero items, `STATUSES`/`PROSE_TYPES` enums, `DATE_RE` at `:4`, `links` array normalization at `:111-123`).

- Validation enforces: required `title|type|date|owner` at `:79-83`, type matches chartered zone at `:88-89`, `owner∈{human,agent}` at `:95-97`, `status` required for non-journal at `:99-106`, `links.*` arrays at `:113-119`.
- `emitFrontMatter` at `:125-133` is flat-scalar only — views stay small, no nested machine fields without charter amendment at `CHARTER.md:59`.

**Depth rationale:** leverages across all 25 notes + 161 evidence views; locality fixes quoting once (deletion test: removing it scatters YAML corner-cases across `vault-import` + `vault-export` + future writers).

## AD-08 — Module depth & seam placement (codebase-design lens)

- `scripts/lib/frontmatter.mjs` — deep module (small interface, large hidden `guard*` logic) — keep.
- `scripts/vault-import.mjs` — deep (behind `CHARTERED_ZONES` at `:14-19` + `listMarkdown` sorted at `:27` + `loadRegistryIds` at `:30-39` + `body_chars` accounting at `:65`). Internal seam: `fromRoot` at `scripts/lib/paths.mjs:6` (location to alter without editing call site).
- `scripts/vault-export.mjs` — deep (behind `sha` + `writeView` + `evidenceRecordNote` at `:22-43`); internal `byJurisdiction` bucket at `:56-57` is implementation detail, not interface.
- `scripts/vault-sync.mjs` — deep guard (behind `--check` flag at `:13` + worktree+symlink+compiled-vs-committed); large behaviour per unit of CLI surface.
- `tracker-index.md` — shallow today (raw lines). One adapter = hypothetical; do not deepen into `compileTrackerIndex()` until second consumer appears.
- `state/*.json` registries — adapters at seams; vault/prose is human adapter, `state/` JSON is machine truth adapter, `vault/views/` is Obsidian adapter — three adapters prove real seams (one adapter would be hypothetical).

**Principles applied:** acceptance of dependencies before seam (seam without reuse), interface is test surface (callers cross `parseFrontMatter`/`validateNoteFrontMatter`, tests do too), deletion test per candidate (report §8).

## AD-09 — Locks & touches (least-privilege)

| Lock | Members | Policy |
|---|---|---|
| `vault-state-single-writer` | any writer of `state/vault-notes.json`, `vault/views/**`, `vault/gotchas/**`, `vault/journal/**` settlement, `.autoforge/discovery/tracker-index.md` co-commit | sequential; `node scripts/vault-sync.mjs --check` before handoff; `vault-sync` is correctness, not concurrency control |
| `evidence-registry-single-writer` | `scripts/compile-evidence.mjs`, `state/evidence-registry.json` | `evidence_ids` resolution depends on this lock (`vault-import.mjs:30-39`) |
| `graph-state-single-writer` | `state/graph-state.json`, `vault/views/graph-overview.md` | graph edits serialize via state writer |

Hazard touches: any `state/**` writer must not run concurrently with another `vault-state` writer. Disjoint reads (Obsidian browsing `vault/views/**`) may run parallel with journal appends if files disjoint. Staging hygiene `git add <paths>` only, never `git add -A` at `AGENTS.md:21-23`.

## AD-10 — Risk register (delta highlights)

- Worktree/tmp orphan — `finally` at `vault-sync.mjs:45-52` best-effort; mask with `catch {}` — make failure `WARN`-searchable (follow-on).
- TZ drift re-burns forensics — gotcha `:33-36` `date -u` + `TZ=` conversion is mandatory in triage runbooks.
- Evidence_ids typo — fail-loud at `vault-import.mjs:53-54` keeps registry truth.
- Views hand-edit loss — intentional at `vault-export.mjs:46` `rmSync`; charter at `CHARTER.md:68` is the warning.
- Staging poison — `AGENTS.md:21` explicit add is the guard; potential CI `git status --porcelain` ephemeral lint.
- Tracker drift — `tracker-index.md` vs `state/vault-notes.json:7-35` open-set; mitigated by co-commit, potentially CI `check-tracker-index` future.

## ADR deltas

No new ADR required beyond `vault/CHARTER.md` v1.0-draft and existing `docs/adr/*` (e.g., `ADR-0005/DEC-0006` referenced in `vault/journal/2026-08-23-odd-formal-definition.md`). If owner requests formalization: short ADR for `HEAD worktree determinism` (this AD-02) and `gotcha settlement via status transition + journal + co-commit` (this AD-04). Defer until charter amendment path at `CHARTER.md:82-85` triggers.

---
Acceptance: boundaries vault/prose↔registries (AD-01/07), interfaces vault↔state↔views (closures in §5 of report), determinism tooling (AD-02/05, `vault-sync.mjs:16-44` vs bare), parallel journal risks (AD-03 + §7 table), HEAD-worktree vs bare tradeoffs (§3.1 matrix), ponytail ladder enforced (no new deps, `yaml` reuse), least-privilege cited (`CHARTER.md:17-20,64-74`, `frontmatter.mjs:95-106`).
