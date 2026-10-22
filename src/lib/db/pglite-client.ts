// The offline adapter: @electric-sql/pglite, an in-process Postgres
// (architecture report-t53.md §4.1). Development and tests only — the package
// is a devDependency and never ships.
//
// The types are structural on purpose: pglite itself is not imported here, so
// no client bundle and no production dependency can reach it.

import {
  beginAppRoleTransaction,
  createRoleGuardedClient,
  type RawSql,
  type SqlClient,
  type SqlResult,
} from "./sql";

/** The pglite surface this adapter needs. */
export interface PgliteTransactionLike {
  query<T>(query: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

export interface PgliteLike {
  query<T>(query: string, params?: unknown[]): Promise<{ rows: T[] }>;
  transaction<T>(cb: (tx: PgliteTransactionLike) => Promise<T>): Promise<T>;
}

function toRaw(tx: PgliteTransactionLike): RawSql {
  return {
    query: async <T>(sql: string, params?: readonly unknown[]) => {
      const res = await tx.query<T>(sql, params as unknown[]);
      return { rows: res.rows };
    },
  };
}

/** The pglite adapter. pglite's `transaction` issues BEGIN/COMMIT (ROLLBACK on
 *  throw) around the callback, so `set local role` inside it is genuinely
 *  transaction-local. */
export function createPgliteSqlClient(db: PgliteLike): SqlClient {
  return {
    async query<T = unknown>(
      sql: string,
      params?: readonly unknown[],
    ): Promise<SqlResult<T>> {
      // pglite's default session is a superuser, so a bare query is run inside
      // a transaction that lowers the role — the same privilege the pg adapter
      // gets from the pinned pool role.
      return db.transaction(async (tx) => {
        const raw = toRaw(tx);
        await beginAppRoleTransaction(raw);
        const res = await raw.query<T>(sql, params);
        return { rows: res.rows };
      });
    },
    async transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
      return db.transaction(async (tx) => {
        const raw = toRaw(tx);
        await beginAppRoleTransaction(raw);
        return fn(createRoleGuardedClient(raw));
      });
    },
  };
}
