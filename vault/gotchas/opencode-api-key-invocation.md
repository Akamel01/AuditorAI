---
title: OPENCODE_API_KEY handling + eval invocation quirks
type: gotcha
date: 2026-08-22
status: open
owner: agent
---

Lessons from the 2026-08-22 quote-bearing-baselines session (cost >5 min each):

## Key storage and use (macOS)

Store once (interactive prompt or clipboard pipe; value never transits chat/history):

```bash
security add-generic-password -U -a "$USER" -s "auditorai/opencode" -w "$(pbpaste | tr -d '[:space:]')"
```

Invoke at call time only:

```bash
OPENCODE_API_KEY="$(security find-generic-password -a "$USER" -s auditorai/opencode -w)" <command>
```

- Sanity-check `echo ${#K}` after retrieval: real keys ≈ 60+ chars. A 10-char entry was a
  silent placeholder that produced `judge HTTP 401` on every call.
- First access pops a macOS authorization dialog for `security` — click Allow.
- Never paste keys into chat; chat transit is why the previous key had to be rotated.

## Eval invocation

- `tsx` is not a pinned dependency; `npm run eval` dies with `tsx: command not found`.
  Use the CI form instead (`npx tsx scripts/run-eval.ts`, mirrors `.github/workflows/eval.yml:29`),
  optionally restoring the npm alias by adding tsx to devDependencies if desired.
- Budget ~30 s per judge call (free model, effort=max); a 10-finding corpus run takes
  minutes — set generous timeouts.
