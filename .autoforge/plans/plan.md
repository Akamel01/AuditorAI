# Plan — Akamel01/AuditorAI#117: Collect US reference PDFs into docs/references/US

Source of truth: `.autoforge/discovery/report.md` (candidate availability + gaps) +
`.autoforge/discovery/tracker-index.md` (frontier selection). Executable form:
`.autoforge/execution/work-order.json`. Scope: `docs/references/US/**` +
`.autoforge/plans/plan.md` + `.autoforge/execution/work-order.json` +
`.autoforge/execution/M1.md`.

## Tracker coverage

`.autoforge/discovery/tracker-index.md` lists 13 entries. Only `GH#117` is in-scope
frontier for this run; every other entry is out-of-scope and carries no code change.

| Tracker entry | Role in this plan | Module |
|---|---|---|
| `GH:Akamel01/AuditorAI#117` | **this work** — collect US reference PDFs | M1 |
| `GH:Akamel01/AuditorAI#104` | out-of-scope (operator-disk RSA readability) | — |
| `GH:Akamel01/AuditorAI#101` | out-of-scope (dead AI/judge models) | — |
| `GH:Akamel01/AuditorAI#99` | out-of-scope (calibration scorecard / ODD matrix) | — |
| `GH:Akamel01/AuditorAI#98` | out-of-scope (predicted vs report finding matching) | — |
| `GH:Akamel01/AuditorAI#97` | out-of-scope (report findings → Canadian pack taxonomy) | — |
| `GH:Akamel01/AuditorAI#95` | out-of-scope (verbatim-span extraction) | — |
| `GH:Akamel01/AuditorAI#93` | out-of-scope (calibration/refinement map, Canada first) | — |
| `GH:Akamel01/AuditorAI#90` | out-of-scope (Next.js 15 → 16) | — |
| `GH:Akamel01/AuditorAI#89` | out-of-scope (Dependabot @types/node bumps) | — |
| `GH:Akamel01/AuditorAI#41` | out-of-scope (enterprise-production map, Canada first) | — |
| `scratch:.scratch/readiness-framework/map.md` | out-of-scope (readiness framework map) | — |
| `scratch:.scratch/learning-loop/map.md` | out-of-scope (learning loop map) | — |

## DAG

```
M1 (download 5 public PDFs + update MANIFEST) — no dependencies
```

Single module; no parallelization or blocked-by edges.

## Modules

### M1 — Collect US reference PDFs and update MANIFEST

- **touches**: `docs/references/US/**`, `.autoforge/execution/M1.md`
- **blocked_by**: none
- **Objective**: Download the 5 public PDFs listed below into `docs/references/US/`,
  verify each begins with `%PDF` magic bytes and content-length sanity, record its
  SHA-256, add one complete MANIFEST row per file, and refresh the Gaps table.
  MassDOT amendments is a MUST-land item (not a gap). Boston Complete Streets
  Guidelines collected (publicly downloadable) — see M2. MUTCD Revision 1
  provenance recorded in Gaps (govinfo 2026-04365, 91 FR 10771, 2026-03-05) —
  not collected this run.
- **Inputs**: `.autoforge/discovery/report.md` candidate-availability table;
  `docs/references/US/MANIFEST.md`; `docs/references/ACQUISITION-BRIEF.md` rules.
- **Outputs**:
  - `docs/references/US/*.pdf` — 5 public PDFs:
    1. MUTCD 11th Edition (revision verified from cover: original Dec 2023 vs Rev 1
       Dec 2025) — `mutcd-11th-edition-*.pdf` (actual revision in filename)
    2. MUTCD final rule, Federal Register 88 FR 2023-27178 —
       `mutcd-final-rule-2023-27178.pdf` (justification: no standalone "revision list"
       PDF on the MUTCD site; FR PDF is the authoritative revision source)
    3. PROWAG final rule (Access Board, 88 FR 53604) — `prowag-final-rule-2023-16149.pdf`
    4. FHWA Standard Highway Signs 2012 supplement — `shs-2004-2012-supplement.pdf`
       (justification: single-file supplement to the 2004 per-chapter edition;
       URL `https://mutcd.fhwa.dot.gov/SHSe/shs_2004_2012_sup.pdf`)
    5. MassDOT amendments to MUTCD 11th ed. — `massdot-mutcd-11th-amendments-2026.pdf`
       (MUST-land; exact URL below; 5,350,882 B; pub date Jan 2026;
       access_status: public (browser headers))
  - `docs/references/US/MANIFEST.md` — 5 new rows + updated Gaps table + header
    retrieved date + tally line.
- **Dependencies**: none.
- **Acceptance criteria**:
  1. **Files present**: each of the 5 listed PDFs exists under `docs/references/US/`
     and begins with `%PDF` magic bytes.
  2. **MUTCD revision verified**: cover page of the MUTCD PDF is inspected; actual
     edition/revision (original Dec 2023 vs Rev 1 Dec 2025) is recorded in filename
     (glob `mutcd-11th-edition-*.pdf`) and MANIFEST row. No mislabeling.
  3. **MassDOT MUST-land**: downloaded from exact URL
     `https://www.mass.gov/doc/massachusetts-amendments-to-the-11th-edition-of-the-manual-on-uniform-traffic-control-devices-2026/download`
     using explicit browser headers (`User-Agent`, `Accept`, `Accept-Language`);
     5,350,882 B; pub date Jan 2026; access_status public (browser headers). Policy
     Directive P-26-003 is explicitly excluded (listed separately in Gaps, not
     collected). If fetch fails, escalate to operator — do not close ticket or
     silently record as gap.
  4. **Content-length/size checks**: per-file expected size bounds applied where
     known (MassDOT 5,350,882 B actual); for files
     without a published bound, require non-zero size + `%PDF` magic + recorded
     SHA-256. Abort rule: any non-2xx response, zero-byte file, non-`%PDF` body, or
     size outside an applicable bound → do not save; record in Gaps (except MassDOT
     escalates). No partial/broken PDFs committed.
  5. **MANIFEST rows complete**: one row per collected file in the `## Files` table
     with all 9 columns non-empty, including a lowercase hex SHA-256 matching
     `shasum -a 256` of the file. Full MANIFEST verified via
     `shasum -a 256 -c` (all rows).
  6. **Gaps table**: `## Gaps / blocked items` lists AASHTO Green Book, AASHTO HSM
     full text, PROWAG consolidated guidelines (HTML only), SHS 2004 per-chapter
     PDFs (deferred — no single full PDF; 2012 supplement collected as proxy),
     MUTCD revision list (covered by FR PDF + hotlinks edition), MUTCD Revision 1
     (govinfo 2026-04365, 91 FR 10771, 2026-03-05 — not collected; separate
     document),      Policy Directive P-26-003 (excluded). Boston Complete Streets Guidelines
     is now collected (see M2). Each with status and reason.
  7. **MANIFEST header**: retrieved date and tally line updated to this run. Tally
     line format: `**Successful downloads this run:** N fetched = **N files**.`
  8. **Eval-gate freshness preflight**: run
     `node scripts/check-eval-gate-freshness.mjs` (or repo equivalent) before
     committing; abort on stale gate.
  9. **CI gate**: `npm run ci:local` passes (full gate, not subset). Docs/references
     changes are a no-op for `state/vault-notes.json` and evidence checks because
     they do not touch `vault/` or `.autoforge/validation/`; vault-sync is run for
     hygiene only.
  10. **Vault failure path**: if `node scripts/vault-sync.mjs --check` reports a
      diff, abort and escalate to operator. Never stash foreign journal files or
      hand-edit `state/vault-notes.json`.
  11. **Git LFS**: preflight confirms `git lfs` available; post-add verification
      confirms all new PDFs are tracked (LFS or direct) and no broken pointers.
  12. **Staging hygiene**: stage only the files this ticket touched — explicit
      `git add docs/references/US/...` and `.autoforge/...`; never `git add -A`.
- **Required skills/tools/tests**:
  - Skills: `codebase-design` (module-boundary clarity).
  - Tools: `curl` with explicit browser headers, `shasum -a 256`, `file`/`head`
    for `%PDF` magic verification, `git`, `git lfs`.
  - Tests: none (no code); manual verification commands listed in work-order.
- **Agent role**: document-collection agent (download + hash + manifest edit).
- **Reviewer needs**: verify `%PDF` magic and SHA-256 match for every new row;
  verify Gaps table covers all blocked items from discovery; verify no AASHTO paid
  document was collected; verify MassDOT row present and P-26-003 excluded; verify
  MUTCD revision label matches cover page; verify SHS URL uses `/SHSe/` casing;
  verify staging hygiene (no `git add -A`).

## Stop conditions

- A target that returns non-2xx or a non-`%PDF` body is NOT saved; it is recorded
  in the Gaps table instead (no partial/broken PDFs committed), except MassDOT
  which escalates to operator on failure.
- AASHTO documents are never collected (paid/licensed; operator-supplied only).
- Policy Directive P-26-003 is never collected (explicitly excluded).
- Boston Complete Streets Guidelines is collected (M2).
- MUTCD Revision 1 is not collected (separate document; provenance recorded in Gaps).
- No change is made under `vault/`, so vault-sync is not required for correctness.
- If vault-sync --check reports a diff, abort and escalate; never stash or
  hand-edit.
- Filenames stay kebab-case per `ACQUISITION-BRIEF.md`; no duplicate of an
  existing MANIFEST entry is added.
- Git LFS preflight must pass before adding large PDFs; abort if LFS unavailable.
- Eval-gate freshness preflight must pass before commit.
(End of file)
", "filePath">
/home/oc/.opencode-runs/Akamel01-AuditorAI/117/worktree/.autoforge/plans/plan.md