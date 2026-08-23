---
title: Zen API key rotated — handoff A security chore closed
type: journal
date: 2026-08-23
owner: agent
---

Owner confirmed 2026-08-23: the opencode API key (`OPENCODE_API_KEY`, the credential for
the OpenCode Zen gateway) has been **rotated** at opencode.ai account settings.

Closes work item 2 of `handoff-next-effort-fog.md` ("Rotate the Zen API key"), which
flagged the previous value as exposed via chat transit during Checkpoint execution on
2026-08-22 (E4 eval run + M3 vision smoke). Repo hygiene was verified clean before this:
no key material ever committed (only `OPENCODE_API_KEY=…` placeholders and `${apiKey}`
code references).

Standing discipline unchanged:

- New key supplied to processes **at invocation time only**
  (`OPENCODE_API_KEY=… npm run eval`) — never committed, logged, or written to disk.
- #22's acceptance eval will be the first consumer of the new key.
- Any future 401s from Zen should first be diagnosed as a stale locally-exported old key.

No thresholds, gates, or registry state touched by this entry.
