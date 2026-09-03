# Investigation Report — Vault Memory Update (Adversarial)

Role: Autoforge Investigator | Model: opencode/gpt-5-nano

Scope: repo root references; vault memory update surfaces in state/vault-notes.json, .autoforge/execution/*, vault/, scripts/vault-sync.mjs, AGENTS.md, vault/CHARTER.md. This report applies the investigate-first discipline to surface hidden risks not explicit in the validation report.

Verdict: GO with REPLAN (evidence-driven mitigation plan to close latent risks)

What this report is and isn’t:
- It is not a re-validation of acceptance criteria. It identifies potential failure modes that could still poison state or drift artifacts in edge cases, especially under parallel work and journaling races.
- It cites concrete artifacts (paths and lines) to back each hypothesis, per the repo’s front-matter and determinism discipline.

Evidence foundation (key sources cited below):
- Validation report and determinism gating artifacts: .autoforge/validation/report.md; AGENTS.md; scripts/vault-sync.mjs; state/vault-notes.json; vault-notes registry.
- Charter and vault architecture: vault/CHARTER.md; vault/notebooks; state/evidence-registry.json.
- Proof of HEAD determinism guard and one-way sync policy: scripts/vault-sync.mjs; AGENTS.md.

Ranked findings (investigate-first, evidence-weighted):
- H1. Potential determinism poison from parallel journal edits despite HEAD-compilation guard
  - Rationale: The vault uses append-only journals; parallel sessions can generate edits that must be reconciled deterministically before commit. The determinism gate guards against this by compiling from HEAD and requiring clean diffs for commit. However, parallel sessions touching journals can still create marginal race conditions if the gating window or the journal file batch crosses a commit boundary.
  - Evidence (file:line):
    - AGENTS.md describes the determinism race and one-way guard (lines 7-10, 12-18) [AGENTS.md, lines 7-10; 12-18].
    - vault-sync.mjs implements a HEAD-compile comparison and a non-check write mode to refresh state/vault-notes.json with HEAD compilation (lines 2-5, 15-23, 27-44) [scripts/vault-sync.mjs, 2-5; 15-23; 27-44].
    - state/vault-notes.json shows the journal entries and the use of a note_count that tracks settlements (note_path lines shown below) [state/vault-notes.json, note_count: 27; specific journal entries: vault/journal/2026-09-02-journal-deletions-settled.md] [state/vault-notes.json, lines 4, 382-389].
  - Cheap falsification tests:
    - Run vault-sync.mjs in --check mode in CI; verify HEAD-vs-compiled equality as described in vault-sync.mjs (lines 27-37). If mismatch, the determinism gate flags a failure (lines 33-37).
    - Inspect parallel-worktree behavior by spinning a temporary HEAD worktree and performing both import/export and a live diff against committed state (callouts in vault-sync.mjs lines 17-23, 31-37).

- H2. Journal deletions and UTC/local timestamp confusion remain observable risks under edge-case concurrency
  - Rationale: The gotcha “Journal deletions by parallel sessions + UTC/local timestamp confusion” is listed in the vault-notes registry and is marked as settled in the corresponding journal file; yet a residual risk exists if clocks drift across environments or if a journal gets deleted concurrently with a settlement update.
  - Evidence (file:line):
    - state/vault-notes.json: vault/gotchas/journal-deletions-and-tz.md; status: settled (lines 9-13) and the note confirms the scenario (lines 11-12). [state/vault-notes.json, vault/gotchas/journal-deletions-and-tz.md, lines 9-13]
    - The same entry is reflected in the journal settlement file vault/journal/2026-09-02-journal-deletions-settled.md (lines 382-389 in the notes file reference) [state/vault-notes.json, lines 382-389].
  - Cheap falsification tests:
    - Validate that settlement journal files exist and that their front-matter status is settled; cross-check with the registry (state/vault-notes.json lines 12-18 for gotcha entries). 

- H3. Evidence registry integrity and provenance of “evidence_ids” references
  - Rationale: The CHARTER requires evidence_ids to resolve in the evidence registry; the registry must be consistent with the vault’s gotchas and journals. If evidence_ids are empty or mis-referenced, this could undermine traceability.
  - Evidence (file:line):
    - state/evidence-registry.json shows a compiled list of sources and an explicit instruction that registry is regenerated deterministically (lines 3-8, 37-38) and a populated evidence_records array (lines 39-54). [state/evidence-registry.json, lines 3-8; 37-38; 39-54]
  - Cheap falsification tests:
    - Run the registry regeneration script (compile-evidence.mjs) and compare to the registry; ensure evidence_ids in vault front-matter resolve to entries in the registry. The registry file shows the expected shape and regeneration rule (lines 36-37) [state/evidence-registry.json, lines 36-38].

- H4. Graph/source-hash drift and views integrity between registries and generated views
  - Rationale: The vault charter requires views to be machine-generated with a generated: true flag and a source hash; drift between source registries and the generated views can cause inconsistencies in the Obsidian graph and tooling.
  - Evidence (file:line):
    - CHARTER.md outlines the generated-views principle (lines 60-61) and the generated front-matter requirement; this anchors expectations for graph-source hashing. [vault/CHARTER.md, lines 60-61]
    - Validation report mentions that views were regenerated with a generated flag in vault/views (lines 42-44) [ .autoforge/validation/report.md, lines 42-44].
  - Cheap falsification tests:
    - Compare vault/views/graph-overview.md hash against the source registries; ensure the generated flag is present and the source_hash is updated consistently after vault-sync. If mismatch, re-run determinism cycle.

- H5. Staging hygiene and parallel-session discipline gaps
  - Rationale: The repo enforces staging hygiene to avoid contaminating commits with unrelated changes; violations can introduce subtle regressions when journal edits from other lanes bleed into a commit.
  - Evidence (file:line):
    - AGENTS.md documents staging hygiene rules and the determinism guard (lines 7-10, 12-18, 21-25). [AGENTS.md, lines 7-10; 12-18; 21-25]
  - Cheap falsification tests:
    - Enforce a per-ticket staged diff check in CI (e.g., git diff --name-only HEAD~1..HEAD must only include touched files); ensure no broad commits.

- H6. Secrets exposure risk in vault prose/gotchas
  - Rationale: The test evidence explicitly states that no secret material is present in published content; however, a future change could accidentally embed secrets in a gotcha or journal. Proactive scanning is prudent.
  - Evidence (file:line):
    - Report VG-02 notes on no secret material in published content (lines 30-32). [ .autoforge/validation/report.md, lines 30-32 ]
  - Cheap falsification tests:
    - Run a secrets-scan pass on the vault prose/gotchas before publish (CI step). 

- H7. Observability of tracker drift and frontier state after settlements
  - Rationale: The validation report mentions tracker index updates and an explicit “0 open frontier post-settlement” state; drift or misinterpretation of the frontier could mislead downstream tooling or humans.
  - Evidence (file:line):
    - The VG-SYNC portion of the validation report shows tracker index updated and determinism gate pass (lines 44-46). [validation report.md, VG-SYNC section, lines 44-46]
  - Cheap falsification tests:
    - Validate tracker/index state after any settlement by inspecting vault-SYNC outputs and the graph index file after vault-sync. 

- H8. Evidence registry consistency with front-matter references
  - Rationale: The front-matter in vault prose may refer to evidence_ids that are not yet linked; registry integrity matters for auditability.
  - Evidence (file:line):
    - Evidence registry includes an explicit note that compilation regenerates entries and the total_records field; check that this remains in lockstep with vault front-matter. [state/evidence-registry.json, lines 5-13; 36-38]

Artifacts consulted / artifact paths for traceability:
- .autoforge/validation/report.md (verbatim; GO verdict and evidence anchors) [Report, lines 4-5, 7-15, 35-46]
- .autoforge/validation/investigation.md (this file) [new]
- state/vault-notes.json (note_count 27; gotchas; journal settlement references) [state/vault-notes.json, lines 4, 9-13, 382-389]
- vault/CHARTER.md (zone rules; front-matter contract; views/hash rules) [vault/CHARTER.md, lines 10-20, 38-55, 60-61]
- AGENTS.md (determinism guard rules; one-way sync; staging hygiene) [AGENTS.md, lines 5-10, 12-18, 21-25]
- scripts/vault-sync.mjs (determinism gate implementation; check mode) [scripts/vault-sync.mjs, 2-5, 15-23, 27-44]
- state/evidence-registry.json (compiled sources; registry structure; regeneration guidance) [state/evidence-registry.json, 3-8, 36-38, 39-54]
- vault/journal/2026-09-02-journal-deletions-settled.md and vault/journal/2026-09-02-opencode-key-settled.md (settlements) [state/vault-notes.json, 382-389; 397-405]

Conclusion and next steps (GO/REPLAN):
- The vault memory update appears to satisfy the explicit acceptance criteria per the validation report; however, the following loop-back phases are advised to mitigate latent risks from parallel sessions, TZ handling, and evidence provenance:
- REPLAN Phase 1 — Determinism reinforcement
  - Execute: node scripts/vault-sync.mjs (no --check) to refresh HEAD-compilation-based state; then re-run with --check in CI.
  - If mismatch occurs, rebase/refresh the HEAD-compiled vault-notes.json and re-run; see determinism gate behavior in scripts/vault-sync.mjs (lines 27-37).
 REPLAN Phase 2 — Journal concurrency hygiene
  - Enforce per-session journal edits and avoid cross-session edits on the same file. Validate with the gotcha registry lines that show settlement in separate journal files (state/vault-notes.json lines 9-13; 382-389).
 REPLAN Phase 3 — Evidence registry cross-check
  - Regenerate evidence-registry.json and validate that vault front-matter evidence_ids resolve to the registry (state/evidence-registry.json; regeneration note lines 36-38).
 REPLAN Phase 4 — Views hash and graph integrity
  - After vault-sync, verify that vault/views/graph-overview.md contains up-to-date source_hash and that generated front-matter is present (vault/CHARTER.md rules lines 60-61; report lines 42-44).
 REPLAN Phase 5 — Secrets scanning and front-matter safety
  - Extend VG-02 policy to CI to ensure no secrets creep into vault prose or journals (report lines 30-32).
 REPLAN Phase 6 — Tracker drift instrumentation
  - Add a lightweight check to validate that tracker index and frontier counts reflect the settled state (report VG-SYNC lines 44-46).

Artifact path (final deliverable): .autoforge/validation/investigation.md

End of report

Notes: All findings are evidence-ranked and intentionally conservative. If any artifact changes post-review, re-run the determinism gate and update anchors in state/vault-notes.json and vault/views accordingly, per the charter (vault/CHARTER.md).

Evidence anchors for traceability (selected):
- AGENTS.md: determinism race and one-way guard (lines 7-10; 12-18) [AGENTS.md, 7-10; 12-18]
- vault-sync.mjs: determinism gate and update flow (lines 2-5; 15-23; 27-44) [scripts/vault-sync.mjs, 2-5; 15-23; 27-44]
- state/vault-notes.json: note_count 27; settled/journal entries (lines 4; 9-13; 382-389) [state/vault-notes.json, 4; 9-13; 382-389]
- vault/CHARTER.md: front-matter/forest rules and generated views (lines 38-55; 60-61) [vault/CHARTER.md, 38-55; 60-61]
- .autoforge/validation/report.md: VG-01/VG-02/VG-SYNC evidence anchors (lines 7-15; 35-46) [validation/report.md, 7-15; 35-46]
- state/evidence-registry.json: registry structure and regeneration notes (lines 3-8; 36-38) [state/evidence-registry.json, 3-8; 36-38]
