import { describe, expect, it } from "vitest";
import {
  AUDIT_TRAIL_GENESIS_HASH,

  AUDIT_TRAIL_MAX_EXPORT_ENTRIES,
  AUDIT_TRAIL_MAX_EVIDENCE_REFS,
  AUDIT_TRAIL_ACTIONS,
  isAuditTrailAction,
  buildAuditTrailEntry,
  canonicalJson,
  sha256Hex,
  auditTrailPayloadHash,
  auditTrailEntryHash,
  auditTrailKeyId,
  evidenceRefsOf,
  verifyAuditTrail,
  buildAuditTrailExport,
  signAuditTrailExport,
  verifyAuditTrailExport,
  AuditTrailTooLargeError,
  type AuditTrailEntry,
  type AuditTrailSubject,
} from "@/domain/audit-trail";
import { userActor } from "@/domain/actor";

function makeEntry(seq: number, prev?: string): AuditTrailEntry {
  const subject: AuditTrailSubject = {
    type: "project",
    id: "p1",
    project_id: "p1",
    audit_id: null,
  };
  return buildAuditTrailEntry({
    workspace: "ws",
    seq,
    prev_hash: prev ?? (seq === 1 ? AUDIT_TRAIL_GENESIS_HASH : ""),
    recorded_at: "2026-01-01T00:00:00.000Z",
    actor: userActor("u1"),
    action: "project.saved",
    subject,
    evidence_refs: [],
    payload: { project_id: "p1" },
  });
}

describe("canonicalJson", () => {
  it("sorts keys recursively", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"b":1}');
  });
  it("preserves array order", () => {
    expect(canonicalJson([3, 1, 2])).toBe("[3,1,2]");
  });
  it("drops undefined properties", () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe('{"a":1}');
  });
  it("NFC vs NFD differ", () => {
    const nfc = "\u00e9";
    const nfd = "e\u0301";
    expect(sha256Hex(canonicalJson(nfc)).length).toBe(64);
    expect(canonicalJson(nfc)).not.toBe(canonicalJson(nfd));
  });
  it("converts -0 to 0", () => {
    expect(canonicalJson(-0)).toBe("0");
  });
  it("throws on non-finite", () => {
    expect(() => canonicalJson(Infinity)).toThrow(TypeError);
    expect(() => canonicalJson(NaN)).toThrow(TypeError);
  });
  it("throws on bigint/function/symbol", () => {
    expect(() => canonicalJson(BigInt(1) as unknown)).toThrow(TypeError);
    expect(() => canonicalJson(() => 1)).toThrow(TypeError);
    expect(() => canonicalJson(Symbol("x"))).toThrow(TypeError);
  });
  it("throws on class instances", () => {
    expect(() => canonicalJson(new Date())).toThrow(TypeError);
    expect(() => canonicalJson(new Map())).toThrow(TypeError);
    expect(() => canonicalJson(new Set())).toThrow(TypeError);
  });
  it("throws on undefined and undefined array elements", () => {
    expect(() => canonicalJson(undefined)).toThrow(TypeError);
    expect(() => canonicalJson([undefined])).toThrow(TypeError);
    expect(() => canonicalJson({ a: [undefined] })).toThrow(TypeError);
  });
  it("throws on sparse arrays", () => {
    expect(() => canonicalJson(Array(1))).toThrow(TypeError);
    expect(() => canonicalJson([, 1] as unknown)).toThrow(TypeError);
  });
  it("drops undefined object props before recursing", () => {
    expect(canonicalJson({ a: undefined })).toBe("{}");
  });
});

describe("build entry", () => {
  it("builds deterministic genesis entry", () => {
    const e = makeEntry(1);
    expect(e.seq).toBe(1);
    expect(e.prev_hash).toBe(AUDIT_TRAIL_GENESIS_HASH);
    expect(e.payload_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(e.entry_hash).toMatch(/^[0-9a-f]{64}$/);
  });
  it("write-side rejects non-writable actors", () => {
    const subject: AuditTrailSubject = { type: "project", id: "p1", project_id: "p1", audit_id: null };
    expect(() =>
      buildAuditTrailEntry({
        workspace: "ws",
        seq: 1,
        prev_hash: AUDIT_TRAIL_GENESIS_HASH,
        recorded_at: "2026-01-01T00:00:00.000Z",
        actor: "auditor" as never,
        action: "project.saved",
        subject,
        payload: {},
      }),
    ).toThrow();
    expect(() =>
      buildAuditTrailEntry({
        workspace: "ws",
        seq: 1,
        prev_hash: AUDIT_TRAIL_GENESIS_HASH,
        recorded_at: "2026-01-01T00:00:00.000Z",
        actor: "bogus" as never,
        action: "project.saved",
        subject,
        payload: {},
      }),
    ).toThrow();
  });
});

describe("shape invalid", () => {
  it("rejects empty object and bad prev_hash", () => {
    const r = verifyAuditTrail([{}]);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("invalid_shape");
    const e = makeEntry(1);
    const bad = { ...e, prev_hash: "x".repeat(64) };
    bad.entry_hash = auditTrailEntryHash(bad);
    const r2 = verifyAuditTrail([bad]);
    expect(r2.reason).toBe("invalid_shape");
  });
  it("rejects sparse evidence_refs", () => {
    const e = makeEntry(1);
    const bad = { ...e, evidence_refs: Array(2) as unknown as string[] };
    expect(verifyAuditTrail([bad]).reason).toBe("invalid_shape");
  });
  it("rejects empty subject id", () => {
    const e = makeEntry(1);
    const bad = { ...e, subject: { ...e.subject, id: "" } };
    bad.entry_hash = auditTrailEntryHash(bad);
    bad.payload_hash = auditTrailPayloadHash(bad.payload);
    const r = verifyAuditTrail([bad]);
    expect(r.reason).toBe("invalid_shape");
  });
  it("rejects non-plain payload/subject without throwing", () => {
    const e = makeEntry(1);
    const mapPayload = { ...e, payload: new Map() as unknown as AuditTrailEntry["payload"] };
    expect(() => verifyAuditTrail([mapPayload])).not.toThrow();
    expect(verifyAuditTrail([mapPayload]).reason).toBe("invalid_shape");
    const datePayload = { ...e, payload: new Date() as unknown as AuditTrailEntry["payload"] };
    expect(verifyAuditTrail([datePayload]).reason).toBe("invalid_shape");
    class Foo {}
    const classSubject = { ...e, subject: new Foo() as unknown as AuditTrailEntry["subject"] };
    expect(verifyAuditTrail([classSubject]).reason).toBe("invalid_shape");
  });
});

describe("constants", () => {
  it("genesis hash is 64 zeros", () => {
    expect(AUDIT_TRAIL_GENESIS_HASH).toBe("0".repeat(64));
  });
  it("build is deterministic", () => {
    const a = makeEntry(1);
    const b = makeEntry(1);
    expect(a.entry_hash).toBe(b.entry_hash);
  });
});

describe("verify", () => {
  it("verifies clean 3-entry chain", () => {
    const e1 = makeEntry(1);
    const e2 = buildAuditTrailEntry({
      workspace: "ws",
      seq: 2,
      prev_hash: e1.entry_hash,
      recorded_at: "2026-01-02T00:00:00.000Z",
      actor: userActor("u1"),
      action: "project.saved",
      subject: { type: "project", id: "p2", project_id: "p2", audit_id: null },
      payload: { project_id: "p2" },
    });
    const e3 = buildAuditTrailEntry({
      workspace: "ws",
      seq: 3,
      prev_hash: e2.entry_hash,
      recorded_at: "2026-01-03T00:00:00.000Z",
      actor: userActor("u1"),
      action: "project.saved",
      subject: { type: "project", id: "p3", project_id: "p3", audit_id: null },
      payload: { project_id: "p3" },
    });
    const r = verifyAuditTrail([e1, e2, e3]);
    expect(r.ok).toBe(true);
    expect(r.checked).toBe(3);
    expect(r.head).toEqual({ seq: 3, entry_hash: e3.entry_hash });
  });

  it("detects modified recorded field without recompute -> entry_hash_mismatch", () => {
    const e1 = makeEntry(1);
    for (const field of ["actor", "action", "recorded_at"] as const) {
      const tampered = { ...e1 } as AuditTrailEntry;
      if (field === "actor") tampered.actor = userActor("u2");
      if (field === "action") tampered.action = "audit.saved";
      if (field === "recorded_at") tampered.recorded_at = "2026-02-02T00:00:00.000Z";
      const r = verifyAuditTrail([tampered]);
      expect(r.reason).toBe("entry_hash_mismatch");
    }
    // subject mutation
    const s = { ...e1, subject: { ...e1.subject, id: "p2" } } as AuditTrailEntry;
    expect(verifyAuditTrail([s]).reason).toBe("entry_hash_mismatch");
  });

  it("detects genesis_mismatch", () => {
    const e1 = makeEntry(1);
    const forged = { ...e1, prev_hash: "a".repeat(64) } as AuditTrailEntry;
    forged.entry_hash = auditTrailEntryHash(forged);
    const r = verifyAuditTrail([forged]);
    expect(r.reason).toBe("genesis_mismatch");
  });

  it("detects modified payload with recomputed entry_hash -> payload_hash_mismatch (A-2)", () => {
    const e1 = makeEntry(1);
    const tamperedPayload = { ...e1.payload, project_id: "HACK" };
    const forged = { ...e1, payload: tamperedPayload };
    forged.entry_hash = auditTrailEntryHash(forged);
    const r = verifyAuditTrail([forged]);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("payload_hash_mismatch");
  });

  it("detects deleted middle entry -> seq_not_contiguous", () => {
    const e1 = makeEntry(1);
    const e2 = buildAuditTrailEntry({
      workspace: "ws",
      seq: 2,
      prev_hash: e1.entry_hash,
      recorded_at: "2026-01-02T00:00:00.000Z",
      actor: userActor("u1"),
      action: "project.saved",
      subject: { type: "project", id: "p2", project_id: "p2", audit_id: null },
      payload: { project_id: "p2" },
    });
    const e3 = buildAuditTrailEntry({
      workspace: "ws",
      seq: 3,
      prev_hash: e2.entry_hash,
      recorded_at: "2026-01-03T00:00:00.000Z",
      actor: userActor("u1"),
      action: "project.saved",
      subject: { type: "project", id: "p3", project_id: "p3", audit_id: null },
      payload: { project_id: "p3" },
    });
    const r = verifyAuditTrail([e1, e3]);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("seq_not_contiguous");
  });

  it("detects duplicate seq", () => {
    const e1 = makeEntry(1);
    const dup = { ...e1, seq: 1 } as AuditTrailEntry;
    dup.entry_hash = auditTrailEntryHash(dup);
    const r = verifyAuditTrail([e1, dup]);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("seq_not_contiguous");
  });

  it("detects lost prefix", () => {
    const e1 = makeEntry(1);
    const e2 = buildAuditTrailEntry({
      workspace: "ws",
      seq: 2,
      prev_hash: e1.entry_hash,
      recorded_at: "2026-01-02T00:00:00.000Z",
      actor: userActor("u1"),
      action: "project.saved",
      subject: { type: "project", id: "p2", project_id: "p2", audit_id: null },
      payload: { project_id: "p2" },
    });
    const r = verifyAuditTrail([e2]);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("seq_not_contiguous");
  });

  it("ignores array order but detects swapped contents", () => {
    const e1 = makeEntry(1);
    const e2 = buildAuditTrailEntry({
      workspace: "ws",
      seq: 2,
      prev_hash: e1.entry_hash,
      recorded_at: "2026-01-02T00:00:00.000Z",
      actor: userActor("u1"),
      action: "project.saved",
      subject: { type: "project", id: "p2", project_id: "p2", audit_id: null },
      payload: { project_id: "p2" },
    });
    const reordered = verifyAuditTrail([e2, e1]);
    expect(reordered.ok).toBe(true);
    // swapped contents: entry with seq 1 carries seq 2's hash chain -> entry hash mismatch
    const swapped = { ...e2, seq: 1, prev_hash: AUDIT_TRAIL_GENESIS_HASH } as AuditTrailEntry;
    swapped.entry_hash = auditTrailEntryHash(swapped);
    const r = verifyAuditTrail([swapped, e2]);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("prev_hash_mismatch");
  });

  it("returns only the first failure", () => {
    const e1 = makeEntry(1);
    const bad = { ...e1, actor: "bogus" as unknown as AuditTrailEntry["actor"] };
    // keep entry_hash stale so entry_hash_mismatch comes first
    const r = verifyAuditTrail([bad]);
    expect(r.reason).toBe("entry_hash_mismatch");
  });

  it("pins honest limit: a fully recomputed suffix verifies", () => {
    // An attacker who rewrites a suffix can recompute hashes; the chain cannot
    // detect this without an external head. Documented limit (OD3).
    const e1 = makeEntry(1);
    const forged2 = buildAuditTrailEntry({
      workspace: "ws",
      seq: 2,
      prev_hash: e1.entry_hash,
      recorded_at: "2026-01-02T00:00:00.000Z",
      actor: userActor("u1"),
      action: "project.saved",
      subject: { type: "project", id: "pX", project_id: "pX", audit_id: null },
      payload: { project_id: "pX" },
    });
    const r = verifyAuditTrail([e1, forged2]);
    expect(r.ok).toBe(true);
  });

  it("forged self-consistent entries (A-12)", () => {
    const base = makeEntry(1);
    // auditor -> warning, not failure
    const auditor = { ...base };
    auditor.actor = "auditor";
    auditor.payload_hash = auditTrailPayloadHash(auditor.payload);
    auditor.entry_hash = auditTrailEntryHash(auditor);
    const r1 = verifyAuditTrail([auditor]);
    expect(r1.ok).toBe(true);
    expect(r1.warnings).toContain("unattributed_actor");

    // bogus -> unresolvable_actor
    const bogus = { ...base };
    bogus.actor = "bogus" as unknown as typeof bogus.actor;
    bogus.payload_hash = auditTrailPayloadHash(bogus.payload);
    bogus.entry_hash = auditTrailEntryHash(bogus);
    const r2 = verifyAuditTrail([bogus]);
    expect(r2.ok).toBe(false);
    expect(r2.reason).toBe("unresolvable_actor");

    // workspace mismatch
    const wsm = { ...base, workspace: "other" };
    wsm.payload_hash = auditTrailPayloadHash(wsm.payload);
    wsm.entry_hash = auditTrailEntryHash(wsm);
    const r3 = verifyAuditTrail([wsm], { workspace: "ws" });
    expect(r3.ok).toBe(false);
    expect(r3.reason).toBe("workspace_mismatch");
  });

  it("empty chain ok + warning", () => {
    const r = verifyAuditTrail([]);
    expect(r.ok).toBe(true);
    expect(r.checked).toBe(0);
    expect(r.head).toBeNull();
    expect(r.warnings).toEqual(["empty_trail"]);
  });
});

describe("evidenceRefsOf", () => {
  it("sorts dedupes caps", () => {
    const refs = Array.from({ length: 510 }, (_, i) => `e${i}`);
    const source = {
      findings: [{ evidence: refs.map((r) => ({ evidence_id: r })) }],
      missing_information: [{ evidence_ids: ["e0", "dup"] }],
    };
    const out = evidenceRefsOf(source);
    expect(out.length).toBe(AUDIT_TRAIL_MAX_EVIDENCE_REFS);
    expect(out[0]).toBe("dup");
    expect(new Set(out).size).toBe(out.length);
  });
});

describe("signing", () => {
  it("signs and verifies with same key", () => {
    const e1 = makeEntry(1);
    const v = verifyAuditTrail([e1]);
    const body = buildAuditTrailExport({
      workspace: "ws",
      exported_at: "2026-01-01T00:00:00.000Z",
      entries: [e1],
      verification: v,
    });
    const key = "secret-key";
    const signed = signAuditTrailExport(body, key);
    expect(signed.signature.alg).toBe("hmac-sha256");
    expect(signed.signature.key_id).toBe(auditTrailKeyId(key));
    expect(signed.signature.key_id).toMatch(/^[0-9a-f]{8}$/);
    const r = verifyAuditTrailExport(signed, key);
    expect(r.ok).toBe(true);
    expect(r.reason).toBeNull();
  });

  it("key_mismatch on different key", () => {
    const e1 = makeEntry(1);
    const v = verifyAuditTrail([e1]);
    const body = buildAuditTrailExport({
      workspace: "ws",
      exported_at: "2026-01-01T00:00:00.000Z",
      entries: [e1],
      verification: v,
    });
    const signed = signAuditTrailExport(body, "key-a");
    const r = verifyAuditTrailExport(signed, "key-b");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("key_mismatch");
  });

  it("signature_mismatch on changed body", () => {
    const e1 = makeEntry(1);
    const v = verifyAuditTrail([e1]);
    const body = buildAuditTrailExport({
      workspace: "ws",
      exported_at: "2026-01-01T00:00:00.000Z",
      entries: [e1],
      verification: v,
    });
    const signed = signAuditTrailExport(body, "key");
    const tampered = { ...signed, exported_at: "2027-01-01T00:00:00.000Z" };
    tampered.signature = signed.signature;
    const r = verifyAuditTrailExport(tampered as typeof signed, "key");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("signature_mismatch");
  });

  it("reordered keys still verify (canonicalization)", () => {
    const e1 = makeEntry(1);
    const v = verifyAuditTrail([e1]);
    const body = buildAuditTrailExport({
      workspace: "ws",
      exported_at: "2026-01-01T00:00:00.000Z",
      entries: [e1],
      verification: v,
    });
    const signed = signAuditTrailExport(body, "key");
    // rebuild object with reordered top-level keys
    const reordered = {
      entries: signed.entries,
      format: signed.format,
      workspace: signed.workspace,
      exported_at: signed.exported_at,
      trail_starts_at: signed.trail_starts_at,
      verification: signed.verification,
      signature: signed.signature,
    } as typeof signed;
    const r = verifyAuditTrailExport(reordered, "key");
    expect(r.ok).toBe(true);
  });

  it("extra top-level field fails", () => {
    const e1 = makeEntry(1);
    const v = verifyAuditTrail([e1]);
    const body = buildAuditTrailExport({
      workspace: "ws",
      exported_at: "2026-01-01T00:00:00.000Z",
      entries: [e1],
      verification: v,
    });
    const signed = signAuditTrailExport(body, "key");
    const extra = { ...signed, extra: "x" } as typeof signed;
    const r = verifyAuditTrailExport(extra, "key");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("signature_mismatch");
  });

  it("invalid_export on missing/malformed signature", () => {
    const e1 = makeEntry(1);
    const v = verifyAuditTrail([e1]);
    const body = buildAuditTrailExport({
      workspace: "ws",
      exported_at: "2026-01-01T00:00:00.000Z",
      entries: [e1],
      verification: v,
    });
    const signed = signAuditTrailExport(body, "key");
    // missing signature
    const missing = { ...signed } as typeof signed;
    delete (missing as { signature?: unknown }).signature;
    expect(verifyAuditTrailExport(missing as typeof signed, "key").reason).toBe("invalid_export");
    // malformed signature value (wrong length) -> signature_mismatch
    const malformed = { ...signed, signature: { alg: "hmac-sha256", key_id: signed.signature.key_id, value: "zz" } };
    expect(verifyAuditTrailExport(malformed as typeof signed, "key").reason).toBe("signature_mismatch");
    // wrong alg
    const wrongAlg = { ...signed, signature: { ...signed.signature, alg: "rsa" } } as unknown as typeof signed;
    expect(verifyAuditTrailExport(wrongAlg, "key").reason).toBe("invalid_export");
  });

  it("chain_invalid on broken chain", () => {
    const e1 = makeEntry(1);
    const tampered = { ...e1, actor: userActor("u2") } as AuditTrailEntry;
    const v = verifyAuditTrail([tampered]);
    const body = buildAuditTrailExport({
      workspace: "ws",
      exported_at: "2026-01-01T00:00:00.000Z",
      entries: [tampered],
      verification: v,
    });
    const signed = signAuditTrailExport(body, "key");
    const r = verifyAuditTrailExport(signed, "key");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("chain_invalid");
    expect(r.chain.ok).toBe(false);
  });

  it("throws on empty/blank key for sign and verify", () => {
    const e1 = makeEntry(1);
    const v = verifyAuditTrail([e1]);
    const body = buildAuditTrailExport({
      workspace: "ws",
      exported_at: "2026-01-01T00:00:00.000Z",
      entries: [e1],
      verification: v,
    });
    expect(() => signAuditTrailExport(body, "")).toThrow(Error);
    const signed = signAuditTrailExport(body, "key");
    expect(() => verifyAuditTrailExport(signed, "  ")).toThrow(Error);
  });
});

describe("cap", () => {
  it("derives trail_starts_at from first entry when omitted", () => {
    const e1 = makeEntry(1);
    const v = verifyAuditTrail([e1]);
    const body = buildAuditTrailExport({
      workspace: "ws",
      exported_at: "2026-01-01T00:00:00.000Z",
      entries: [e1],
      verification: v,
    });
    expect(body.trail_starts_at).toBe(e1.recorded_at);
    const empty = buildAuditTrailExport({
      workspace: "ws",
      exported_at: "2026-01-01T00:00:00.000Z",
      entries: [],
      verification: verifyAuditTrail([]),
    });
    expect(empty.trail_starts_at).toBeNull();
  });

  it("accepts 20000 and rejects 20001", () => {
    const e1 = makeEntry(1);
    const okEntries: AuditTrailEntry[] = Array.from({ length: AUDIT_TRAIL_MAX_EXPORT_ENTRIES }, () => e1);
    const v = verifyAuditTrail([]);
    const body = buildAuditTrailExport({
      workspace: "ws",
      exported_at: "2026-01-01T00:00:00.000Z",
      trail_starts_at: e1.recorded_at,
      entries: okEntries,
      verification: v,
    });
    expect(body.entries.length).toBe(AUDIT_TRAIL_MAX_EXPORT_ENTRIES);
    expect(body.trail_starts_at).toBe(e1.recorded_at);

    const tooMany: AuditTrailEntry[] = Array.from({ length: AUDIT_TRAIL_MAX_EXPORT_ENTRIES + 1 }, () => e1);
    try {
      buildAuditTrailExport({
        workspace: "ws",
        exported_at: "2026-01-01T00:00:00.000Z",
        entries: tooMany,
        verification: v,
      });
      throw new Error("expected throw");
    } catch (err) {
      const e = err as AuditTrailTooLargeError;
      expect(e).toBeInstanceOf(AuditTrailTooLargeError);
      expect(e.count).toBe(AUDIT_TRAIL_MAX_EXPORT_ENTRIES + 1);
      expect(e.cap).toBe(AUDIT_TRAIL_MAX_EXPORT_ENTRIES);
    }
  });
});

describe("constants", () => {
  it("isAuditTrailAction", () => {
    expect(isAuditTrailAction("project.saved")).toBe(true);
    expect(isAuditTrailAction("nope")).toBe(false);
    expect(AUDIT_TRAIL_ACTIONS.length).toBe(6);
  });
});
