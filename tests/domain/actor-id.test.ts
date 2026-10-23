import { describe, expect, it } from "vitest";
import {
  userActor,
  legacyActor,
  adminActor,
  parseActorId,
  isWrittenActor,
  assertWritableActor,
  pendingSubjectFor,
} from "@/domain/actor";
import { tenantClaimJson } from "@/lib/db/claim";

describe("actor id", () => {
  it("constructors", () => {
    expect(userActor("abc")).toBe("u:abc");
    expect(legacyActor("0123456789abcdef")).toBe("legacy:0123456789abcdef");
    expect(adminActor("d")).toBe("admin:d");
  });

  it("parseActorId", () => {
    expect(parseActorId("auditor")).toEqual({ kind: "unattributed", id: "auditor" });
    expect(parseActorId("u:x")).toEqual({ kind: "user", id: "x" });
  });

  it("isWrittenActor", () => {
    expect(isWrittenActor("auditor")).toBe(false);
  });

  it("assertWritableActor throws on auditor", () => {
    expect(() => assertWritableActor("auditor")).toThrow();
    expect(assertWritableActor("u:x")).toBe("u:x");
  });

  it("two different legacy hashes produce two different ids", () => {
    expect(legacyActor("aaa")).not.toBe(legacyActor("bbb"));
  });

  it("pendingSubjectFor deterministic 16 hex and differs", () => {
    const a = pendingSubjectFor("a@example.com");
    const b = pendingSubjectFor("b@example.com");
    expect(a).toMatch(/^pending:[0-9a-f]{16}$/);
    expect(a).toBe(pendingSubjectFor("a@example.com"));
    expect(a).not.toBe(b);
  });

  it("tenantClaimJson emits exactly four fields", () => {
    const json = tenantClaimJson({
      sub: "s",
      workspace_id: "w",
      role: "member",
      email: "e@x.com",
    });
    const parsed = JSON.parse(json);
    expect(Object.keys(parsed)).toEqual(["sub", "workspace_id", "role", "email"]);
  });
});
