// Server-only config gate for the tenant store (architecture report-t53.md §4.5).
// This module reads NO secret: the service-role names live in
// src/lib/db/admin.ts only (C4 — one owner, the privilege split is the point).
//
// Every accessor reads the environment at CALL time: there is no import-time
// env read that throws and no import-time network call, so the build succeeds
// with every variable unset.

/** NODE_ENV === "test" means "the database is not configured", always. A
 *  locally exported POSTGRES_URL must never open a real pool from a suite
 *  (critique m5 — vitest.config.ts blanks the vars too; this is the second
 *  half of the guarantee). */
function isTestEnv(): boolean {
  return process.env.NODE_ENV === "test";
}

/** A present, non-blank value or null. A blank value is "not set". */
function env(name: string): string | null {
  const value = process.env[name];
  return value && value.trim() ? value : null;
}

/** Is the Postgres tenant path configured at all? The cutover gate. */
export function isDatabaseConfigured(): boolean {
  return postgresUrl() !== null;
}

/** The pooled tenant connection string (the `auditorai_app` role). */
export function postgresUrl(): string | null {
  if (isTestEnv()) return null;
  return env("POSTGRES_URL");
}

/** The direct (non-pooled) connection string for admin/DDL/migration work. */
export function postgresUrlNonPooling(): string | null {
  if (isTestEnv()) return null;
  return env("POSTGRES_URL_NON_POOLING");
}

/** Platform metadata only — no consumer in #53. */
export function supabaseUrl(): string | null {
  return env("SUPABASE_URL") ?? env("NEXT_PUBLIC_SUPABASE_URL");
}

/** Public anon/publishable key — no consumer in #53. */
export function supabaseAnonKey(): string | null {
  return (
    env("NEXT_PUBLIC_SUPABASE_ANON_KEY") ?? env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
  );
}

/** Reserved for #54 (JWT subject verification). */
export function supabaseJwtSecret(): string | null {
  return env("SUPABASE_JWT_SECRET");
}

/** Listed for the platform, deliberately unconsumed: adopting an ORM is out of
 *  scope (R23 / architecture D8). */
export function postgresPrismaUrl(): string | null {
  return env("POSTGRES_PRISMA_URL");
}
