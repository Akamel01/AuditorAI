// Domain: append-only hash-chained audit trail (ticket #55, G-3).
// Pure module: no I/O, no env, no network. node:crypto only.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { assertWritableActor, parseActorId, type ActorId, type AuditActor } from "@/domain/actor";

export const AUDIT_TRAIL_GENESIS_HASH = "0".repeat(64);
export const AUDIT_TRAIL_EXPORT_FORMAT = "audit-trail/export@1";
export const AUDIT_TRAIL_MAX_EXPORT_ENTRIES = 20_000;
export const AUDIT_TRAIL_MAX_EVIDENCE_REFS = 500;

export type AuditTrailAction =
  | "project.saved"
  | "audit.saved"
  | "issue.issued"
  | "attachment.saved"
  | "attachment.deleted"
  | "artifact_trail.saved";

export const AUDIT_TRAIL_ACTIONS: readonly AuditTrailAction[] = [
  "project.saved",
  "audit.saved",
  "issue.issued",
  "attachment.saved",
  "attachment.deleted",
  "artifact_trail.saved",
];

export function isAuditTrailAction(value: string): value is AuditTrailAction {
  return (AUDIT_TRAIL_ACTIONS as readonly string[]).includes(value);
}

export type AuditTrailSubjectType =
  | "project"
  | "audit"
  | "issue"
  | "attachment"
  | "artifact_trail";

export interface AuditTrailSubject {
  type: AuditTrailSubjectType;
  id: string;
  project_id: string | null;
  audit_id: string | null;
}

export type AuditTrailPayloadValue = string | number | boolean | null;
export type AuditTrailPayload = Record<string, AuditTrailPayloadValue>;

export interface AuditTrailEntry {
  seq: number;
  workspace: string;
  recorded_at: string;
  actor: AuditActor;
  action: AuditTrailAction;
  subject: AuditTrailSubject;
  evidence_refs: string[];
  payload: AuditTrailPayload;
  payload_hash: string;
  prev_hash: string;
  entry_hash: string;
}

export interface AuditTrailRecordInput {
  actor: ActorId;
  action: AuditTrailAction;
  subject: AuditTrailSubject;
  evidence_refs?: readonly string[];
  payload?: AuditTrailPayload;
}

export interface BuildAuditTrailEntryInput extends AuditTrailRecordInput {
  workspace: string;
  seq: number;
  prev_hash: string;
  recorded_at: string;
}

export interface EvidenceRefSource {
  findings?: readonly { evidence?: readonly { evidence_id: string }[] }[];
  missing_information?: readonly { evidence_ids?: readonly string[] }[];
}

export type AuditTrailFailureReason =
  | "invalid_shape"
  | "seq_not_contiguous"
  | "genesis_mismatch"
  | "prev_hash_mismatch"
  | "entry_hash_mismatch"
  | "payload_hash_mismatch"
  | "workspace_mismatch"
  | "unresolvable_actor";

export type AuditTrailWarning = "unattributed_actor" | "empty_trail";

export interface AuditTrailVerifyResult {
  ok: boolean;
  checked: number;
  head: { seq: number; entry_hash: string } | null;
  first_bad_seq: number | null;
  reason: AuditTrailFailureReason | null;
  warnings: AuditTrailWarning[];
}

export interface AuditTrailExportBody {
  format: typeof AUDIT_TRAIL_EXPORT_FORMAT;
  workspace: string;
  exported_at: string;
  trail_starts_at: string | null;
  verification: AuditTrailVerifyResult;
  entries: AuditTrailEntry[];
}

export interface AuditTrailSignature {
  alg: "hmac-sha256";
  key_id: string;
  value: string;
}

export interface AuditTrailExport extends AuditTrailExportBody {
  signature: AuditTrailSignature;
}

export interface AuditTrailExportVerifyResult {
  ok: boolean;
  reason: "key_mismatch" | "signature_mismatch" | "chain_invalid" | "invalid_export" | null;
  chain: AuditTrailVerifyResult;
}

export class AuditTrailTooLargeError extends Error {
  count: number;
  cap: number;
  constructor(count: number, cap: number) {
    super(`audit trail export exceeds cap: ${count} > ${cap}`);
    this.name = "AuditTrailTooLargeError";
    this.count = count;
    this.cap = cap;
  }
}

// --- canonical JSON ---------------------------------------------------------

export function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return undefined as unknown as string;
  const t = typeof value;
  if (t === "string") return JSON.stringify(value);
  if (t === "boolean") return value ? "true" : "false";
  if (t === "number") {
    const n = value as number;
    if (!Number.isFinite(n)) throw new TypeError("non-finite number");
    if (n === 0) return "0";
    return JSON.stringify(n);
  }
  if (t === "bigint" || t === "function" || t === "symbol") {
    throw new TypeError(`unsupported value type: ${t}`);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalJson).join(",") + "]";
  }
  if (t === "object") {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      throw new TypeError("class instance is not serialisable");
    }
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const parts: string[] = [];
    for (const k of keys) {
      const v = obj[k];
      if (v === undefined) continue;
      parts.push(JSON.stringify(k) + ":" + canonicalJson(v));
    }
    return "{" + parts.join(",") + "}";
  }
  throw new TypeError("unsupported value");
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function auditTrailPayloadHash(payload: AuditTrailPayload): string {
  return sha256Hex(canonicalJson(payload));
}

export function auditTrailEntryHash(entry: AuditTrailEntry): string {
  const { entry_hash: _ignored, ...rest } = entry;
  return sha256Hex(canonicalJson(rest));
}

export function auditTrailKeyId(key: string): string {
  return sha256Hex(key).slice(0, 8);
}

export function buildAuditTrailEntry(input: BuildAuditTrailEntryInput): AuditTrailEntry {
  assertWritableActor(input.actor);
  const refs = [
    ...new Set((input.evidence_refs ?? []).filter((s) => typeof s === "string" && s !== "")),
  ]
    .sort()
    .slice(0, AUDIT_TRAIL_MAX_EVIDENCE_REFS);
  const payload: AuditTrailPayload = input.payload ?? {};
  const entry: AuditTrailEntry = {
    seq: input.seq,
    workspace: input.workspace,
    recorded_at: input.recorded_at,
    actor: input.actor,
    action: input.action,
    subject: input.subject,
    evidence_refs: refs,
    payload,
    payload_hash: auditTrailPayloadHash(payload),
    prev_hash: input.prev_hash,
    entry_hash: "",
  };
  entry.entry_hash = auditTrailEntryHash(entry);
  return entry;
}

export function evidenceRefsOf(source: EvidenceRefSource): string[] {
  const set = new Set<string>();
  for (const f of source.findings ?? []) {
    for (const e of f.evidence ?? []) {
      if (e && typeof e.evidence_id === "string" && e.evidence_id !== "") {
        set.add(e.evidence_id);
      }
    }
  }
  for (const m of source.missing_information ?? []) {
    for (const id of m.evidence_ids ?? []) {
      if (typeof id === "string" && id !== "") set.add(id);
    }
  }
  // shortcut: completeness beyond 500 stays in the record; upgrade if a real audit exceeds it.
  return [...set].sort().slice(0, AUDIT_TRAIL_MAX_EVIDENCE_REFS);
}

// --- verify -----------------------------------------------------------------

function isShapeValid(value: unknown): value is AuditTrailEntry {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const e = value as Record<string, unknown>;
  if (typeof e.seq !== "number" || !Number.isInteger(e.seq) || e.seq < 1) return false;
  if (typeof e.workspace !== "string") return false;
  if (typeof e.recorded_at !== "string") return false;
  if (typeof e.actor !== "string") return false;
  if (!isAuditTrailAction(e.action as string)) return false;
  if (!isSubjectValid(e.subject)) return false;
  if (!Array.isArray(e.evidence_refs) || !e.evidence_refs.every((x) => typeof x === "string")) return false;
  if (!isPayloadValid(e.payload)) return false;
  if (typeof e.payload_hash !== "string") return false;
  if (typeof e.prev_hash !== "string") return false;
  if (typeof e.entry_hash !== "string") return false;
  return true;
}

function isSubjectValid(value: unknown): value is AuditTrailSubject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const s = value as Record<string, unknown>;
  const types: AuditTrailSubjectType[] = [
    "project",
    "audit",
    "issue",
    "attachment",
    "artifact_trail",
  ];
  if (!types.includes(s.type as AuditTrailSubjectType)) return false;
  if (typeof s.id !== "string") return false;
  if (s.project_id !== null && typeof s.project_id !== "string") return false;
  if (s.audit_id !== null && typeof s.audit_id !== "string") return false;
  return true;
}

function isPayloadValid(value: unknown): value is AuditTrailPayload {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  for (const v of Object.values(value as Record<string, unknown>)) {
    const t = typeof v;
    if (v === null) continue;
    if (t === "string" || t === "boolean") continue;
    if (t === "number" && Number.isFinite(v as number)) continue;
    return false;
  }
  return true;
}

function seqOf(value: unknown): number | null {
  if (typeof value === "object" && value !== null) {
    const s = (value as Record<string, unknown>).seq;
    if (typeof s === "number" && Number.isInteger(s)) return s;
  }
  return null;
}

export function verifyAuditTrail(
  entries: readonly unknown[],
  opts?: { workspace?: string },
): AuditTrailVerifyResult {
  const warnings: AuditTrailWarning[] = [];

  if (!Array.isArray(entries)) {
    return {
      ok: false,
      checked: 0,
      head: null,
      first_bad_seq: null,
      reason: "invalid_shape",
      warnings,
    };
  }

  if (entries.length === 0) {
    return {
      ok: true,
      checked: 0,
      head: null,
      first_bad_seq: null,
      reason: null,
      warnings: ["empty_trail"],
    };
  }

  // shape pass
  for (const e of entries) {
    if (!isShapeValid(e)) {
      return {
        ok: false,
        checked: 0,
        head: null,
        first_bad_seq: seqOf(e),
        reason: "invalid_shape",
        warnings,
      };
    }
  }

  const sorted = [...entries].sort((a, b) => (a as AuditTrailEntry).seq - (b as AuditTrailEntry).seq);

  let checked = 0;
  let prevEntryHash: string | null = null;
  let lastHash: string | null = null;
  let lastSeq: number | null = null;

  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i] as AuditTrailEntry;

    if (e.seq !== i + 1) {
      return {
        ok: false,
        checked,
        head: null,
        first_bad_seq: e.seq,
        reason: "seq_not_contiguous",
        warnings,
      };
    }

    if (i === 0) {
      if (e.prev_hash !== AUDIT_TRAIL_GENESIS_HASH) {
        return {
          ok: false,
          checked,
          head: null,
          first_bad_seq: e.seq,
          reason: "genesis_mismatch",
          warnings,
        };
      }
    } else {
      if (e.prev_hash !== prevEntryHash) {
        return {
          ok: false,
          checked,
          head: null,
          first_bad_seq: e.seq,
          reason: "prev_hash_mismatch",
          warnings,
        };
      }
    }

    if (auditTrailEntryHash(e) !== e.entry_hash) {
      return {
        ok: false,
        checked,
        head: null,
        first_bad_seq: e.seq,
        reason: "entry_hash_mismatch",
        warnings,
      };
    }

    if (auditTrailPayloadHash(e.payload) !== e.payload_hash) {
      return {
        ok: false,
        checked,
        head: null,
        first_bad_seq: e.seq,
        reason: "payload_hash_mismatch",
        warnings,
      };
    }

    if (opts?.workspace !== undefined && e.workspace !== opts.workspace) {
      return {
        ok: false,
        checked,
        head: null,
        first_bad_seq: e.seq,
        reason: "workspace_mismatch",
        warnings,
      };
    }

    const parsed = parseActorId(e.actor);
    if (parsed === null) {
      return {
        ok: false,
        checked,
        head: null,
        first_bad_seq: e.seq,
        reason: "unresolvable_actor",
        warnings,
      };
    }
    if (e.actor === "auditor" && !warnings.includes("unattributed_actor")) {
      warnings.push("unattributed_actor");
    }

    checked++;
    prevEntryHash = e.entry_hash;
    lastHash = e.entry_hash;
    lastSeq = e.seq;
  }

  return {
    ok: true,
    checked,
    head: lastSeq !== null && lastHash !== null ? { seq: lastSeq, entry_hash: lastHash } : null,
    first_bad_seq: null,
    reason: null,
    warnings,
  };
}

// --- export / sign ---------------------------------------------------------

export function buildAuditTrailExport(input: {
  workspace: string;
  exported_at: string;
  trail_starts_at?: string | null;
  entries: AuditTrailEntry[];
  verification: AuditTrailVerifyResult;
}): AuditTrailExportBody {
  if (input.entries.length > AUDIT_TRAIL_MAX_EXPORT_ENTRIES) {
    throw new AuditTrailTooLargeError(input.entries.length, AUDIT_TRAIL_MAX_EXPORT_ENTRIES);
  }
  return {
    format: AUDIT_TRAIL_EXPORT_FORMAT,
    workspace: input.workspace,
    exported_at: input.exported_at,
    trail_starts_at:
      input.trail_starts_at === undefined
        ? (input.entries[0]?.recorded_at ?? null)
        : input.trail_starts_at,
    verification: input.verification,
    entries: input.entries,
  };
}

export function signAuditTrailExport(body: AuditTrailExportBody, key: string): AuditTrailExport {
  if (typeof key !== "string" || key.trim() === "") {
    throw new Error("audit trail signing key is required");
  }
  const value = createHmac("sha256", key).update(canonicalJson(body), "utf8").digest("hex");
  return {
    ...body,
    signature: {
      alg: "hmac-sha256",
      key_id: auditTrailKeyId(key),
      value,
    },
  };
}

export function verifyAuditTrailExport(
  exported: AuditTrailExport,
  key: string,
): AuditTrailExportVerifyResult {
  if (typeof key !== "string" || key.trim() === "") {
    throw new Error("audit trail signing key is required");
  }

  const emptyChain: AuditTrailVerifyResult = {
    ok: true,
    checked: 0,
    head: null,
    first_bad_seq: null,
    reason: null,
    warnings: [],
  };

  if (
    !exported ||
    typeof exported !== "object" ||
    !exported.signature ||
    typeof exported.signature.key_id !== "string" ||
    typeof exported.signature.value !== "string"
  ) {
    const chain =
      exported && Array.isArray((exported as { entries?: unknown }).entries)
        ? verifyAuditTrail((exported as { entries: readonly unknown[] }).entries, {
            workspace: (exported as { workspace?: string }).workspace,
          })
        : emptyChain;
    return { ok: false, reason: "invalid_export", chain };
  }

  const chain = verifyAuditTrail(exported.entries ?? [], { workspace: exported.workspace });

  if (exported.signature.key_id !== auditTrailKeyId(key)) {
    return { ok: false, reason: "key_mismatch", chain };
  }

  const { signature: _sig, ...body } = exported;
  let actual: Buffer;
  try {
    actual = Buffer.from(exported.signature.value, "hex");
  } catch {
    return { ok: false, reason: "signature_mismatch", chain };
  }
  const expected = createHmac("sha256", key).update(canonicalJson(body), "utf8").digest();
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return { ok: false, reason: "signature_mismatch", chain };
  }

  if (!chain.ok) {
    return { ok: false, reason: "chain_invalid", chain };
  }

  return { ok: true, reason: null, chain };
}
