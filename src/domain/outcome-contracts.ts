// ADR-0009 §4 identity/consent contract values. Deliberately dependency-free:
// the adjudication-capture UI runs in the browser and must not import
// outcomes.ts (node:fs/node:crypto); outcomes.ts re-exports these as its own
// so every consumer keeps a single source of truth.
export const CONSENT_VERSION = "1.0";

export const DEFAULT_AUDITOR_PSEUDONYM = "auditor-a1";
