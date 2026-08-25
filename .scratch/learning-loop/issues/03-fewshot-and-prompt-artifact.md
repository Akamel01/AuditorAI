# 03 — Few-shot manager + store compile + prompt artifact extraction

Type: task · Status: open · Blocked by: —

## Question

Implement ADR-0008 §3/§4 + ADR-0011 + ADR-0012: src/lib/fewshot.ts deterministic
cascade selector (native→canonical→jurisdiction→global, k≤3, role/firewall filters,
cluster dedupe); state/few-shot-store.json compiled from vault/fewshot/*.md with
lineage fields and firewall-inheritance check at compile; extract SYSTEM_PROMPT from
src/lib/ai.ts to prompts/system-prompt.md (version header + changelog), runtime load,
fail-closed on missing file, prompt_version+prompt_hash stamped into scorecards/outcome
rows/logs. Prompt edit = trigger event: land with a fresh full-corpus Tier-1 archive.

## Answer

