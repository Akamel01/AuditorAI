import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { actorForRequest } from "@/lib/auth/actor";
import { legacyActor, adminActor } from "@/domain/actor";

describe("actor", () => {
  it("the domain legacy actor is legacy:<16-hex>", () => {
    const v = legacyActor("abcdef0123456789");
    expect(v).toBe("legacy:abcdef0123456789");
  });

  it("the domain admin actor is admin:<digest>", () => {
    const v = adminActor("deadbeef");
    expect(v).toBe("admin:deadbeef");
  });

  it("actorForRequest with session returns u:<subject>", () => {
    const session = { subject: "subj-1", email: null, accessToken: "a", refreshToken: "r", expiresAt: 0 } as unknown as import("@/lib/auth/session").AuthSession;
    expect(actorForRequest(session, "hash")).toBe("u:subj-1");
  });

  it("actorForRequest without session returns legacy hash", () => {
    expect(actorForRequest(null, "abcdef0123456789")).toBe("legacy:abcdef0123456789");
  });

  it("module source has no POSTGRES_URL or DB_ALLOW_OWNER", () => {
    const src = readFileSync(new URL("../actor.ts", import.meta.url).pathname, "utf8");
    expect(src).not.toContain("POSTGRES_URL");
    expect(src).not.toContain("DB_ALLOW_OWNER");
  });
});
