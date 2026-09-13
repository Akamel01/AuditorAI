# docs/RSA-Documents — RSA corpus root (ICM Knowledge-Bundle)

Ordered tree (C4, migrated 2026-09-13 per signed MOVE_MANIFEST.md). Start at `corpus-catalog.json`
(machine index, rebuilt by `scripts/build-catalog.py` — never hand-edit).

- `usa/` — CLEAR US sources (fhwa-case-studies, state-dots, local-mpo). Mine/pack/eval freely.
- `canada/` — RESTRICTED (Crown copyright): canadian, canadian-methodology, atip-package.
- `intl/` — RESTRICTED member-org publications (piarc-irf).
- `quarantine/` — excluded from mining until C3 re-verdict (incl. C10-BLOCKED canadian-not-audit).
- `canadian-staging/`, `templates/` — adopted empty dirs (staging artifacts, template seeds).
- `_archive/` — superseded harvester run logs. `_system/` is a catalog label only (entry files stay here).
- `_system/entry` = COLLECTION_INDEX/HARVESTING_PLAN/FOIA_TEMPLATE + C-series registers (this dir).

Rules: AI proposes, owner disposes (quote/mining outputs need ratification). No bulk text to git.
Tiers T0–T4 per HARVESTING_PLAN.md (extend, never redefine). License: LICENSE-REGISTER.md gates all use.
