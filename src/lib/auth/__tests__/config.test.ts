import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { authConfigured, enabledProviders } from "@/lib/auth/config";

describe("auth config", () => {
  const saved: Record<string, string | undefined> = {};
  const keys = [
    "SUPABASE_AUTH_ENABLED",
    "SUPABASE_AUTH_EMAIL_ENABLED",
    "SUPABASE_AUTH_GOOGLE_ENABLED",
    "SUPABASE_AUTH_MICROSOFT_ENABLED",
    "SUPABASE_AUTH_REDIRECT_ORIGIN",
    "SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_JWT_SECRET",
  ];

  beforeEach(() => {
    for (const k of keys) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("unconfigured with no env", () => {
    expect(authConfigured()).toBe(false);
    expect(enabledProviders()).toEqual([]);
  });

  it("email only with master + email flag", () => {
    process.env.SUPABASE_AUTH_ENABLED = "true";
    process.env.SUPABASE_AUTH_EMAIL_ENABLED = "true";
    expect(enabledProviders()).toEqual(["email"]);
  });

  it("google not offered without redirect origin", () => {
    process.env.SUPABASE_AUTH_ENABLED = "true";
    process.env.SUPABASE_AUTH_GOOGLE_ENABLED = "true";
    expect(enabledProviders()).not.toContain("google");
  });

  it("config module does not name service-role env var", () => {
    const src = readFileSync(process.cwd() + "/src/lib/auth/config.ts", "utf8");
    const forbidden = ["SUPABASE_" + "SERVICE_ROLE_KEY", "SUPABASE_" + "SECRET_KEY"];
    for (const name of forbidden) {
      expect(src).not.toContain(name);
    }
  });
});
