// The production adapter: a `pg` Pool over TENANT_POSTGRES_URL
// (architecture report-t53.md §3.4 and §4.1). Server-only — `pg` must never
// reach a client bundle.
import { Pool, type PoolClient } from "pg";
import {
  APP_ROLE,
  beginAppRoleTransaction,
  createRoleGuardedClient,
  type RawSql,
  type SqlClient,
  type SqlResult,
} from "./sql";
import { postgresUrl } from "./config";
import { DatabaseNotConfiguredError } from "./errors";

/** Normalise a Postgres URL: strip `pgbouncer` (node-postgres would send it as
 *  an unknown startup parameter), default `sslmode=require`, and trust the
 *  provider's certificate chain (the shape Supabase's own snippets use). */
export function normalizePostgresUrl(url: string): string {
  const parsed = new URL(url);
  parsed.searchParams.delete("pgbouncer");
  if (!parsed.searchParams.has("sslmode")) parsed.searchParams.set("sslmode", "require");
  return parsed.toString();
}

/** The role named in a connection string, or null when it carries none. */
export function roleFromConnectionString(url: string): string | null {
  try {
    const user = new URL(url).username;
    return user ? decodeURIComponent(user) : null;
  } catch {
    return null;
  }
}

/** The pool factory refuses to build for a connection string whose role is not
 *  the app role — an owner, a superuser or service_role would bypass RLS and
 *  make the policies decorative.
 *
 *  DB_ALLOW_OWNER=1 is the out-of-band OPERATOR override: read from the process
 *  env only, deliberately NOT a project env name (so it is not in .env.example
 *  and the env-surface count stays 10), and it VOIDS the isolation guarantee.
 *  It is documented in supabase/README.md (M1). */
export function assertAppRoleAllowed(url: string): void {
  if (process.env.DB_ALLOW_OWNER === "1") return;
  const role = roleFromConnectionString(url);
  // The Supabase pooler puts a tenant suffix after the role name
  // (auditorai_app.<ref>); treat the part before the first "." as the role.
  const baseRole = role ? role.split(".")[0] : null;
  if (baseRole === APP_ROLE) return;
  throw new Error(
    `refusing to build a pool for role '${role ?? "unknown"}': expected '${APP_ROLE}'. ` +
      `Point TENANT_POSTGRES_URL at the ${APP_ROLE} role, or set DB_ALLOW_OWNER=1 out of band ` +
      `(that override voids the isolation guarantee).`,
  );
}

function toRaw(client: PoolClient): RawSql {
  return {
    query: async <T>(sql: string, params?: readonly unknown[]) => {
      const res = await client.query(sql, params as unknown[]);
      return { rows: res.rows as T[] };
    },
  };
}

/** The `pg` adapter. `transaction` opens BEGIN, sets the app role locally,
 *  verifies it took, and hands the callback a role-guarded client — the
 *  callback cannot run a statement under a role that bypasses RLS. */
export class PgSqlClient implements SqlClient {
  constructor(private readonly pool: Pool) {}

  async query<T = unknown>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<SqlResult<T>> {
    // Run the statement inside a role-guarded transaction, exactly like the
    // pglite adapter: BEGIN; set local role auditorai_app; assert the role;
    // run the statement; COMMIT. Fail closed if the role is wrong.
    return this.transaction(async (tx) => tx.query<T>(sql, params));
  }

  async transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const raw = toRaw(client);
      await beginAppRoleTransaction(raw);
      const out = await fn(createRoleGuardedClient(raw));
      await client.query("commit");
      client.release();
      return out;
    } catch (err) {
      try {
        await client.query("rollback");
      } catch {
        /* the connection is already gone */
      }
      client.release(err as Error);
      throw err;
    }
  }
}

let poolSingleton: Pool | null = null;

/** Build a pool for the given URL. Refuses an owner URL unless DB_ALLOW_OWNER=1. */
function createPgPool(url: string): Pool {
  // The offline guarantee, moved here from config.ts so the cutover gate
  // stays testable: a suite can never open a real pool, whatever the
  // developer's shell exports.
  if (process.env.NODE_ENV === "test") {
    throw new DatabaseNotConfiguredError(
      "refusing to build a pool in a test environment",
    );
  }
  assertAppRoleAllowed(url);
  const normalized = normalizePostgresUrl(url);
  const sslDisabled = new URL(normalized).searchParams.get("sslmode") === "disable";
  return new Pool({
    connectionString: normalized,
    ssl: sslDisabled ? undefined : { rejectUnauthorized: false },
  });
}

/** The ambient pool, built on first use from TENANT_POSTGRES_URL. Throws
 *  DatabaseNotConfiguredError when the database is not configured. */
function getPgPool(): Pool {
  if (!poolSingleton) {
    const url = postgresUrl();
    if (!url) throw new DatabaseNotConfiguredError("TENANT_POSTGRES_URL is not set");
    poolSingleton = createPgPool(url);
  }
  return poolSingleton;
}

/** The production SqlClient over the ambient pool. */
export function createPgSqlClient(): SqlClient {
  return new PgSqlClient(getPgPool());
}

/** Close the ambient pool (CLI shutdown, test teardown). */
export async function closePgPool(): Promise<void> {
  if (!poolSingleton) return;
  const pool = poolSingleton;
  poolSingleton = null;
  await pool.end();
}
