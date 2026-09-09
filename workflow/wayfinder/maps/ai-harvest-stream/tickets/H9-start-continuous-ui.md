---
id: H9
title: Control API + Start-continuous UI wiring
type: task
hitl: false
status: closed
assignee: harvest-verifier
blocked_by: [H8, H3]
blocks: [H10]
created: 2026-09-09
resolved: 2026-09-09
---

## Question

How does `Start` send `{live,cellKey,continuous:true}` and show "Continuous — Stop to end" without new pages or deps?

## Context

`POST /api/dev/harvest-stream` (`route.ts:17-32`) takes `{live,cellKey}` only; `AiHarvestControl` Start (`ai-harvest-control.tsx:37-54,139-146`) same. Owner confirmed: Start-continuous is default, Stop is the only terminator.

## Agent Brief

**Category:** enhancement
**Summary:** Accept/persist `continuous` in API + client + control; status line shows continuous badge; `Stop` unchanged.

**Key interfaces:**
- `src/app/api/dev/harvest-stream/route.ts:17` (`POST`), `src/lib/client.ts:126-132` (`startHarvestStream`), `ai-harvest-control.tsx:37,139,190-195,214-215`

**Acceptance:**
- [ ] `POST {live,cellKey,continuous=true}` → `201 {streamId, stream}` with `stream.continuous===true`; omits → defaults `true` (continuous is default per owner); `continuous:false` still honored for one-shot/debug
- [ ] `Start` button sends `continuous:true`, label `Start continuous`, `data-testid="ai-harvest-start"` unchanged; status shows `continuous` badge + `iter N · packages M · continuous — Stop to end`; footer mentions `Reach: Exa+Jina via agent-reach`
- [ ] `Pause/Resume/Stop` unchanged; poll-2s unchanged (`ponytail:` ceiling kept)
- [ ] `@harvest` e2e updated: asserts `continuous:true` in POST body + badge visible

**Out of scope:** Provider (H7), loop internals (H8), CI gates (H10).

## Resolution

Closed 2026-09-09 via AutoForge chain (GO_WITH_NOTES — `.autoforge/validation/H9-final.md`):
architect (design + H3 KEEP-OPEN: pause/resume/stop route evidence out of H9
touches, non-intersecting) → planner (`plans/plan-H9.md` + `execution/work-order-H9.json`)
→ worker (4 files) → reviewer CHANGES_REQUIRED (spec swallows + @ts-ignore;
ruled `!== false` coercion correct, no 400) → worker spec-fix → validator NO-GO
(defective: cited docs, no current evidence) → validator recheck NO-GO (2 claims;
[4] misread guard, [2] ancillary probes) → orchestrator adjudication GO_WITH_NOTES.

- `route.ts`: `continuous = body.continuous !== false` + persist, 201 shape unchanged.
- `client.ts`: `startHarvestStream` forwards optional `continuous` (no default).
- `ai-harvest-control.tsx`: sends `continuous:true`, "Start continuous" label,
truthy badge + `· continuous — Stop to end`, footer `Reach: Exa+Jina via agent-reach`,
`continuous?` optional, testid unchanged, no new motion.
- `harvest-buttons.spec.ts`: hard POST assert (`:144`) + 2 badge regexes (`:153-154`),
no ts-ignore, @harvest kept; `.catch` probes match sibling-test convention.
- Gates quoted green: lint 0, typecheck 0, build compiled, vitest 11, --list 3, --mock 3-pass.
- H3 stays open (architect: remaining items outside H9 touches; H10 gates narrow H3-verify).
