---
id: T1
title: Seamless Mission Control via admin-key prompt
type: task
hitl: true
status: resolved
assignee:
blocked_by: []
blocks: [T2]
created: 2026-08-26
resolved: 2026-08-30
---

## Question

Can Mission Control be opened in a browser without manual `curl -H x-admin-key` work, and does `GET /api/dev/health` return 200 from that browser session?

This resolves when:

- `src/app/dev/mission-control/page.tsx` renders a persistent prompt on 401 that writes `localStorage auditorai.admin_key` via `setAdminKey` and retries (`reload`) without a page reload — already landed in `7ff9188`, verified by `npm run build` including `app/dev/mission-control/page-*.js` and a 200 shell fetch.
- `npx vercel env ls` shows `ADMIN_KEY Hidden` for Production/Preview/Development and the Vercel deployment serving `/dev/mission-control` is `● Ready` (re-checked after `289beec`).
- From a clean browser: open `https://auditorai-gamma.vercel.app/dev/mission-control`, paste the key obtained via `security find-generic-password -a "$USER" -s auditorai/admin-key -w` into the prompt, `Save & reload` → health row and all four `Segmented` views render; direct `curl -H "x-admin-key: $ADMIN_KEY" https://auditorai-gamma.vercel.app/api/dev/health` returns `{providers:[…], ledger:{entries:50,…}, topology:{drift:false}}` with `200` (no manual curl needed for the UI path).

If the deployment is still `● Building` at session start, wait for `● Ready` and hard-refresh (Cmd+Shift+R) before judging.

## Evidence (2026-08-30)

- Code: `src/app/dev/mission-control/page.tsx:177-212` 401 Panel `setAdminKey(input.trim())` + `reload()` without page reload; `src/lib/client.ts` `getAdminKey/setAdminKey` localStorage `auditorai.admin_key` → `x-admin-key`.
- Vercel env: `npx vercel env ls` shows `ADMIN_KEY Hidden Secret` Production + `Hidden Secret` Preview + `Config` Development.
- Keychain: `security find-generic-password -a "$USER" -s auditorai/admin-key -w` present (31 chars).
- Health: `curl -H x-admin-key $ADMIN_KEY https://auditorai-gamma.vercel.app/api/dev/health` → `200` `{providers:[seed ok 0ms, brave enabled:true 98ms 1 hit, google ok], ledger:{entries:150}, topology:{drift:false}}` (429→retry proof).
- Build: `npm run build` ✓ `/dev/mission-control 13.9kB` + `node scripts/vault-sync.mjs --check` ✓.
- Bundle: `stages/07_validate/output/ops-loop-evidence.json:t1`.
