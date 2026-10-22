# Discovery Report — Akamel01/AuditorAI#60: Harvest round 2 (free, wide search for public Canadian RSAs with agent-reach)

## Objective restated

Round 2 of the Canadian RSA harvest. Track A (issue #40, PR #58) searched only the plan's short portal list and found 3 new documents; round 2 must search wider, using the `agent-reach` skill plus free models, for public Canadian RSAs across municipal council/committee agenda packages, EA/Class EA study reports, university repositories, conference proceedings, and provincial ministry reports. Free sources only (operator, 2026-10-21); ATIP/paid are a future fallback.

## Ticket acceptance criteria (verbatim, from issue #60 body)

1. "The coverage table versus the ODD targets, before and after, with the priority cells called out."
2. "Harvest precision per class: true in-scope Canadian RSA at T3/T4, versus methodology, out of scope, duplicate and T0/T1."
3. "A source-yield table: which source types produced in-scope documents, so the next round aims well."
4. "The gaps that free sources cannot fill, as input for the ATIP fallback."

## Current state (before)

ODD targets/priorities come from `state/odd-coverage.json`; the three Canadian cells read:
- `canada:FEASIBILITY_CONCEPT`: target 13, have_total 1, have_full_package 0, priority 0.9231, label UNDER-COVERED (`state/odd-coverage.json`, cell with cell_key `canada:FEASIBILITY_CONCEPT`).
- `canada:PRELIMINARY_DESIGN`: target 41, have_total 0, priority 3, label MISSING.
- `canada:DETAILED_DESIGN`: target 41, have_total 0, priority 3, label MISSING.

The inventory-first view (distinct coverage-candidate documents) is in `docs/RSA-Documents/track-a-harvest-report.md` §1: FEASIBILITY_CONCEPT 1/13 (1 document, CLEAR), PRELIMINARY_DESIGN 0/41, DETAILED_DESIGN 1/41 (1 document, RESTRICTED, not usable). Coverage candidate shas are listed there with licence state.

Populations (`docs/RSA-Documents/track-a-harvest-report.md` "Row sets"): |A| = 305 (304 inventory rows + manifest rows not in inventory); |B| = 147 (Canadian subset). Split by corpus membership: |A| 203 under corpus root / 102 outside; |B| 128 / 19. In-scope share: 2 of 147 Canadian rows are coverage candidates (1.4% of |B|). Tier cross-tab of B: T0 89 (60.5%), T1 28 (19.0%), T3 23 (15.6%), T4 7 (4.8%) (§3b). T0/T1 never count as coverage. The committed on-disk stand-in is `docs/RSA-Documents/track-a-ondisk-inventory.jsonl` (304 rows); fetched records are in `docs/RSA-Documents/canada-intake-manifest.jsonl` (3 rows).

Stage→cell mapping lives in `policies/canada/pack.json:20-80` (planning→FEASIBILITY_CONCEPT, preliminary-design→PRELIMINARY_DESIGN, detailed-design→DETAILED_DESIGN, pre-opening→[] unmapped).

## What Track A could not reach (gap list round 2 must attack)

`docs/RSA-Documents/track-a-sources.json` holds 13 unfillable families (the `unfillable` array; the report calls them "Cells Track A cannot fill"). Summarised with reason + Track A's handoff:

1. Quebec provincial (www.quebec.ca) — HTTP 403 bot protection on robots.txt + landing; CDN (cdn-contenu.quebec.ca) and doc library (www.bv.transports.gouv.qc.ca) stay reachable. Handoff: Track B/C.
2. Ottawa open data (open.ottawa.ca) — JS-only SPA; robots.txt 404; no server-rendered listing. Handoff: Track C (headless).
3. Ottawa eScribe (pub-ottawa.escribemeetings.com) — listing is a JS bundle. Handoff: Track C.
4. Manitoba open data (data.gov.mb.ca) — DNS NXDOMAIN (retired). Handoff: Track B/C.
5. Manitoba government (www.gov.mb.ca) — robots.txt disallows / for GPTBot/ClaudeBot/CCBot/Scrapy; neutral UA permitted, but MB is the held-out test geography so Track A deferred. Handoff: Track B/C.
6. Saskatchewan open data (open.saskatchewan.ca) — DNS NXDOMAIN. Handoff: Track B/C.
7. Saskatchewan government (www.saskatchewan.ca) — open-data listing 404, no document index. Handoff: Track B/C.
8. MRDC/MUNIAC (University of Manitoba) (www.muniac.ca) — DNS NXDOMAIN; not referenced in corpus. Handoff: Track B/C.
9. PE, NL, and territories — no public no-login listing; ODD matrix has no native stage. Handoff: Track B/C.
10. Pre-opening stage audits (all provinces) — no public pre-opening RSA found; ca-tac:pre-opening has no canonical stage in `policies/odd.json`. Handoff: Track B/C.
11. Montreal open data (donnees.montreal.ca) — publishes data (CSV/GeoJSON), not audits; CKAN API robots-disallowed. Handoff: Track C (headless).
12. City of Toronto (www.toronto.ca) — sitemap covers WP tree only; audit PDFs under opaque ids behind 403. Handoff: Track C (search engine) or Track B.
13. UNB Transportation Group (www.unb.ca) — "temporarily unavailable" to external UAs; one known PDF already fetched. Handoff: Track C (university agreement).

(These 13 are the families round 2 must attack; round 2's free-source mandate covers items reachable without login/CAPTCHA.)

## Capability surface for round 2

The `agent-reach` skill (`/home/oc/.agents/skills/agent-reach/SKILL.md`) is a 15-platform, multi-backend router. Free, no-login channels relevant to RSA discovery (per its routing table + zero-config quick commands):
- Search: Exa AI via `mcporter call exa.web_search_exa query="..." numResults=N` (English/technical docs). This repo already wraps Exa in `src/discovery/providers/agent-reach-search.ts` (Exa HTTP search + Jina liveness confirm + gpt-5-nano qualify), gated by `AGENT_REACH_ENABLED` + `EXA_API_KEY` + `OPENCODE_API_KEY` (all off by default) (file: `src/discovery/providers/agent-reach-search.ts:15-40`).
- Web reading: Jina Reader `curl -s "https://r.jina.ai/URL"` (most pages readable as markdown); web-reader MCP for format control; RSS via feedparser.
- Dev: `gh search repos`/`gh search code` (GitHub — useful for university repos / proceedings mirrors).
- Video: yt-dlp subtitles (not relevant to RSA PDFs).

Paid/login-gated channels (not free; out of scope for this ticket): Twitter, Reddit, xiaohongshu, Facebook/Instagram, LinkedIn, Xueqiu. The skill's `agent-reach doctor --json` probes which backends are live; in this container `agent-reach`, `mcporter`, `opencli`, `bili`, `yt-dlp`, `feedparser` are all MISSING, so only `curl` and `gh` are actually runnable here — Exa/Jina discovery requires `mcporter`/keys that are not installed locally. (Verified via `command -v`.)

What agent-reach can do vs. the existing harvest pipeline:
- FIND (discovery): agent-reach surfaces candidate URLs via search + web reading.
- FETCH (intake): the existing pipeline enforces robots.txt (`src/discovery/robots.ts`, `robotsFor`/`isAllowed`/`crawlDelayMs`), 1 req/s per host (`src/discovery/ratelimit.ts`, `MIN_INTERVAL_MS = 1000`), hash/dedupe gate (`scripts/harvest-track-a.ts:175-216`, `hashSkipReason`), licence gating (`splitFor`, `scripts/harvest-track-a.ts:357`), split rule, TSV/manifest writing, 5 GB cap (operator-enforced, not code-enforced — see friction).

Can the existing harvester be pointed at agent-reach-discovered URLs? Yes at the fetch layer: `AgentReachSearchProvider.fetch` (`src/discovery/providers/agent-reach-search.ts` ~fetch method) already fetches a URL under `withHostBudget` with the harvest UA and returns bytes/status/headers, so discovered URLs can flow through the same intake. What would need to change: (a) enable the provider (env/keys) or add a new discovery source list; (b) `scripts/harvest-track-a.ts` sources are a static `sources` array in `track-a-sources.json` — round 2 needs either a new source-family input or a discovery-driven URL feed into the intake; (c) no code currently classifies stage from a discovered URL's text beyond `stage_hint` fallback (`scripts/harvest-track-a.ts:478` referenced in report §4); (d) licence verdict for discovered docs defaults to "unknown" unless a directory register entry exists (`docs/RSA-Documents/LICENSE-REGISTER.md`).

## Repo mechanics the implementer must respect

- Counting rules: sha256 identity; coverage candidate = Canadian (13 ca_province codes or CAN-GOV), tier T3/T4, stage maps to canonical cell; T0/T1 never count; duplicate copies never carry a count; manifest wins tier/stage on sha collision; BLOCKED manifest rows never count; licence not CLEAR → counted but not usable for train/test. (`docs/RSA-Documents/track-a-harvest-report.md` "Rules applied".)
- Licence gating: CLEAR only usable for train/test; non-CLEAR → restricted/quarantine. Register verdicts gate C7/C8/C9 inputs. (`docs/RSA-Documents/LICENSE-REGISTER.md` header; `scripts/harvest-track-a.ts:357` `splitFor`.)
- Split rule: QC + AB (held-out prairie province) → test only; other CLEAR provinces → train. (`scripts/harvest-track-a.ts:37`, `TEST_PROVINCES = ["QC","AB"]`.)
- Hash/dedupe gate: `hashSkipReason` skips any sha256 already in inventory (`scripts/harvest-track-a.ts:215-216`); dedupe index at `docs/RSA-Documents/dedupe-index.json`.
- 5 GB binary cap + manifest; binaries never enter git; keep a manifest. (issue #60 body; `docs/RSA-Documents/CLAUDE.md` notes binaries never enter git.)
- Per-document fields required: licence row, project ID, stage, tier, language, split, dedupe check against committed inventory (incl. ~300 docs on operator's Mac). (issue #60 body "Rules".)
- robots.txt + ≤1 req/s per host. (`src/discovery/robots.ts`, `src/discovery/ratelimit.ts`.)
- No ATIP/FOIA, paywalls, login, CAPTCHA in this ticket. (issue #60 body: "Only public documents that need no login".)
- Stage→cell mapping: `policies/canada/pack.json:76-83` (pre-opening unmapped).

## Friction & unknowns

Ambiguous/needs a decision (recommendations):
- "Free" definition: issue says free sources only, ATIP/paid are future fallback. Recommend: treat "free" = no money, no login, no CAPTCHA; Exa/Jina are free-tier but require keys not present locally — operator must provision `EXA_API_KEY`/`OPENCODE_API_KEY` or run discovery on a machine with them. (agent-reach-search gated at `src/discovery/providers/agent-reach-search.ts:15-40`.)
- French-language handling: ticket names `audit de sécurité routière` and French repos (Papyrus, Corpus ULaval, MTQ). Recommend: run parallel French query sets and tag `language=fr`; stage vocabulary differs (MTQ uses "audit de sécurité routière" with stages préliminaire/détaillé) — needs stage-mapping additions in `policies/canada/pack.json` or qualifier hints.
- Whether to fetch full PDFs or just triage by URL/title: recommend triage-first (qualify step already does this) to respect 5 GB cap; only fetch T3/T4 candidates.
- held-out geography: MB is both a gap family and the held-out test province — must not be harvested into train; split rule already routes AB+QC to test. Recommend leave MB harvesting to test split (as Track A did).
- 5 GB cap enforcement: no code enforces it; recommend a manifest size check in the harvester before fetch.

Genuinely unresolvable without the operator:
- Provisioning Exa/OpenCode keys and running `agent-reach doctor --json` on a capable machine (not available in this container).
- Access to JS-only portals (Ottawa eScribe, Montreal CKAN) and university networks (UNB) — needs headless browser or agreements.
- Whether any discovered doc's licence is CLEAR — needs owner sign-off per `LICENSE-REGISTER.md`.
- Whether stage labels from manifests are read from text or fallback hints — manifest does not record provenance (`docs/RSA-Documents/track-a-harvest-report.md` §4).

## Candidate source families for round 2 (ranked)

Each: family — discovery query shape — backend — login? — expected yield (speculation flagged).

1. Municipal council/committee agenda packages (eSCRIBE, CivicWeb, Granicus, city "agendas and minutes") across all provinces — query `"road safety audit" filetype:pdf site:<city>.ca` plus `"audit de sécurité routière" filetype:pdf` for QC; French operators `audit de sécurité routière`, `préliminaire`, `détaillé`, `avant ouverture`, `en service`. Backend: Exa search + Jina Reader. Login: no (public agendas), but some portals (Toronto secure.toronto.ca) 403. Yield estimate: moderate-high (speculative; Track A found municipal docs only indirectly).
2. EA / Class EA study reports (Environmental Study Reports, Transportation Master Plans, corridor studies) — query `"environmental study report" "road safety audit" filetype:pdf site:gov.<prov>.ca` and `"transportation master plan" "road safety audit"`. Backend: Exa + Jina. Login: no. Yield: moderate (speculative).
3. University repositories (UBC cIRcle, UofT TSpace, UWaterloo UWSpace, UNB, Concordia Spectrum, Polytechnique/UdeM Papyrus fr, U Laval Corpus fr) — query `"road safety audit" site:circle.ubc.ca` etc. and French equivalents. Backend: Exa search + `gh search` for mirrors; Jina for reading. Login: no for public items; UNB restricted. Yield: low-moderate (speculative; theses are T0/T1-heavy).
4. Conference proceedings (TAC, CITE) free PDFs — query `"road safety audit" site:tac-atc.ca` / `site:cite.ca` / `filetype:pdf "TAC" "road safety audit"`. Backend: Exa + Jina. Login: no. Yield: low (methodology-heavy, often T1).
5. Provincial ministry reports (MTO, BC MoTI, Alberta, MTQ fr, Manitoba, Saskatchewan, Maritimes) — query `"road safety audit" site:mto.gov.on.ca` etc. and `"audit de sécurité routière" site:transports.gouv.qc.ca`. Backend: Exa + Jina. Login: no for public ministry pages. Yield: moderate (speculative; many may be RESTRICTED licence).
6. (Speculative) Google-style filetype searches for stage words — query `"road safety audit" "preliminary" OR "detailed" OR "pre-opening" OR "in-service" filetype:pdf` (all provinces). Backend: Exa. Yield: unknown (speculative).

Marked speculation: all yield estimates above are speculative; no live searches were run (per constraints). T0/T1-heavy families (universities, conferences) are unlikely to move ODD coverage (only T3/T4 count) but may add methodology rows.

## Notes

- No source code, tests, or config were modified; only the two discovery artifacts were written.
- `scripts/harvest-track-a.ts` and `src/discovery/*` cited above are the integration points a round-2 implementer would touch; no changes made here.