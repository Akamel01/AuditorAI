---
id: H9
title: Control API + Start-continuous UI wiring
type: task
hitl: false
status: open
assignee:
blocked_by: [H8, H3]
blocks: [H10]
created: 2026-09-09
resolved:
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
