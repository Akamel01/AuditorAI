# MOVE_MANIFEST (C4) — PROPOSED, moves pending owner signature

Status: PROPOSED 2026-09-12. Approval line (owner signs in-file before ANY move):
`APPROVED-BY: owner via chat 2026-09-13`

Rule: every catalog record maps to exactly one shelf (dry-run: 327/327 mapped —
usa 75, canada 62, intl 17, quarantine 169, _system 4 root entry files; zero unmapped).
Catalog universe = C5 dedupe-index 1:1 (content documents + 4 root entry files; tooling,
registers, dotfiles, .DS_Store, .autoforge/ excluded — their home is scripts/ and root,
not the catalog). Rebuild proof: `7d9be76977d029f2c816cb1be2a0d8206ac8e037764555777eab3dda757af15b` twice.

## Dir mapping (harvest layout → ICM shelves)

| Old | New shelf | Files | Note |
|---|---|---|---|
| fhwa-case-studies/ | usa/ | 35 | CLEAR |
| state-dots/ | usa/ | 27 | CLEAR |
| local-mpo/ | usa/ | 13 | CLEAR |
| canadian/ | canada/ | 42 | RESTRICTED |
| canadian-methodology/ | canada/ | 12 | methodology anchors |
| canadian-html-quarantine/ | quarantine/canadian-html-quarantine/ | 99 | C3 QUARANTINE |
| canadian-quarantine-v2/ | quarantine/canadian-quarantine-v2/ | 15 | C3 QUARANTINE |
| canadian-not-audit/ | quarantine/canadian-not-audit/ | 57 | C3 + C10 BLOCKED |
| piarc-irf/ | intl/ | 17 | RESTRICTED |
| atip-package/ | canada/atip-package/ | 8 | RESTRICTED, C3 KEEP |
| canadian-staging/ | (adopted empty staging) | 0 | C3 KEEP, purpose: mining staging |
| templates/ | (adopted empty) | 0 | C3 KEEP |
| fha-case-studies/ | DELETE | 0 | Empty + name collision with fhwa-case-studies; removal needs signature |
| scripts/ | stays (uncataloged tooling) | 14+ | Catalog builders move WITH path updates only if _system/tools adopted at migration |
| root dotfiles (.rsa_*.log, .rsa_pid.txt, .rsa_collected_urls.txt) | _archive/ | 3 | Superseded harvester run logs (excluded from catalog) |
| root indexes (COLLECTION_INDEX/HARVESTING_PLAN/FOIA_TEMPLATE/download-log) | _system/entry (stay) | 4 | Entry files, cataloged as _system, never moved |

Per-file targets derive from `corpus-catalog.json:shelf` + stage/type sub-shelves assigned in the
post-approval labeling pass (tier/stage/doc_type: 351/352 `needs_review` — content pass after C6 full run).

## COLLECTION_INDEX.md redirect (history NOT edited)

Lookup rule: bare basename → catalog record → new path. Measured 2026-09-12: 60/64 refs resolve;
4 harvest gaps (ISEC_Nigeria, NHDOT_Milton, NZTA_Ilam, WSDOT_Case_Studies) → collection backlog, not this ticket.

## Dry-run walk test (pre-move, 2026-09-12)

- where-am-I: root holds MAP-entry files + `_system/`/`_archive/` (post-move); every record has one shelf — PASS (327/327)
- stage contracts: shelves enforce jurisdiction/license/quarantine at rest — PASS (deterministic axes complete)
- status-by-scanning: `build-catalog.py` rerun byte-identical (`7d9be769…`) — PASS
- moves executed: ZERO (gate upheld)

## Post-approval migration (follow-up, NOT this ticket)

1. Owner signs above. 2. Migrate per shelf + write per-folder CONTEXT.md + root CLAUDE.md (<60 lines).
3. Re-run walk test post-move. 4. Record redirect notes for old paths.

## Migration EXECUTED 2026-09-13 (signed above)

- usa/{fhwa-case-studies,state-dots,local-mpo}, canada/{canadian,canadian-methodology,atip-package},
  intl/piarc-irf, quarantine/{canadian-html-quarantine,canadian-quarantine-v2,canadian-not-audit};
  fha-case-studies/ removed (verified empty pre-move); root .rsa_* logs → _archive/;
  canadian-staging/, templates/ stay (adopted); CONTEXT.md ×5 + root CLAUDE.md written.
- Loss-proof: all 351 pre-move content files present post-move (basename audit, 0 missing).
- Post-move walk: where-am-I PASS (router + contracts), stage contracts PASS (shelves enforce
  jurisdiction/license/quarantine), status-by-scanning PASS (build-catalog rerun byte-identical
  `8c4f310d…`, 333 records 1:1 with dedupe-index; inventory refreshed 376 files/6 drifts).
- Pack/manifest path note: gf-quote-pack.md File: lines updated harvest→usa/ (quote texts unchanged).
