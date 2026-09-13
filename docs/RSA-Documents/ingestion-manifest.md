# C9 Ingestion Manifest (STAGED — registration + judged run pending owner)

Status: STAGED 2026-09-12. Promotion line (owner signs before ANY `state/sample-corpus.json` edit):
`PROMOTE-TO-CORPUS: owner via chat 2026-09-13 (5 CLEAR USA samples ONLY; 2 CA RESTRICTED held)`
Judge line (owner-run `--dry-run`/full eval needs OPENCODE_API_KEY + spend approval):
`JUDGE-RUN-APPROVED: owner via chat 2026-09-13`
2026-09-13 ATTEMPT: full judged `run-eval.ts` ran but Zen gateway returned HTTP 401 on all
fixtures (Keychain `auditorai/opencode` rejected; zero spend; bad archive removed, 09-08 restored).
Judged dry-run now needs a VALID OPENCODE_API_KEY — single remaining input.
Lineage: E3-sample-projects-from-corpus, ADR-0007 split policy, vault/journal/2026-08-23-phase2-sample-corpus.md (linked, not copied).

## Proposed new sample projects (NOT registered — zero live-corpus mutation)

| Proposed id | Source file | Canon | Jurisdiction | Stage | Tier | License | Finding anchor |
|---|---|---|---|---|---|---|---|
| us-034-mndot-us12-corridor-set | state-dots/MnDOT_US12_RSA_Technical_Report.pdf (+ Briefing Book + Post-Audit Presentation, same set) | C-0330 | USA | in-service | T3 | CLEAR | attenuator/HAWK/Baker Park/Hitsman findings |
| us-035-mndot-hwy55-weave | state-dots/MnDOT_Hwy55_RSA_2021.pdf | C-0324 | USA | in-service | T3 | CLEAR | entry-ramp weave IDs 1-3, left-exit ID 4 |
| us-036-fairfax-blake-lane-ped | local-mpo/Fairfax_Blake_Lane_Ped_RSA_2024.pdf | C-0273 | USA | in-service | T3 | CLEAR | tiered countermeasures, CMF 0.71 diet |
| us-037-tacoma-way-corridor | local-mpo/Tacoma_S_Tacoma_Way_RSA_2024.pdf | C-0282 | USA | in-service | T3 | CLEAR | Safe System corridor memo |
| us-038-fhwa-16-120-transit-access | fhwa-case-studies/FHWA-SA-16-120_Transit_Access_RSA_4_RSA.pdf | C-0259 | USA | in-service | T3 | CLEAR | Ronstadt transit-center issues |
| ca-012-ottawa-octranspo-transitway | canadian/OC_Transpo_Transitway_RSA.pdf | C-0046 | CA | in-service | T3 | RESTRICTED — needs clearance | anchor T3 |
| ca-013-unb-route-1000 | canadian/UNB_Canadian_RSA_Guidelines_with_Case_Studies.pdf | C-0107 | CA | in-service | T3 | RESTRICTED — needs clearance | anchor T3 |

## Coverage (jurisdiction × stage; T3-weighted)

| Jurisdiction | in-service | planning | prelim | License-clear now |
|---|---|---|---|---|
| USA | 5 (all T3) | 0 | 0 | 5/5 CLEAR |
| CA | 2 (T3, gated) | 0 | 0 | 0/2 — C10 clearance pending |
| INT/UK | 0 | 0 | 0 | corpus gap: 29 unmatched sample ids (UK A9, MassDOT corridors) have no corpus counterpart — cannot stratify from this harvest |

Dedupe guard: all 7 canonical ids distinct; none share a C5 exact-dup group with each other
(C-0046/C-0330 groups pair only with quarantine/html copies, excluded from ingestion).

## Dry-run wiring proof (no judge spend, no state pollution)

- `npx tsx scripts/run-eval.ts --no-judge` → exit 0 (2026-09-12), output relocated to /tmp/c9-dryrun
  (ephemeral; state/eval-scorecards restored — newest remains 2026-09-08, gate NOT tripped).
- Full judged dry-run (`--dry-run` on GF-1..5 + new samples post-registration) requires owner key/spend:
  pending JUDGE-RUN-APPROVED above. `--live` additionally owner-run per 2026-08-23 policy.
