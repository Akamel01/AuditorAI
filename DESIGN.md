# DESIGN.md — AuditorAI "Chainage"

The visual world: an **engineer's drawing sheet**. The product's native material is the
technical drawing, the cited standards document, and the surveyor's alignment. The
interface borrows their conventions: hairline rules, title blocks, chainage station
marks, mono-spaced provenance, and one signal colour used semantically. Two themes share
one structure: light "daylight sheet" (default) and dark "night sheet".

## Colour

Semantic tokens (CSS vars, theme-switchable; see `globals.css`):

- **Canvas/Surface/Sunken** — paper `#fafbfc` / white / `#f2f4f6` (dark: `#0b0e13` / `#11151c` / `#0e1118`).
- **Ink ramp** — text `#10151c`, muted, subtle, faint (blue-cast neutrals; lightened in dark).
- **Signal blue** `#0b4f9e` (dark `#85aede`) — the single accent: interactive elements,
  links, evidence citations, compliance chips, focus rings. Never decorative.
- **Semantic only where the domain means it**: concern red (safety concerns), warn amber
  (missing inputs), ok green (provided/accepted).
- **Confidence-as-fill encoding**: authoritative/high = solid swatch · interpreted/medium =
  half-fill · inferred/low = dashed outline. Never colour-only.

## Typography

IBM Plex trio, self-hosted (OFL, `src/app/fonts/`, `next/font/local`):

- **Plex Sans** (variable) — UI and body. Weights 400–600 only.
- **Plex Mono** — the provenance voice: evidence IDs, chainage marks, source traces,
  input ids, dates, eyebrows (uppercase, +0.08–0.16em tracking, 9.5–12px).
- **Newsreader italic** — the formal voice, used ONLY for the professional-responsibility
  charter, audit disclaimers, and quoted clauses. If it appears anywhere else, remove it.

## Structure & signature

- **Title blocks** — page headers as engineering drawing title blocks (grid of hairline
  cells: scheme / framework / native stage / canonical map + confidence).
- **Alignment rail** — the process is a road alignment: two hairline edges, dashed
  centreline, stations at chainage points (`CH 0+000…`). Order must always encode a real
  sequence; never use the rail decoratively.
- **Chainage eyebrows** — section headers as station marks (`CH 0+090 · Findings`).
- **The junction figure** — hero shows a plan-view scheme excerpt being audited (finding
  pin, desire lines, evidence callout). Colours follow the theme via token utilities.

## Components

Primitives in `src/app/_components/ui/`: Button (primary/secondary/ghost/danger × sm/md,
loading), chips (Kind/State/Confidence/Seal/Eyebrow), Panel, EvidenceRef (intent-delayed
citation popover), AlignmentRail, Segmented (decision control), ConfirmDialog (irreversible
acts get ceremony), InlineNotice (replaces browser alerts), EmptyState/Skeleton/LoadingRows,
AppShell (nav + footer charter), ThemeToggle, Reveal (landing-only scroll reveals).

Every interactive element ships: default, hover, focus-visible (2px accent ring, 2px
offset), active (1px press), disabled (45% opacity), loading. No exceptions.

## Motion

Durations 120/150/200/400/550ms; easing `cubic-bezier(.2,0,0,1)` everywhere. Page-load:
staged settle (fade + 8px rise). The junction figure draws itself once (stroke-dashoffset).
Hover: colour/border shifts, 0.5px press on buttons, arrows nudge 2px. `prefers-reduced-motion`
disables all of it. Some things deliberately never move: title blocks, tables, the charter.

## Voice

Plain professional verbs, sentence case, no marketing superlatives. Errors explain what
happened and what to do; they never apologise or speculate. The product speaks about
itself precisely: "assists the audit process", never "makes roads safe".

## Anti-patterns (hard bans)

Purple AI gradients · glassmorphism · card-grid dashboards · sparkles/AI clichés ·
emoji as icons · decorative colour · shadows heavier than `--pop-shadow` · rounded corners
above `8px` on controls · animation without causal meaning · serif outside the formal voice.
