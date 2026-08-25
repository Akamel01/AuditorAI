# 06 — Round-3 hunt: NCHRP/TRB + CAREC vols + county RSAs

Type: research · Status: resolved · Blocked by: —

## Question

Second parallel vein toward 100+: (a) NCHRP/TRB free-PDF sweep for RSA appendices/case
studies (trb.org, nap.edu where free); (b) CAREC Road Safety Audit Manuals remaining
volumes with worked examples beyond Manual 5; (c) US county/city council-agenda corridor
RSAs (consultant PDFs attached to agendas are public-record); (d) iRAP SR4D documented
assessments beyond KSHIP. Target ≥10 new cataloged samples. Same rules as ticket 05.

## Answer

**10 new samples cataloged** (6 US, 4 INT→3 after dedupe) on 2026-08-25, all public-access,
`%PDF`-verified with sha256 recorded in the owning indexes. **ID range claimed per protocol:
us-120..us-125 and int-117..int-119** (read-time maxima were US-020 / INT-017). The parallel
agent landed sequential us-021..027 (MnDOT) and int-018..028 (UK/Ireland FOI) concurrently;
no US overlap. One INT collision found and resolved: both agents extracted Ardee Main Street
Stage 2 from the same ABP Quality Audit PDF — **kept theirs (int-018), removed mine (was
int-120) and deleted the duplicate file**; driver should renumber both batches sequentially.

| id | vein | artifact | why it matters |
|---|---|---|---|
| us-120 | (a) NCHRP/TRB | NCHRP Synthesis 336: Road Safety Audits (TRB 2004, free via onlinepubs.trb.org) | Appendix C specimen audit reports (~40 pp) + Appendix D FHWA scanning-tour checklists |
| us-121 | (a) TRB/FHWA | FHWA-SA-16-120 Improving Access to Transit Using RSAs: Four Case Studies (Oct 2016) | Transit-access RSA lens; full 14 MB Wayback capture of bot-walled safety.fhwa.dot.gov |
| us-122 | (c) city corridor | Cambridge St, Allston — Boston RSA (McMahon, Dec 2014, DRAFT copy) | City-agency team roster; corridor adjacent to Allston I-90 project area |
| us-123 | (c) city corridor | Chandler St (Rt 122), Worcester RSA (VHB, Aug 2020) | First fully remote audit format (Zoom + 360° video); HSIP-cluster context |
| us-124 | (c) MPO-authored | Bartlett St, Northborough RSA (CMRPC, Oct 2021) | MPO as producer — self-performed TMCs incl. truck classifications |
| us-125 | (c) county/city | Green Ave (S-5), Greenville SC Road Safety Assessment (AECOM, Oct 2024) | First SC sample; assessment-as-public-engagement pattern; Wayback-routed past CivicPlus wall |
| int-117 | (b) CAREC | RSE Manual 3: Roadside Hazard Management (ADB, Apr 2018) | Ch.4 treatment trade-off reasoning + worked case studies incl. urban interchange widening |
| int-118 | (b) CAREC | RSE Manual 4: Pedestrian Safety (ADB, Feb 2021) | Ch.VIII seven VRU case studies with before/after photos — strongest VRU worked-example volume |
| int-119 | (d) iRAP SR4D | iRAP Star Ratings of NACTO-GDCI Global Street Design Guide | Second documented design-stage assessment beyond KSHIP (~20 street typologies star rated) |
| ~~int-120~~ | (gap-fill) | ~~Ardee Main Street Stage 2 RSA extract~~ | Dropped — duplicate of parallel agent's int-018 |

**Best fixture candidates:** us-120 (specimen reports + checklist set for prompt/intake
material), us-121 (transit lens + benefit/cost framing), us-123 (remote-format process
evidence), us-124 (auditor-side Audit Context assembly), int-118 (VRU countermeasure
catalogue context), int-119 (design-render → star-rating chain for SR4D-lineage tests).

**Gaps documented** (full rows in index gap tables): CAREC Manual 2 fetched+inspected — no
worked examples, fails sample bar (file discarded); Manuals 6/7 out-of-RSA-scope; no named-
scheme SR4D reports publicly available beyond KSHIP/GDCI (WB P175118 = ISR only); INDOT RSA
guidelines example attachments held reference-class (VDOT rule); Indy DPW Shelby/Raymond RSA
news-documented but PDF not posted; Greenville Dunbar St sibling not located; greenvillesc.gov
and CivicPlus-class hosts need Wayback/browser tooling.

**NOTE (id ranges):** US: `us-120..us-125`; INT: `int-117..int-119` (+dropped int-120 slot).
Renumber driver should merge with parallel batch us-021..027 / int-018..028.

## Driver reconciliation note (2026-08-25)

us-120..125/int-117..119 renumbered to us-028..033/int-029..031 after collision-free
merge (Ardee dup dropped per sibling resolution). Roles assigned. Status: RESOLVED.
