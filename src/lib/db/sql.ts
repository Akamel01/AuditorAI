// The one database seam the application learns (architecture report-t53.md §4.1).
// Two methods, one interface: the pg adapter and the pglite adapter both satisfy
// it, so a suite can inject an in-process Postgres and the same code paths run
// offline. No ORM, no query builder, no second wire protocol.

export interface SqlResult<T> {
  rows: T[];
}

/** The entire database interface the application learns. Two methods. */
export interface SqlClient {
  query<T = unknown>(sql: string, params?: readonly unknown[]): Promise<SqlResult<T>>;
  transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T>;
}

/** The non-owner, non-superuser role the tenant path runs as (R4). */
export const APP_ROLE = "auditorai_app";

/** The raw executor an adapter binds to one connection (a pg client, a pglite
 *  transaction handle). Adapters adapt their driver's result type to this. */
export interface RawSql {
  query<T = unknown>(sql: string, params?: readonly unknown[]): Promise<{ rows: T[] }>;
}

/** Fail closed. The statement runs only when the transaction really is
 *  `auditorai_app` (nosuperuser, nobypassrls, owns nothing). Any other role —
 *  owner, superuser, service_role — is refused, not warned about. */
async function assertAppRole(raw: RawSql): Promise<void> {
  const res = await raw.query<{ current_user: string }>("select current_user");
  const role = res.rows[0]?.current_user;
  if (role !== APP_ROLE) {
    throw new Error(
      `refusing to run a statement: transaction role is ${
        role ? `'${role}'` : "unknown"
      }, expected '${APP_ROLE}'`,
    );
  }
}

/** The transaction preamble (architecture §4.2). `set local role` is
 *  transaction-local, so it cannot leak into another session, and it fails
 *  outright when the connecting role is not a member of `auditorai_app` — that
 *  failure is the fail-closed path, not a warning. */
export async function beginAppRoleTransaction(raw: RawSql): Promise<void> {
  await raw.query("set local role auditorai_app");
  await assertAppRole(raw);
}

/** The transaction-scoped client handed to a transaction body: every statement
 *  goes through the role guard, so a callback cannot run a statement under a
 *  role that bypasses RLS. */
export function createRoleGuardedClient(raw: RawSql): SqlClient {
  return {
    async query<T>(sql: string, params?: readonly unknown[]): Promise<SqlResult<T>> {
      await assertAppRole(raw);
      const res = await raw.query<T>(sql, params);
      return { rows: res.rows };
    },
    async transaction<T>(): Promise<T> {
      throw new Error("nested transactions are not supported by the SQL seam");
    },
  };
}

let injectedClient: SqlClient | null = null;

/** Test-only seam: inject a client (e.g. the pglite adapter) so suites run
 *  offline. There is NO network fallback — an unset seam means "no client", so
 *  a suite can never reach a live endpoint by accident. Pass null to clear. */
export function setSqlClientForTests(client: SqlClient | null): void {
  injectedClient = client;
}

/** The injected client, or null. Never builds a pool and never touches the
 *  network. */
export function getInjectedSqlClient(): SqlClient | null {
  return injectedClient;
}
