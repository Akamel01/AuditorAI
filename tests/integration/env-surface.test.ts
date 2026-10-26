// M12 — every auth env name the code reads is declared in .env.example, and no
// value is ever committed (AC22).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const envExample = readFileSync(path.join(ROOT, ".env.example"), "utf8");

function declaredNames(source: string): string[] {
  const names = new Set<string>();
  for (const m of source.matchAll(/(?:env|flag)\("([A-Z0-9_]+)"\)/g)) names.add(m[1]!);
  for (const m of source.matchAll(/process\.env\.([A-Z0-9_]+)/g)) names.add(m[1]!);
  return [...names];
}

function isDeclared(name: string): boolean {
  return new RegExp(`^${name}=`, "m").test(envExample);
}

describe("env surface", () => {
  it("every auth config name is declared in .env.example", () => {
    const source = readFileSync(path.join(ROOT, "src/lib/auth/config.ts"), "utf8");
    const names = declaredNames(source);
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) expect(isDeclared(name), name).toBe(true);
  });

  it("the tenant-store and auth names are declared", () => {
    for (const name of [
      "SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_JWT_SECRET",
      "SUPABASE_SERVICE_ROLE_KEY",
      "SUPABASE_AUTH_ENABLED",
      "SUPABASE_AUTH_EMAIL_ENABLED",
      "SUPABASE_AUTH_GOOGLE_ENABLED",
      "SUPABASE_AUTH_MICROSOFT_ENABLED",
      "SUPABASE_AUTH_REDIRECT_ORIGIN",
    ]) {
      expect(isDeclared(name), name).toBe(true);
    }
  });

  it("no auth secret value is committed", () => {
    for (const line of envExample.split("\n")) {
      if (!/^[A-Z0-9_]+=/.test(line)) continue;
      const [name, ...rest] = line.split("=");
      if (!/SECRET|KEY|TOKEN|PASSWORD/.test(name!)) continue;
      expect(rest.join("=").trim(), name).toBe("");
    }
  });
});
