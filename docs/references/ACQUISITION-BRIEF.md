# Acquisition Brief — What Still Needs Downloading, and Why

Owner-facing. Everything here was attempted this campaign; items are split by who can
get them. Update the per-jurisdiction MANIFEST gaps sections as items land.

## Tier 1 — Owner-only (login / purchase / request)

| Item | Where | Unlocks |
|---|---|---|
| **PIARC visitor account** (free, email registration) | roadsafety.piarc.org → "Order library" vs free downloads | INT pack depth; several EV-IN candidates currently secondary-sourced. Order-library items stay blocked even with account — only the free/member PDFs become fetchable. |
| **AASHTO HSM full text** (~$200–300, or member access) | highwaysafetymanual.org | Primary-source verification of EV-US-019/020 (currently quoted via secondary republications); strengthens US pack §safety-performance claims. |
| **TAC CRSAG** (~$150–300) | tac-atc.ca bookstore | CA pack primary quotes beyond Alberta's free republications; unblocks R-CA-* rule provenance hardening. |
| **ADG-18 annexes + RTA Dubai RSA Manual** | DMT/jawdah portal request; rta.ae publications | **The entire UAE proof path** — ADR-0007 keeps both UAE cells mapped-unproven until authentic worked-example material exists. Highest strategic value on this list. |
| FHWA RSA report archive mirror (if govinfo PURL degrades) | highways.dot.gov (bot-walled live) | Redundancy for us-002/003 class; govinfo currently works as alternate — monitor only. |

## Tier 2 — Agent-executable, in progress

| Vein | Status after round 2 |
|---|---|
| MnDOT edocs (6 more curl-fetchable RSAs logged deferred) | Round 3 target — richest open state-DOT vein found |
| UK FOI/EIR disclosure logs (Transport Scotland, National Highways) | Productive: INT-010..013 came from here; keep mining |
| Irish ABP/EIAR appendices | Productive: INT-014/015; Ardee Main Street Stage 2 flagged inside a Quality Audit PDF |
| Alberta open.alberta.ca | Exhausted via CKAN API (3 packages total) |
| Kamloops five-intersection ISRSR | Citation rot confirmed; Wayback/CDX dug — needs owner contact with City of Kamloops if wanted |
| Te Ara Tupua (NZTA) audits | Bot-walled live; Wayback truncates ~1 MiB — partial captures only |
| MassDOT GIS attachment library | Resolved: metadata-only (898 rows; Report_Link = internal S:\ paths). Dead end. |
| Caltrans/WSDOT/NYSDOT/FDOT worked audits | No worked RSAs published (training decks only). Structural absence — stop hunting. |

## Corpus arithmetic
- Cataloged: **60** (37 round-1 + 23 round-2). Release-test tier activates at **100+**.
- Round-3 agent veins: MnDOT batch, UK FOI continuation, Irish vein, NCHRP/TRB appendix
  sweeps, county/city council-agenda RSAs, CAREC remaining volumes.
- Designer response reports remain the scarcest artifact class everywhere — prioritize.

## Rules for whoever executes
Public access only; no login-wall circumvention; %PDF magic verification + sha256 into
the owning index.md; kebab-case filenames; dedupe against existing entries; licence
wording recorded verbatim; shortfalls documented in gaps sections. Full conversion path:
docs/validation/sample-conversion-checklist.md.
