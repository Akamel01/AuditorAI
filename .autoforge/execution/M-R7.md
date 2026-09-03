M-R7 — Refresh parity for parent reload
- Change: Add aria-label to the provider-health Refresh button reusing the existing title text to describe the dedup bypass reason.
- Rationale: Accessibility improvement; keeps tooltip text in sync with screen reader label. One-line change; no new deps.
- Evidence: src/app/dev/mission-control/_components/provider-health.tsx now includes aria-label on the Refresh button with the same message as the title: "Refresh bypasses onRun dedup — deliberate manual inspection, no scheduling side-effect".
