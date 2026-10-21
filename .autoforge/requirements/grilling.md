# Grilling — Ticket #40 "Harvest Track A: fetch the public Canadian RSA documents"

Evidence: ticket body + `.autoforge/discovery/*`. Parent `docs/RSA-Documents/HARVESTING_PLAN.md` is **absent** — §3/§5/§7 unrecoverable (`plan-recovery-a.md:3`).

## 1. REQUIREMENTS → acceptance-criteria map

- **R1** [Rules] Public/free/no-login only; no ATIP/FOIA, paywall, CAPTCHA; robots.txt honored. *Check:* zero requests to a robots-disallowed or auth-walled URL; `--selftest` green.
- **R2** [Rules] ≤1 req/s/host; ≥10s on CKAN hosts. *Check:* fake-clock test: gap ≥1000ms/host (`ratelimit.ts:4-5`), ≥10 000ms on CKAN hosts (`source-feasibility.md:26`).
- **R3** [Rules] Binaries + text stay **off-git**; only manifests ship in the PR. *Check:* `git status --porcelain` shows no binary path; corpus root git-ignored (`CLAUDE.md:14`; `rsa-corpus/MAP.md:15`).
- **R4** [AC2] Intake record per doc with the 9 protocol fields; *accepted* = sha256 + licence row + dedupe claim + cell assignment; tier ∈ {T0,T1,T3,T4}; T1 never counts as §3 coverage. *Check:* every row has non-empty `project_id,tier,split,stage,source_url,licence_verdict,lang`; no `T2` row.
- **R5** [AC2] Multi-doc projects share one `project_id`. *Check:* group-by `project_id` has ≥1 group of ≥2 rows when a multi-doc project was fetched; single-doc projects get their own id.
- **R6** [AC2] `canadian-download-log.tsv` (absent today) created; one row per doc; sha256 = bytes. *Check:* file exists; row count == fetched count; `shasum -a 256` spot-check matches.
- **R7** [AC2] Licence row per source dir, 4-col `| dir | VERDICT | basis | date |`. *Check:* every fetched source dir appears in `docs/RSA-Documents/LICENSE-REGISTER.md`; new rows match the regex.
- **R8** [AC2] Terms-forbidding docs → `quarantine/<dir>/` + QUARANTINE.md bullet with reason. *Check:* each non-`CLEAR` doc has a bullet (reason + date); zero non-`CLEAR` docs in train/test.
- **R9** [AC2] Dedupe: no fetched sha256 pre-exists; each new sha256 claimed with `project_id`+`split`. *Check:* corpus `dedupe-index.json` — no new sha256 among the pre-existing 333 (`ca-sources.md:27`); every new row carries project_id+split.
- **R10** [AC3] Split at intake: QC + held-out prairie province → test only, never train; other provinces → train. *Check:* script asserts train∩test provinces = ∅, QC ∉ train, no `project_id` in both; non-zero exit on violation.
- **R11** [AC1] Coverage table: per CA ODD cell fetched vs target, priority cells called out; per-doc `cell_key` ledger exists (none today, `ca-cells-split.md:11`). *Check:* keys == the 3 `canada:*` cells; fetched == distinct `cell_key` in the manifest; targets match `state/odd-coverage.json` (13/1, 41/0, 41/0 — `ca-cells-split.md:7-9`); priorities 0.9231/3/3 flagged.
- **R12** [AC4] Unfillable cells listed with reason + source family, as Track B/C input. *Check:* every zero-yield cell has non-empty reason + named source family; list non-empty.

## 2. AMBIGUITIES

- **A1 Missing parent plan.** §3/§5/§7 unrecoverable (`plan-recovery-a.md:3`); ticket body lists sources, probe ranks feasible hosts. **Default:** ticket body = authoritative list; §3 targets := `odd-coverage.json` targets; §7 := R10. **REVERSIBLE.**
- **A2 Held-out prairie province.** Prairie = AB/MB/SK (`plan-recovery-a.md:31`); MB+SK portals DNS-dead, MB robots bans AI agents (`source-feasibility.md:14-15,27`). **Default: AB held out** — only prairie province with a live robots-clean portal, so the test split is non-empty; train keeps BC/ON/others. **REVERSIBLE** (one manifest row; SK ⇒ empty test split).
- **A3 "QC" = Québec province or French content?** `ca_province` QC = Québec (`plan-recovery-a.md:31`); language is not a schema axis (`:41`). **Default:** QC = province Québec → test-only; French content elsewhere train-eligible, tracked by `lang`. **REVERSIBLE.**
- **A4 Undefined T2.** T0 unusable / T1 outputs-only / T3 complete / T4 = T3+outcome; T2 unknown (`plan-recovery-a.md:24`; `rsa-corpus/MAP.md:17` "EXTENDS, never redefines"). **Default:** never mint or assign T2; partials via `completeness` (`src/discovery/types.ts:124-129`). **REVERSIBLE** (label) but redefines a frozen ladder ⇒ not defaulted silently.
- **A5 60-70 docs vs "quality over count".** **Default:** count is a scale hint, not a floor; report actuals + deltas. **REVERSIBLE.**
- **A6 Where binaries live.** "No bulk text to git" (`CLAUDE.md:14`; corpus 886 MB untracked, `rsa-corpus/MAP.md:15`) vs corpus on the production box (6 of 333 paths on disk here, `ca-sources.md:39`). **Default:** write to `<corpus-root>/canada/<source-dir>/` on the corpus box; git gets manifests only. **REVERSIBLE in principle; needs the operator for the box ⇒ HITL-2.**
- **A7 Priority cells with absent axes.** rural/urban, existing/new, language **absent** (`plan-recovery-a.md:38-41`; schema axes lack them). **Default:** table on the repo's real axes (`cell_key` = jurisdiction:stage); §3 descriptor as free-text `priority_cell_note`; no schema change this ticket (`plan-recovery-a.md:54`). **REVERSIBLE.**
- **A8 "Complete" = doc_type or package?** `doc_type: complete-RSA` (`plan-recovery-a.md:40`) vs `have_full_package`/`completeness` (`types.ts:124-129`; ADR-0007 R1/R2). **Default:** two columns; "complete" for §3 only when both align. **REVERSIBLE.**
- **A9 Intake home + which dedupe index.** No field homes for project ID, track, language, split (`intake-fields.md:34`); split model is per-consumer roles, not train/test (ADR-0007). Two indexes: corpus `dedupe-index.json` vs discovery `state/dedupe-index.json`; write authority open (tracker R10). **Default:** standalone intake manifest in `docs/RSA-Documents/`, no `src/`/`contracts/` change; claim in the **corpus** index with `project_id`+`split` columns; cross-check the discovery index. **REVERSIBLE.**

## 3. DECISIONS to bake into the plan

1. **Source list of record** = ticket list ∩ probe-feasible = `open.alberta.ca`, `donnees.montreal.ca`, `www2.gov.bc.ca`, `www.unb.ca` (known PDF), `www.toronto.ca` (sitemap only) → fetcher allowlist (`source-feasibility.md:32`). MRDC/MUNIAC, Québec provincial, MB/SK open data are dropped (DNS-dead, 403, retired) → they become R12 unfillable rows (`ca-sources.md:56`; `source-feasibility.md:13-17`).
2. **Robots + politeness**: implement robots.txt fetch+parse (none in repo, `probe.md:7`) → `src/discovery/robots.ts`; 1 req/s/host, 10s on CKAN hosts (`ratelimit.ts:4-5`); neutral UA without AI-agent tokens (`source-feasibility.md:27`).
3. **Tier policy** T0/T1/T3/T4 only, never T2; partials via `completeness` → manifest validator.
4. **Project ID** `PRJ-`+`shortHash(sourceDir|projectKey)`, convention of `src/discovery/ids.ts:44-46` → minted in `scripts/harvest-track-a.mjs`.
5. **Split rule** QC+AB → test, else train, fixed at intake → split manifest; later replace the marker rule at `docs/RSA-Documents/scripts/build-finetune.py:10` (cannot express geography, `ca-cells-split.md:19`).
6. **Storage** binaries/text on the corpus box, out of git; PR carries only log, licence rows, dedupe claims, coverage table.
7. **Coverage reporting** target := `odd-coverage.json` `cells[].target`; fetched := distinct `cell_key` in the manifest; never report server-side `have_total` as fetched (`ca-cells-split.md:11`).
8. **Stop rule** no numeric floor; accepted = R4's four artefacts; T1 reported separately, never as §3 coverage.
9. **No `corpus-schema.json` change** this ticket → additive intake manifest (`intake-fields.md:34`).
10. **Quarantine routing** non-`CLEAR` → `quarantine/<dir>/` + QUARANTINE.md bullet, excluded from train/test; only `CLEAR` feeds C7/C8/C9 (`probe.md:15`).

## 4. HITL (operator only)

- **HITL-1 Missing parent plan.** `HARVESTING_PLAN.md` is in no branch (`plan-recovery-a.md:3`). Supply it, or authorise the D1 reconstruction — it is owner-authored; I cannot reconstruct it with authority. Work proceeds on D1 meanwhile.
- **HITL-2 Corpus location / execution box.** Binaries must land on the box holding the corpus (`ca-sources.md:39`); confirm host + path, and whether Track A runs here or on production. Box access = operator authority.
- **HITL-3 Crown-copyright verdicts.** CA Crown works will mostly be `RESTRICTED` (`CLAUDE.md:7`); only `CLEAR` feeds training (`probe.md:15`). Do RESTRICTED-but-fetched docs count toward the target, and who signs off? Changes the meaning of "60-70 documents".

Remaining §2 items have reversible defaults; A2/A3 are veto-able, not blocking.

## 5. OUT OF SCOPE

- **Track B** (ATIP/FOIA, fees, formal requests) and **Track C** — operator-only per the ticket Rules.
- **Corpus mining / training-pack construction** over `usa/`, `canada/`, `quarantine/` (`CLAUDE.md:6-9`) — C6/C8 territory.
- **ODD-cell status flips** (`mapped_unproven` → `in`): needs an accepted mapping + gate-passing fixture (`policies/odd.json` `_notes`); a fetch is not that.
- **Tier/T2 redefinition** of the frozen T0–T4 ladder (`rsa-corpus/MAP.md:17`).
- **Anything requiring the missing plan** — inventing §3 targets, the source list, or the §7 rule as if recovered.
- **`src/discovery/*` surgery** beyond the robots helper; no `state/` harvest-state changes; no `docs/` edits beyond register, quarantine, manifest.
