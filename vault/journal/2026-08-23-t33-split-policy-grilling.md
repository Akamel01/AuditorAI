---
title: "T3.3 grilled + ratified: per-consumer split policy, firewall, registry v1"
type: journal
date: 2026-08-23
owner: agent
---

## Grilling outcome (7 decisions, owner live)

1. Split semantics = **per-consumer model** — roles attach to consumers, not artifacts.
2. In-service samples (~60% of corpus) = **hold for future ODD** (Reserve Corpus).
3. **Four canonical consumers**: Engine Few-shot, Judge Calibration, ODD Proof, Release Test.
4. Firewall = sample-level; **train∩test and calib∩test forbidden**; same-programme clusters
   (A9 slice) carry soft co-assignment caution.
5. Assignment = **rule-based auto + owner-arbitrated exceptions**.
6. Real-sample release-test tier = **dormant until 100+ target**; GF-6..10 remain the gate.
7. UAE mapped_unproven = **deferred pending ADG-18 annexes**; excerpts cannot be ODD Proof.

## Artifacts written

- `CONTEXT.md` §Sample corpus — eight new implementation-free terms (Audit Sample,
  Consumer Role, Engine Few-shot, Judge Calibration, ODD Proof, Release Test, Firewall,
  Reserve Corpus).
- `docs/adr/0007-sample-corpus-split-policy.md` — decision + auto-rules R1–R4 +
  consequences.
- `state/sample-corpus.json` — 28 registry entries auto-assigned by rule with citations:
  engine-fewshot ×3 (INT-008, US-008, CA-001), judge-calibration ×8, reserve ×15,
  unassigned ×2. Exceptions queue carries one proposal (promote AE-001 to calibration).
- `tests/fixtures/samples/README.md` pointer added.

## Notable rule applications

- CA-002/3/4 Glenmore DDI package → reserve: no CA×PRELIMINARY cell exists yet (prime
  candidate if the cell is added).
- FHWA case-studies compilation → judge-calibration with permanent note: already
  engine-consumed during E3 seeding, never release-test eligible.
- CA-001 assigned into an incident-flagged cell — recheck at next clean archive.

## Follow-ons

- Owner action queue unchanged: PIARC account, HSM, TAC CRSAG, ADG-18 annexes, RTA manual.
- T3.2 fixture conversion can now target exactly the three R2 samples when scheduled.
