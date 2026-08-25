# Wayfinder Map: Readiness Framework — Self-Sustaining Corpus

Labels: wayfinder:map · Tracker: local-markdown (.scratch/) · Created: 2026-08-24

## Destination

The readiness framework is self-sustaining AFK: **judged corpus ≥100 cataloged samples**
with ADR-0007 roles assigned at harvest, **conversions flowing** through the checklist
(GF-14+ deepening IN cells and flipping mapped-unproven cells where authentic material
exists), the **release-test tier active** the moment 100 is crossed (plumbing built
ahead), and **every ODD cell either IN or honestly blocked-on-owner**. Process debt that
repeatedly burned sessions today (vault determinism race, judge transport flakes) is
fixed so AFK sessions don't stall on it.

## Notes

- Consult `docs/validation/sample-conversion-checklist.md` before any conversion work;
  `docs/references/ACQUISITION-BRIEF.md` governs all download attempts (public access
  only, licence verbatim, %PDF+sha256 verification).
- Cross-session hygiene: parallel UI session owns src/app/** etc.; stage only your lane;
  use the stash-their-journal or HEAD-worktree trick when compiling vault state.
- No threshold/judge-prompt edits, ever (standing doctrine).
- Secrets via keychain (`auditorai/opencode`, `auditorai/kv-url`, `auditorai/kv-token`).
- AFK execution model: future sessions invoke `/wayfinder` on this map, claim one ticket,
  resolve, update handoff doc. Research tickets may fan out to subagents inside a session.

## Decisions so far

<!-- one line per closed ticket -->

- [01 — Conversions wave 1](issues/01-conversions-wave1.md): GF-14/15/16 real-scheme fixtures fully scored 100% (archive 2026-08-25T07-34-03-343Z); registry 161; odd.json v1.1.2.
- [03 — Judge transport-flake retry](issues/03-judge-retry.md): 4-attempt backoff in-run + --topup sibling-archive mode (scored verdicts immutable); proven live. 

## Not yet specified

- **Legacy-stage cell flips**: whether cataloged material (or round-3 hauls) can seed
  authentic fixtures for the ~10 mapped-unproven cells (UK S2-detailed/final-class, US
  final-design, CA detailed). Graduates into a conversion-planning ticket once R1/R2
  hunting lands and corpus composition is known.
- **Release-test activation ceremony**: at ≥100 cataloged, selecting the first held-out
  batch (never-consumed samples only, cluster-aware firewall) and defining its judged
  gate. Graduates when the threshold is near.
- **Post-activation hardening** (from ticket-02 review): distinct `firewall-tainted` tally bucket for mixed-role fixtures; require non-empty declared provenance per fixture once the release-test tier activates; extend integrity scan to cross-check samples/*/index.md headings against registry ids.
- **Corpus quality audit at scale**: dedupe pass and same-programme cluster check across
  the full registry once past ~90 (firewall rule against straddling).

## Out of scope

- Product/UI lanes (candidate-review UX, app overhaul) — owned by parallel sessions.
- PIARC order-library circumvention, any login-wall scraping — hard rule.
- Purchases (HSM, TAC CRSAG) and account registrations (PIARC) — owner-only, tracked in
  the waiting ticket for visibility, not worked by agents.
