// The ONE place that decides Postgres vs legacy (decision D1, architecture
// report-t53.md §4.4).
//
// There is no third adapter, no DataStore implementation for Postgres and no
// second wire protocol. The factory never decides on its own: it takes a
// resolution produced by resolveTenant (src/lib/db/identity.ts) and returns
// the adapter that resolution names.
//
// Fail-closed by construction: a configured-but-unreachable database raises
// DatabaseUnavailableError inside the resolution, so it never reaches this
// function — there is NO catch-and-retry against the KV store anywhere.
//
// Server-only.

import { Repository } from "@/lib/persistence";
import { getDataStore } from "@/lib/persistence/store";
import type { TenantRepository } from "./tenant-repository";
import { PostgresTenantRepository } from "./tenant-store";
import { tenantSqlClient, type TenantResolution } from "./identity";

/** The repository that serves one workspace. */
export function createTenantRepository(resolution: TenantResolution): TenantRepository {
  if (resolution.mode === "postgres") {
    return new PostgresTenantRepository(tenantSqlClient(), {
      workspaceId: resolution.workspaceId,
      subjectId: resolution.subjectId,
      legacyHash: resolution.legacyHash,
      role: resolution.subjectRole,
      email: null,
    });
  }
  // legacy: the KV store serves the workspace — not_configured,
  // not_migrated or schema_not_applied.
  return new Repository(getDataStore());
}
