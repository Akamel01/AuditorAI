HV10 monitor flags implemented in scripts/harvest-verify.mjs
- Added parsing for --continuous (equals and space forms) with strict validation
- Added parsing for --maxTicks (equals and space forms) with validation
- Harvest-stream harness now writes HV10-stream_<streamId>.json instead of stream-<id>.json
- URL check for packages: if packages exist but no http(s) URLs found, fail fast
- Help text updated to document HV10 flags
- Minimal changes to preserve HV3/HV4 behavior for mocks and existing flows

Evidence/tests to run in-session (quoted outputs required by acceptance):
- node scripts/harvest-verify.mjs --mock
- node scripts/harvest-verify.mjs --help
- node scripts/harvest-verify.mjs --api harvest-stream --continuous=maybe
- node scripts/harvest-verify.mjs --api harvest-stream --maxTicks=abc
- npm run lint
- npm run typecheck

Notes: This patch is intentionally minimal to satisfy the bounded task requirements and the provided rereview plan (HV10). It does not enable full live HV10 publishing; it establishes the skeleton and test hooks that will be exercised by the orchestrator.
