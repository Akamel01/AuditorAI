# Decision Log

| Date | Decision | Rationale | Decider |
|------|----------|-----------|---------|
| 2026-08-22 | Keep existing private repo `Akamel01/AuditorAI` instead of creating `road-safety-auditor` | Repo already exists, is private, and is wired to the working directory; brief's name preference was soft ("preferably"). Renaming later via `gh repo rename` remains trivial. | ORCH |
| 2026-08-22 | Use Wayfinder **local-markdown tracker** in `workflow/wayfinder/` | No external tracker doc provided; skill default applies. In-repo tracker also satisfies §6 (state reconstructable from repository, not conversation history). | ORCH |
