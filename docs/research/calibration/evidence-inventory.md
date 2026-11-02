# Canadian ODD cell evidence inventory (#94)

**Status:** research; read-only; no network; 0 established counts. Date 2026-11-02.
**Deliverable:** the only artifact of ticket #94. Design of record: `.autoforge/architecture/report-t94.md` (R) and `decisions-t94.md` (D1–D14). Plan: `.autoforge/plans/plan-t94.md`.

## 1. Question, method, unit, status enum, denominators

**Question (ticket #94):** "How much harvested evidence exists per Canadian ODD cell today, and how far is each cell from the evidence minimum (20 test findings from at least 3 documents, after a 50/25/25 split)?"

**Method:** read-only analysis of the committed sources named in the source key; the coverage-candidate rule; a sample read of four LFS PDFs; LR-1 split arithmetic; the projection formula. No extraction, no OCR, no network, no model calls. Every number cites a file/command (source key S1–S14; commands C1–C8).

**Unit:** one discrete safety issue raised in the source report — location + affected users + evidence + risk + recommendation (`CONTEXT.md:59`; #92 decision 7). Not a recommendation bullet, not a page.

**Status enum (exactly four values):**

| Status | Definition | Where used in #94 |
|---|---|---|
| `established` | verbatim span + deterministic check + second-model verification (#92 §8) | 0 occurrences as a count; reserved for #95 |
| `estimate` | bounded sample read of a named document | the four measured cells (8, 14, 29, 12) |
| `not measured` | no local text available | all 24 URL-only row-cells and `a24707c6…` |
| `not established` | no verified count | everything else, incl. all 27 cell documents at the gate |

#94 publishes **0 established counts**. The gate's established column is 0 for every cell.

**Denominator hierarchy (adopted):**

| Rank | Denominator | Size | Use |
|---|---|---:|---|
| Primary (gate) | Coverage candidates | 1 FEAS / 0 PRELIM / 1 DETAILED = 2 | gate only (D3) |
| Secondary (attribution) | v3 classification | 11/6/5 docs, 23/13/15 sections, 20 unique | context only |
| Tertiary (fixture) | 11 LFS CA samples | FEAS 1, PRELIM 2, DETAILED 1 | sample frame |
| Source universe | inventory ∪ manifest ∪ ledger-only | 300 distinct, 145 Canadian | location table only |

**Rejected denominators (one line each):** 304/268 inventory (dup rows, T0/T1); 33 manifest (32 RESTRICTED, 20 blank `cell_key`); 33 v3 (mostly non-Canadian, T1); 11 fixtures (1 candidate, 4 in-service, 3 inputs-only); 349 ledger records (package-level, 5 sha); 12-row Canadian subset (mixed, unmapped).

**Corrections carried (mandatory):** ledger is **345** provenance entries holding **349** records over **5** distinct sha, not 3,485 documents (`state/discovery-ledger.json`; `sha256_hint` null). `a24707c6…` is **not** CA-006 — CA-006 is `b28c45bf…`, a different committed fixture (`tests/fixtures/samples/CA/index.md:101-114`); `a24707c6…` is operator-disk only, both inventory paths absent. Manifest = **33 rows = 32 RESTRICTED / 1 CLEAR, 0/33 `local_path` files present on disk (the field is populated; the files are absent)**. Inventory = **304 rows / 268 distinct sha** (98 with a worktree LFS copy, 170 operator-only, 21 both). Universe = **300 distinct** (299 inventory ∪ manifest + 1 ledger-only `a7189889…` INT PIARC) / **145 Canadian** (135 + 12 − 2). v3 = **11/6/5 docs, 23/13/15 sections, 20 unique**, 2 multi-cell (`5d29a43b…`, `ececad09…`); `sections[]` is the count, not `section_stages`. Candidates = 2 total (FEAS `0af7ea58…` CLEAR; DETAILED `a24707c6…` RESTRICTED; PRELIM 0). `have_total` is a package counter (1/0/0), not a document count. ADR-0005: matrix says FEAS `IN (incident)`; declaration log v1.0.1 says the flag was cleared; `policies/odd.json` has empty `incident_flags` — reported, not resolved. The harvest report's `|A|=305`/`|B|=147` are stale 3-row-manifest counts; not used.

**Source key:** S1 `policies/odd.json:103-228`; S2 `state/odd-coverage.json:96-248`; S3 `docs/RSA-Documents/canada-intake-manifest.jsonl` (33 rows); S4 `docs/RSA-Documents/track-a-ondisk-inventory.jsonl` (304 rows); S5 `state/discovery-ledger.json`; S6 `docs/research/stage-rules/classifications-v3.jsonl`; S7 `coverage-v3-vs-v2.{md,json}`; S8 `track-a-harvest-report.md:5,25-55,96-123`; S9 `tests/fixtures/samples/CA/index.md:26-189`; S10 `LICENSE-REGISTER.md:1-10`; S11 `docs/adr/0005-operational-design-domain.md:71,118`; S12 `.gitattributes:9`; S13 `docs/adr/0007-sample-corpus-split-policy.md:19-44`; S14 ticket #94, #92 decisions, grilling 1–13. Re-run via C1–C8 (report §2.4).

## 2. Per-cell inventory

Schema: `# | sha12 | Title | Jurisdiction / province | Provenance | Tier | Licence | Physical location | v3 § | Eligibility | Measured`. `sha12` = first 12 hex. Provenance codes: M manifest, I inventory, F fixture, L ledger, v3 classifier. `v3 §` = matching `sections[]` count; `0` = v3 row with zero matching sections; `n/c` = not in the 33-row v3 set. Eligibility: `GATE-CLEAR`, `GATE-RESTR`, `INEL-T1`, `INEL-JUR`, `INEL-STAGE`, `CTX-MANIFEST`, `CTX-LABEL`; may combine (`INEL-T1+JUR`). `Measured`: 8/14/29 (strict 27)/12 = `estimate`, else `not measured`. Jurisdiction: `CA / AB` etc.; `jurisdiction not established` for null-province rows (do not call them UK/US without proof). Tier: manifest wins when both sources hold the sha (`0af7ea58…` = T3, not inventory T0); fixtures use inventory tier with `(inv.)` and a label-conflict footnote; `a24707c6…` = T3. Licence: `CLEAR`, `RESTRICTED`, or `not recorded` (never invented for CA-002/007/010). Physical location: full labels only. `M+v3(0)` = manifest cell_key only, v3 row with zero matching sections. `0af7ea58…` = `M+I+F+L+v3`; `a24707c6…` = `I only`; CA-002/007/010 = `F+I`. Source: S3/S4/S6/S9/S10.

### canada:FEASIBILITY_CONCEPT (12 rows; 1 candidate)

| # | sha12 | Title | Jurisdiction / province | Provenance | Tier | Licence | Physical location | v3 § | Eligibility | Measured |
|---:|---|---|---|---|---|---|---|---:|---|---:|
| 1 | `0af7ea584ae0` (CA-001) | PLANNING STAGE (NEAHD) | CA / AB | M+I+F+L+v3 | T3 | CLEAR | Git LFS PDF | 3 | GATE-CLEAR | 8 |
| 2 | `1530d327c4c3` | MTMD (Quebec) | CA / QC | M only | T1 | RESTRICTED | URL only | 0 | CTX-MANIFEST | not measured |
| 3 | `1d5879a68c55` | Sprint Scheme Stage 1 | jurisdiction not established | M+v3 | T1 | RESTRICTED | URL only | 1 | INEL-T1+JUR | not measured |
| 4 | `2d4322f39383` | Combined Stage 1&2 response | jurisdiction not established | M+v3 | T1 | RESTRICTED | URL only | 0 | INEL-T1+JUR | not measured |
| 5 | `3b987d48a116` | Designer's Response | jurisdiction not established | M+v3 | T1 | RESTRICTED | URL only | 2 | INEL-T1+JUR | not measured |
| 6 | `5d29a43bb076` | Ottawa Schedule 15-2 | CA / ON | M+v3 | T1 | RESTRICTED | URL only | 2 | INEL-T1 | not measured |
| 7 | `60d10b708b62` | Bessborough Stage 1 | jurisdiction not established | M+v3 | T1 | RESTRICTED | URL only | 2 | INEL-T1+JUR | not measured |
| 8 | `a6e1a1e96a0b` | Road Safety Audit Stage 1 | jurisdiction not established | M+v3 | T1 | RESTRICTED | URL only | 3 | INEL-T1+JUR | not measured |
| 9 | `a7d0fc4ae596` | Killorglin Stage 1 | jurisdiction not established | M+v3 | T1 | RESTRICTED | URL only | 2 | INEL-T1+JUR | not measured |
| 10 | `bc5880b404bd` | CONFIDENTIAL Stage 1 | jurisdiction not established | M+v3 | T1 | RESTRICTED | URL only | 3 | INEL-T1+JUR | not measured |
| 11 | `d4a57774fc55` | 23-160-006.01 | jurisdiction not established | M+v3 | T3 | RESTRICTED | URL only | 3 | INEL-JUR | not measured |
| 12 | `ed2c0d694461` | Stage 1 RSA | jurisdiction not established | M+v3 | T3 | RESTRICTED | URL only | 2 | INEL-JUR | not measured |

### canada:PRELIMINARY_DESIGN (10 rows; 0 candidates)

| # | sha12 | Title | Jurisdiction / province | Provenance | Tier | Licence | Physical location | v3 § | Eligibility | Measured |
|---:|---|---|---|---|---|---|---|---:|---|---:|
| 1 | `0421ca4b9d06` | APPENDIX H | CA / ON | M+v3 | T1 | RESTRICTED | URL only | 1 | INEL-T1 | not measured |
| 2 | `299ac961228e` | A795 Stage 2 RSA | jurisdiction not established | M+v3 | T1 | RESTRICTED | URL only | 2 | INEL-T1+JUR | not measured |
| 3 | `5d29a43bb076` | Ottawa Schedule 15-2 | CA / ON | M+v3 | T1 | RESTRICTED | URL only | 2 | INEL-T1 | not measured |
| 4 | `603f3f01f781` | Lidl Mottingham | jurisdiction not established | M+v3 | T1 | RESTRICTED | URL only | 3 | INEL-T1+JUR | not measured |
| 5 | `a8020b20b358` | Westboro memo (AODA) | CA / ON | M only | T1 | RESTRICTED | URL only | 0 | CTX-MANIFEST | not measured |
| 6 | `6c0ffc7cd483` | Westboro memo | CA / ON | M only | T1 | RESTRICTED | URL only | 0 | CTX-MANIFEST | not measured |
| 7 | `e8810b8a08ac` | A795 Stage 2 response | jurisdiction not established | M+v3 | T3 | RESTRICTED | URL only | 3 | INEL-JUR | not measured |
| 8 | `ececad097781` | California Crossroads Stage 3 | jurisdiction not established | M+v3 | T3 | RESTRICTED | URL only | 2 | INEL-JUR | not measured |
| 9 | CA-010 (`a6d4af372c14`) | 34 St FPS §5.12 audit | CA / AB | F+I | T3 (inv.) | not recorded | Git LFS PDF | n/c | CTX-LABEL | 29 |
| 10 | CA-002 (`bb9850fe4780`) | Glenmore functional-plan RSA | CA / AB | F+I | T1 (inv.) | not recorded | Git LFS PDF | n/c | CTX-LABEL | 14 |

### canada:DETAILED_DESIGN (7 rows; 1 candidate)

| # | sha12 | Title | Jurisdiction / province | Provenance | Tier | Licence | Physical location | v3 § | Eligibility | Measured |
|---:|---|---|---|---|---|---|---|---:|---|---:|
| 1 | `a24707c6081a` | OC Transpo Transitway RSA | CA / ON | I only | T3 | RESTRICTED | operator-disk only | n/c | GATE-RESTR | not measured |
| 2 | `2b3115c3438b` | CCTT Trams to Newhaven | jurisdiction not established | M+v3 | T1 | RESTRICTED | URL only | 1 | INEL-T1+JUR | not measured |
| 3 | `2d8e41b8631a` | DBFL Consulting Engineers | jurisdiction not established | M+v3 | T1 | RESTRICTED | URL only | 1 | INEL-T1+JUR | not measured |
| 4 | `37863ef8e713` | Volume 4: Road Safety Audits | jurisdiction not established | M+v3 | T3 | RESTRICTED | URL only | 5 | INEL-JUR | not measured |
| 5 | `7b9715f0d030` | Annex 6 – Road Safety Audit | jurisdiction not established | M+v3 | T3 | RESTRICTED | URL only | 1 | INEL-JUR | not measured |
| 6 | `ececad097781` | California Crossroads Stage 3 | jurisdiction not established | M+v3 | T3 | RESTRICTED | URL only | 7 | INEL-JUR | not measured |
| 7 | CA-007 (`6c38a1a99caa`) | UNB exemplary audits (75% design example) | CA / NB | F+I | T4 (inv.) | not recorded | Git LFS PDF | n/c | CTX-LABEL | 12 |

**Notes:** `5d29a43bb076` (FEAS+PRELIM) and `ececad097781` (PRELIM+DETAILED) each appear in two cells; unique count is 27, not 29. `a24707c6081a` is in neither manifest nor v3; inventory-only DETAILED candidate; directory register verdict RESTRICTED (`LICENSE-REGISTER.md:10`); **not** CA-006. CA-002/007/010 have no manifest licence verdict (`not recorded` deliberate; ineligibility rests on tier/stage, not an invented licence). `0af7ea584ae0` reconciled to T3 because the manifest wins tier/stage (S8:17). `committed text` = 0: no in-repo extracted source text; v3 holds headings/spans, not text; the v3 cache is gitignored and absent. Locations aggregate (row-cells): **4 Git LFS PDF / 24 URL only / 1 operator-disk only / 0 committed text / 0 ledger metadata only = 29**; unique = 4/22/1 = 27. Overlaps: `0af7ea58…` is one document (manifest + inventory + LFS + ledger + v3; primary LFS; also URL/inventory/ledger); `555848f6…` is one LFS reference doc but **not** a cell document (BC, T1); 21 inventory sha have both an existing and a missing path; `a24707c6…` is one document (two inventory rows) and is not CA-006. Universe locations: 98 LFS + 31 URL + 170 operator-disk + 1 ledger-only = 300 (S4; report §4.1).

**Footnote — full shas (candidates + samples):**
- CA-001 / FEAS CLEAR: `0af7ea584ae04908b0f650f4d12ed9cc766c748ab56ef86faa417158e0bdcb95`
- DETAILED RESTRICTED: `a24707c6081a279fa899064bc95dba02d1664993f3b8c7b6491654f20b74789d`
- CA-002: `bb9850fe4780789ffe20b17c0a3d3182906b3e4010942d768abab4e920af343d`
- CA-010: `a6d4af372c143fdc42d3f4d4b8d945f9fe166768267ed52445f554ce30f3ef6e`
- CA-007: `6c38a1a99caaa666611eb6397d1672926b2b270cf793fc9fff9f448caeba5a9d`
- Multi-cell: `5d29a43bb076…` (FEAS+PRELIM) and `ececad097781…` (PRELIM+DETAILED); their 64-hex values are in S3/S4 and are not required by #94.

## 3. Cell summary

| Cell | ODD status | have_total (packages) | Row-cells | Unique docs | Canadian docs | Location (LFS/URL/DISK/text/ledger) | v3 docs | v3 sections | Manifest cell_key | Candidates (CLEAR/RESTR) | Measured docs (counts) |
|---|---|---:|---:|---:|---:|---|---:|---:|---:|---|---|
| FEAS | `in` | 1 | 12 | 12 | 3 | 1/11/0 | 11 | 23 | 10 | 1 (1/0) | 1 (8) |
| PRELIM | `mapped_unproven` | 0 | 10 | 10 | 6 | 2/8/0 | 6 | 13 | 3 | 0 (0/0) | 2 (14, 29) |
| DETAILED | `mapped_unproven` | 0 | 7 | 7 | 2 | 1/5/1 | 5 | 15 | 0 | 1 (0/1) | 1 (12) |
| **Total** | | **1** | **29** | **27** | **10** | **4/24/1/0/0** | **20** | **51** | **13** | **2 (1/1)** | **4** |

Totals: 29 row-cells / 27 unique; 20 unique v3 documents (primary or section; 19 if only section-attributed); 51 sections (multi-cell sections counted per cell); 2 candidates (1 CLEAR / 1 RESTRICTED); 4 measured docs; 4 LFS / 24 URL / 1 operator-disk; 10 unique Canadian docs (3 + 6 + 2 − 1 for `5d29a43b…`). 51 is the sum of the three cell rows, not the 60-section all-stage total. `have_total` is packages, not documents (FEAS 1/1 coincidence; DETAILED 0 packages vs 1 document). Per-cell unique counts sum to 29 row-cells; grand unique is 27. Source: S2/S6/S7/S9; report §5.4.

## 4. Finding estimates

Unit and counting rule (report §6.1): one discrete safety issue. Numbered issue table → rows; numbered issue groups → groups; bullet list → issue bullets, with named dedupe of exact restatements only. Location-specific instances of a general concern stay separate. `Estimate` is not `established`; only #95's verbatim-span + second-model verification can promote a count (#92 decisions 8/17; grilling 6–7); failures are discarded, not repaired.

| Doc | sha12 | Cell use | Text source | Location | Count | Counting detail | Sensitivity | Status |
|---|---|---|---|---|---:|---|---|---|
| CA-001 | `0af7ea58…` | FEAS (candidate) | `tests/fixtures/samples/CA/ab-neahd-planning-stage-rsa-2009.pdf` | LFS | **8** | §4.1+§4.2: 10 bullets total; compliance bullet ("Stage 1 plans are in accordance…") is not an issue → 9 issue bullets; the service-interchange spacing bullet restates the general interchange-spacing issue, so 9 → 8. | un-deduped 9 | estimate |
| CA-002 | `bb9850fe…` | PRELIM (label conflict) | `tests/fixtures/samples/CA/ab-calgary-glenmore-functional-plan-rsa-2017.pdf` | LFS | **14** | Table 2, Issue 1–14, each risk-rated. | none stated | estimate |
| CA-010 | `a6d4af37…` | PRELIM boundary (label conflict) | `tests/fixtures/samples/CA/ab-strathcona-34st-fps-traffic-safety-audit-review-2013.pdf` | LFS | **29** | Table 5-1, No. 1–29. Rows 15 and 20 are design-efficiency comments; strict count 27. Boundary sample excluded from the primary cell mean; sensitivity only. | strict 27 | estimate |
| CA-007 | `6c38a1a9…` | DETAILED (label conflict) | `tests/fixtures/samples/CA/nb-unb-exemplary-audits-appendix-c-1999.pdf` | LFS | **12** | 75% Design Stage Audit, Table 2 groups 1.1–5.2 (lettered (a)/(b) items are recommendations, not issues). Cell-relevant count, not the whole compendium (Route 1000, Fredericton-South, pre-opening also present). | strict issue unit 11 (1.3 is a positive statement) | estimate |

Cell means: FEAS **8** (CA-001 only); PRELIM **14** (CA-002; CA-010 excluded from the primary mean as a boundary sample; 21.5 if included); DETAILED **12** (CA-007's detailed-design example only).

Coverage: **4 of 27 cell documents** measured (14.8%); **1 of 2 coverage candidates**; **4 of 11 CA fixtures**. Convenience sample, deliberately biased toward readable LFS fixtures — not a random sample of the cell population.

Exclusions: all 24 URL-only row-cells and `a24707c6…` (operator-disk) are `not measured (no local copy)`; no imputation. Outside the 3 cells: CA-005/006/008/009 (in-service, mapping `n/a`) and CA-003/004/011 (inputs-only) are not sampled; CA-008 has no text layer (265 bytes, `index.md:142`); CA-006 is not a proxy for `a24707c6…` (different sha, different document). Uncertainty: point estimates, no confidence interval; CA-001's 8 is sensitive to the dedupe rule (un-deduped 9); CA-010's 29 is a table-row count (strict 27); CA-007's 12 is a group count (lettered recommendations would inflate it; strict issue unit 11 because 1.3 is a positive statement). #95 is the verification step. Source: S9; report §6.2–6.4.

## 5. Split

LR-1 rule (D8; report §7.1): sort sha256 ascending; quotas 0.50n/0.25n/0.25n; floor; distribute remaining seats by largest fractional remainder; ties exemplar → dev → test; assign contiguous blocks (first e exemplar, next d dev, remaining t test); if n<4, no split published, all unassigned, n_test=0. LR-1 is an unratified assumption (D14.1); the floor-rest alternative is in §6.

Population sizes: **P0 n = 1/0/1** (gate candidates); **P1 n = 11/6/5** (v3 attribution); **P2 n = 2/2/0** (Canadian cut); **P3 n = 1/2/1** (fixtures). P0/P2/P3 are context only; only P0 can gate. P2: FEAS `0af7ea58…`, `5d29a43b…`; PRELIM `0421ca4b…`, `5d29a43b…`; DETAILED none. P3: FEAS CA-001; PRELIM CA-002 + CA-010; DETAILED CA-007. P1 test docs: FEAS `bc5880b4…`, `d4a57774…`, `ed2c0d69…`; PRELIM/DETAILED `ececad09…`. 0 of the 3 P1 test documents has a recorded Canadian province (their source URLs are UK/IE); `ececad09…` is in both PRELIM and DETAILED test buckets (leakage hazard if cells share a model/prompt). This is why v3 is not a split population and why P1 numbers are not evidence. Do not present P1 numbers as evidence.

| Pop. | Cell | n | e/d/t | Test docs (sha12) | Canadian in test | Measured in test | Mean m | Projected = m×t | Confidence |
|---|---|---:|---|---|---:|---:|---:|---:|---|
| P0 | FEAS | 1 | no split | — | 0 | 0 | 8 | 0 | no test split |
| P0 | PRELIM | 0 | no split | — | 0 | 0 | 14 | 0 | no test split |
| P0 | DETAILED | 1 | no split | — | 0 | 0 | 12 | 0 | no test split |
| P1 | FEAS | 11 | 5/3/3 | `bc5880b4…`, `d4a57774…`, `ed2c0d69…` | 0 | 0 | 8 | 24 | low — proxy; no measured test doc |
| P1 | PRELIM | 6 | 3/2/1 | `ececad09…` | 0 | 0 | 14 | 14 | low — proxy; non-Canadian test doc |
| P1 | DETAILED | 5 | 3/1/1 | `ececad09…` | 0 | 0 | 12 | 12 | low — proxy; non-Canadian test doc |
| P2 | FEAS | 2 | no split | — | 0 | 0 | 8 | 0 | no test split |
| P2 | PRELIM | 2 | no split | — | 0 | 0 | 14 | 0 | no test split |
| P2 | DETAILED | 0 | no split | — | 0 | 0 | 12 | 0 | no test split |
| P3 | FEAS | 1 | no split | — | 0 | 0 | 8 | 0 | no test split |
| P3 | PRELIM | 2 | no split | — | 0 | 0 | 14 | 0 | no test split |
| P3 | DETAILED | 1 | no split | — | 0 | 0 | 12 | 0 | no test split |

Under LR-1, both Canadian v3 docs land in the FEAS exemplar (`0af7ea58…` at position 0, `5d29a43b…` at position 4) and three non-Canadian docs land in the FEAS test bucket. Source: S7/S9; report §7.3–7.5.

## 6. Projection

Formula (D10; report §8.1): `m_c = mean(cell-relevant measured findings)`; `t_c,P = test-bucket docs (0 if n<4)`; `projected_c,P = round_half_up(m_c × t_c,P)` (21.5 → 22). `m_c` uses cell-relevant counts (CA-007's 12 is the detailed-design example, not the whole compendium; CA-010's 29 is the §5.12 table). `t=0` ⇒ 0, labelled `no test split` (not "low-confidence 0"). `t>0` with ≥1 measured test doc ⇒ `estimate — k/t measured`. `t>0` with no measured test doc ⇒ `low-confidence estimate — proxy mean outside the bucket`. No measured doc in the cell ⇒ `no estimate`. Never `established`.

Worked: FEAS P1 `8×3 = 24` (test bucket has no measured doc → low-confidence proxy); PRELIM P1 `14×1 = 14` (`ececad09…` UK, unmeasured); DETAILED P1 `12×1 = 12` (same doc).

Gate projection: **0/0/0** (no test split; not "low-confidence 0"). This is the number the gate verdict uses. The 24/14/12 live only in the P1 context table and carry the label `not evidence`.

Sensitivities: CA-010 included in the PRELIM mean → mean 21.5, t=1 → **22** (context only). Floor-rest split instead of LR-1 → **32/28/24** (FEAS 8×4, PRELIM 14×2, DETAILED 12×2); note the rule changes the numbers; ratify before quoting. CA-002/007/010 admitted as candidates → still n<4, no test split, no gate. `a24707c6…` signed off → 1 usable doc, still n=1. The last two show that even optimistic label/licence fixes do not produce a test split; the cells need more documents. Source: S7/S9; report §8.2–8.4.

## 7. Gate verdict and gap

Strict definition (D11; report §9.1): a cell passes only when (1) ≥20 **established** test findings; (2) ≥3 **test-set** documents (grilling 11); (3) 0 RESTRICTED test documents before owner sign-off (`LICENSE-REGISTER.md:1-10`; grilling 12); (4) the cell's ODD status is `in` for an in-domain claim (`mapped_unproven` cells report "outside the declared domain" even if evidence exists).

| Cell | ODD status | Gate n | Usable n | Established test findings | Test docs | Strict verdict | Projected gate | Context P1 (not evidence) | Gap strict | Gap literal |
|---|---|---:|---:|---:|---:|---|---:|---|---|---|
| FEAS | `in` | 1 | 1 | 0 | 0 | insufficient evidence (0/20, 0/3) | 0 | 24 low-confidence | +10 | +2 |
| PRELIM | `mapped_unproven` | 0 | 0 | 0 | 0 | insufficient evidence | 0 | 14 low-confidence | +11 | +3 |
| DETAILED | `mapped_unproven` | 1 | 0 | 0 | 0 | insufficient evidence | 0 | 12 low-confidence | +10 (+sign-off) | +2 (+sign-off) |

No cell meets ≥20 established test findings from ≥3 test-set documents. FEAS is in-domain but has 0 established. PRELIM and DETAILED are `mapped_unproven`; even if evidence existed, an in-domain claim would be outside the declared domain.

Two readings of "≥3 documents" (report §9.3): **strict** — 3 test-set docs, min 11 cell docs under LR-1 → gaps +10 FEAS / +11 PRELIM / +10 DETAILED (+sign-off for DETAILED). **Literal** — 3 cell docs, min 3 → gaps +2/+3/+2 (+sign-off). The strict reading is adopted; the literal is shown because #92 does not spell out "test-set" and a +2-doc harvest plan would still fail the strict gate. Findings vs documents (report §9.3): at the sample means the document condition binds — FEAS m=8: ceil(20/8)=3 test docs needed, 3 test docs = 24 findings ≥20; PRELIM m=14: ceil(20/14)=2, the 3-test-doc condition is stricter; DETAILED m=12: ceil(20/12)=2, the 3-test-doc condition is stricter. Formula `t_required = max(3, ceil(20/m))`; convert to n via the allocation table. If a future cell's mean falls below 6.67, four test docs are needed (n≥15 under LR-1) and the findings condition becomes binding.

Other gaps: FEAS's one CLEAR candidate sits in the exemplar under P1's hash order; even at n=11 the test bucket is not guaranteed usable evidence (per-bucket licence check required; a cell may need more than 11 docs for 3 usable test docs). DETAILED's one candidate is RESTRICTED; until sign-off it contributes 0; the split may place it in test, giving 0 usable test docs even at n≥11. PRELIM has 0 candidates and 0 measurable eligible docs; its 14 is a proxy from an ineligible AB fixture, not cell evidence. Licence caveats: 32/33 manifest rows RESTRICTED; DETAILED's only candidate RESTRICTED; PRELIM has 0 candidates. Source: S1/S2/S7/S10/S11; report §9.1–9.3.

## 8. Not established + ratification

Not established (no resolution; D14):
- 0 established findings and 0 established test findings for every cell; #94 uses `estimate` only.
- No per-document count for the 24 URL-only row-cells or `a24707c6…` (operator-disk); no imputation.
- No v3 classification for `a24707c6…`, CA-002, CA-007, CA-010 (`n/c`).
- No proof null-province documents are non-Canadian; only `jurisdiction not established`.
- No OCR for CA-008 (265 bytes; scanned); no count.
- No owner sign-off for `a24707c6…` (RESTRICTED).
- No ratified split rounding rule (LR-1 vs floor-rest).
- No reconciliation of the ADR-0005 matrix incident flag, the v1.0.1 declaration log, and `policies/odd.json`'s empty `incident_flags`.
- No claim the 4-document sample is representative; it is a convenience sample.
- No v3 body/cache reproducibility; only the sidecar is committed.
- The ledger's `sha256_hint` is null; 345/349/5 is provenance, not 3,485 documents.
- The harvest report's `|A|=305`/`|B|=147` are stale 3-row-manifest counts; not used.
- `have_total` is a package counter, not a document count.
- No network; no new extraction; #95 owns established counts.

Ratification (numbered; D14):
1. LR-1 vs floor-rest (changes n=11 from 5/3/3 to 5/2/4 and P1 from 24/14/12 to 32/28/24).
2. Strict "3 test-set documents" vs literal "3 cell documents" (changes the gap from +2/+3/+2 to +10/+11/+10).
3. Owner sign-off for RESTRICTED `a24707c6…` before DETAILED can contribute.
4. Label correction for CA-002/CA-010/CA-007; even if corrected, n<4 in every cell, so the gate still fails.
5. Expand harvest to n≥11 per cell — the only route to a test split under the strict reading.
6. Prove jurisdiction for null-province v3 documents before calling them non-Canadian.
7. Reconcile ADR-0005's FEAS incident flag with `policies/odd.json`.
8. Treat CA-008 OCR, v3 cache reproducibility, and ledger entry-vs-document confusion as documented limitations, not #94 actions.

Source: S1/S2/S5/S7/S8/S11; report §10; decisions D14.

## 9. Handoff to #95

#94 hands #95: the 29-row-cell / 27-unique inventory; the four estimates (8/14/29/12); the LR-1 arithmetic; the gate 0/0/0; the gaps (+10/+11/+10 strict, +2/+3/+2 literal); the exclusions and the not-established list. #95 is blocked by #94.

#95 (D13): extract the scheme description and findings from the 2 candidate documents first (`0af7ea58…` CLEAR; `a24707c6…` after sign-off) and from the 3 label-conflict fixtures if the owner admits them. Every item quotes a verbatim span; a deterministic check confirms it; a second model verifies; failures are discarded, not repaired (#92 decisions 5/8/16). The operator spot-checks 10%. Re-run the split on the established counts; publish the established gate verdict. Status promotion: `estimate` → `established` only after verification. #94 does not promote any count. The gate remains "insufficient evidence" until #95 + harvest + sign-off. Source: S14; report §11.1; decisions D13/D14.


## Appendix A. Source commands (C1–C8) and verification

- C1 `jq '.cells | length' policies/odd.json` → 16; `jq` over `jurisdiction_id=="canada"` → 3 (S1).
- C2 `wc -l docs/RSA-Documents/canada-intake-manifest.jsonl` → 33; `jq` licence → 32 RESTRICTED / 1 CLEAR; province → 12; `cell_key` → 10 FEAS / 3 PRELIM / 20 blank; python `os.path.exists` on `local_path` → 0 (S3).
- C3 python over `track-a-ondisk-inventory.jsonl` → 304 rows / 268 distinct sha / 98 existing / 170 operator-only / 21 both / 205 missing rows over 191 distinct sha (S4).
- C4 python over `state/discovery-ledger.json` `provenance.records` → 345 entries / 349 records / 5 sha / 1 Canadian; `acquisition.bundles` → 350 entries / 457 bundle objects / 349 document entries / same 5 sha (S5).
- C5 python union → 299 distinct (inventory ∪ manifest) / 300 (+ ledger-only) / 145 Canadian (S4/S3).
- C6 `wc -l classifications-v3.jsonl` → 33; python `sections[]` → 23/13/15; unique 20 (S6/S7).
- C7 `ls tests/fixtures/samples/CA/*.pdf | wc -l` → 11; `pdftotext … | wc -c` → 10 > 1000; CA-008 265 bytes (S9).
- C8 `sha256sum` / `git lfs ls-files` for the 4 sample PDFs and `0af7ea58`; both `a24707c6` inventory paths absent; not fetched (S4/S9).

## Appendix B. Notes on reading this inventory

- Every table carries a source caption (S-id). Derived numbers show the arithmetic in the cell/section where they first appear.
- The 29 row-cells are one row per document per cell; the unique count is 27 because `5d29a43b…` (FEAS+PRELIM) and `ececad09…` (PRELIM+DETAILED) each appear in two cells.
- `v3 §` is the matching `sections[]` count, never the unique `section_stages` list; a naive count undercounts (`0af7ea58…`: 1 vs 3).
- `Measured` values are `estimate` only. `established` is reserved for #95; no #94 count uses it.
- `have_total` (1/0/0) is a package counter and is shown only as a cross-check; it is never used in gate math.
- The ledger-only `a7189889…` (INT PIARC) is in the 300 universe but is neither a cell document nor Canadian.
- `555848f6…` is a manifest row with an LFS reference copy but is not a cell document (BC, T1).
- `a24707c6…` is operator-disk only; its two inventory paths are absent in this worktree; it is not CA-006 (`b28c45bf…`).
- ADR-0005: the matrix snapshot says FEAS `IN (incident)`; the declaration log v1.0.1 says the flag was cleared; `policies/odd.json` has empty `incident_flags`. All three are reported; none is resolved here.
- The harvest report's `|A|=305`/`|B|=147` are row counts from a 3-row manifest and are not used; the current distinct-document union is 300 (299 + 1 ledger-only), 145 Canadian.


## Appendix C. Eligibility legend and population definitions

Eligibility (one column, never a row filter):
- `GATE-CLEAR` — coverage candidate, CLEAR licence, usable now.
- `GATE-RESTR` — coverage candidate, RESTRICTED, usable only after owner sign-off.
- `INEL-T1` — tier T1 or below; never counts toward the gate.
- `INEL-JUR` — Canadian jurisdiction not established (null province); not proven non-Canadian.
- `INEL-STAGE` — mapped-stage or label conflict; not a candidate.
- `CTX-MANIFEST` — manifest `cell_key` names the cell but v3 has no matching section.
- `CTX-LABEL` — fixture whose inventory label conflicts with the fixture index.

Populations (D9):
- P0 gate — coverage candidates (1/0/1); the only population that can gate.
- P1 attribution — v3-attributed docs (11/6/5); context only.
- P2 Canadian cut — v3 docs with a Canadian province (2/2/0); context only.
- P3 fixtures — index-native stage, excluding in-service and inputs-only (1/2/1); sample frame.

## Appendix D. Risk summary (from report §10)

- R1 strict 3-test-doc reading needs n≥11 per cell, not 3; a +2-doc harvest plan still fails.
- R2 v3 attribution is not evidence: 17/20 unique v3 docs have no Canadian province; 0 of the 3 P1 test documents has a recorded Canadian province (their source URLs are UK/IE); `ececad09…` is in two test buckets.
- R3 licence: 32/33 manifest rows RESTRICTED; the only DETAILED candidate is RESTRICTED; only one CLEAR candidate exists (FEAS).
- R4 three measurable fixtures are label-conflict rows (CA-002 T1/detailed, CA-010 T3/existing, CA-007 T4/pre-opening); they are the only readable PRELIM/DETAILED samples but are not candidates.
- R5 split rounding unspecified; LR-1 vs floor-rest changes n=11 from 5/3/3 to 5/2/4 and P1 from 24/14/12 to 32/28/24.
- R6 denominator drift: harvest report `A=305`/`B=147` computed on a 3-row manifest; committed manifest has 33 rows.
- R7 physical-location conflation: "304 operator-disk rows" is false; 98 distinct inventory docs are LFS, 170 operator-only, 21 both; manifest has 0 `local_path` files but 2 LFS copies elsewhere.
- R8 ledger duplication: 3,485 entries vs 349 provenance records vs 5 documents; `sha256_hint` null.
- R9 `section_stages` vs `sections[]`: the former is a unique list; the latter is the section count.
- R10 multi-cell documents and split leakage: `5d29a43b…` (FEAS+PRELIM), `ececad09…` (PRELIM+DETAILED).
- R11 CA-008 has no text layer (265 bytes).
- R12 v3 cache not committed; only the sidecar JSONL is committed.
- R13 ODD status vs ADR-0005 incident flag: `policies/odd.json` says FEAS `in` with empty `incident_flags`; ADR-0005's matrix records an active GF-10 incident flag.
- R14 jurisdiction null is not proof of non-Canadian; 21 manifest rows have blank province.
- R15 `have_total` packages vs documents: FEAS 1/1 coincidence; DETAILED 0 packages vs 1 document.

## Appendix E. Counting rule detail

Unit: one discrete safety issue raised in the source report, not one recommendation bullet and not one page (CONTEXT.md:59; #92 decision 7). Counting rules by document type:
- Numbered issue table (CA-002, CA-010): count the numbered issue rows. A row that is a design-efficiency comment rather than a safety issue is flagged; the primary count is the table as presented, with a strict-count sensitivity.
- Numbered issue groups (CA-007's 75% design example): count the issue groups (1.1–1.4, 2.1–2.4, 3, 4, 5.1–5.2); the lettered (a)/(b) items are recommendations/sub-actions, not separate issues.
- Bullet list (CA-001): count each issue bullet; exclude compliance/context statements; merge a specific bullet into a general bullet only when it restates the same design element (the merge is named in §4). Location-specific instances of a general concern remain separate issues.

`Estimate` is not `established`. Only #95's verbatim-span + second-model verification can promote a count (#92 decisions 8 and 17; grilling decisions 6–7). A failed span or verification is discarded, not repaired.

## Appendix F. Projection confidence labels

- `t = 0`: projection = 0, labelled `no test split`.
- `t > 0` and at least one test doc is measured: `estimate — k/t test docs measured`.
- `t > 0` and no test doc is measured: `low-confidence estimate — proxy mean from a sample outside the test bucket`.
- `m_c` has no measured doc: `no estimate`.
- Never `established`.
