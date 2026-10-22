// The credential registry — rotatable and revocable bearer credentials that
// NEVER delete a row (plan §2 R2: "rotatable/revocable, no row deleted").
//
// Rotation writes a NEW credential row and marks the OLD one rotated; the
// tenant data it guards is untouched. Revocation sets revoked_at and leaves
// the tenant data intact. A revoked credential fails closed: it never falls
// back to the legacy store (D11).
//
// The hash is the EXISTING 16-hex workspaceHash(key)
// (src/lib/persistence/store.ts:236-240) — one derivation point (D10).
//
// Server-only: the credential GUC is set inside every transaction, because the
// credential policy is keyed on public.app_claim_credential_hash() (C1).

import { workspaceHash } from "@/lib/persistence/store";
import { CredentialRevokedError } from "./errors";
import { asDatabaseUnavailable, isSchemaNotApplied, tenantSqlClient } from "./identity";

/** The registry could not satisfy the request: an unknown credential, or a
 *  rotation whose target already exists. */
export class CredentialRegistryError extends Error {
  constructor(detail: string) {
    super(`credential registry: ${detail}`);
    this.name = "CredentialRegistryError";
  }
}

export interface CredentialRecord {
  credentialHash: string;
  workspaceId: string;
  subjectId: string;
  createdAt: string;
  revokedAt: string | null;
  rotatedAt: string | null;
}

interface CredentialRow {
  credential_hash: string;
  workspace_id: string;
  subject_id: string;
  created_at: Date | string;
  revoked_at: Date | string | null;
  rotated_at: Date | string | null;
}

function toRecord(row: CredentialRow): CredentialRecord {
  return {
    credentialHash: row.credential_hash,
    workspaceId: row.workspace_id,
    subjectId: row.subject_id,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    revokedAt: row.revoked_at === null ? null : row.revoked_at instanceof Date ? row.revoked_at.toISOString() : String(row.revoked_at),
    rotatedAt: row.rotated_at === null ? null : row.rotated_at instanceof Date ? row.rotated_at.toISOString() : String(row.rotated_at),
  };
}

const COLUMNS =
  "credential_hash, workspace_id, subject_id, created_at, revoked_at, rotated_at";

/** Revoke the presented credential: revoked_at is set, no row is deleted and
 *  the tenant data it guards stays intact. Revoking twice is a no-op. */
export async function revokeCredential(presentedCredential: string): Promise<CredentialRecord> {
  const credentialHash = workspaceHash(presentedCredential);
  const client = tenantSqlClient();
  let row: CredentialRow | undefined;
  try {
    row = await client.transaction(async (tx) => {
      await tx.query("select set_config('request.credential_hash', $1, true)", [credentialHash]);
      const res = await tx.query<CredentialRow>(
        `update public.workspace_credentials
            set revoked_at = coalesce(revoked_at, now())
          where credential_hash = $1
          returning ${COLUMNS}`,
        [credentialHash],
      );
      return res.rows[0];
    });
  } catch (err) {
    if (isSchemaNotApplied(err)) {
      throw new CredentialRegistryError("the tenant schema is not applied on this database");
    }
    throw asDatabaseUnavailable(err);
  }
  if (!row) {
    throw new CredentialRegistryError("unknown credential");
  }
  return toRecord(row);
}

/** Rotate the presented credential: the OLD row is marked rotated (never
 *  deleted) and a NEW row is written for the same workspace and subject. */
export async function rotateCredential(
  presentedCredential: string,
  nextCredential: string,
): Promise<{ previous: CredentialRecord; current: CredentialRecord }> {
  const previousHash = workspaceHash(presentedCredential);
  const nextHash = workspaceHash(nextCredential);
  if (previousHash === nextHash) {
    throw new CredentialRegistryError("the rotation target is the current credential");
  }
  const client = tenantSqlClient();

  let previous: CredentialRow | undefined;
  try {
    previous = await client.transaction(async (tx) => {
      // The OLD hash is presented: the credential policy is keyed on it, so
      // the row is visible to its own lookup and to its own update.
      await tx.query("select set_config('request.credential_hash', $1, true)", [previousHash]);
      const found = await tx.query<CredentialRow>(
        `select ${COLUMNS} from public.workspace_credentials where credential_hash = $1`,
        [previousHash],
      );
      const row = found.rows[0];
      if (!row) {
        throw new CredentialRegistryError("unknown credential");
      }
      if (row.revoked_at || row.rotated_at) {
        throw new CredentialRevokedError();
      }
       const updated = await tx.query<CredentialRow>(
         `update public.workspace_credentials
             set revoked_at = coalesce(revoked_at, now()),
                 rotated_at = now()
           where credential_hash = $1
           returning ${COLUMNS}`,
         [previousHash],
       );
      return updated.rows[0];
    });
  } catch (err) {
    if (err instanceof CredentialRegistryError || err instanceof CredentialRevokedError) {
      throw err;
    }
    if (isSchemaNotApplied(err)) {
      throw new CredentialRegistryError("the tenant schema is not applied on this database");
    }
    throw asDatabaseUnavailable(err);
  }

  let current: CredentialRow | undefined;
  try {
    current = await client.transaction(async (tx) => {
      // The NEW hash is presented: the insert policy requires the row's
      // credential_hash to equal the presented one.
      await tx.query("select set_config('request.credential_hash', $1, true)", [nextHash]);
      const res = await tx.query<CredentialRow>(
        `insert into public.workspace_credentials (credential_hash, workspace_id, subject_id)
         values ($1, $2, $3)
         on conflict (credential_hash) do nothing
         returning ${COLUMNS}`,
        [nextHash, previous.workspace_id, previous.subject_id],
      );
      return res.rows[0];
    });
  } catch (err) {
    if (isSchemaNotApplied(err)) {
      throw new CredentialRegistryError("the tenant schema is not applied on this database");
    }
    throw asDatabaseUnavailable(err);
  }
  if (!current) {
    throw new CredentialRegistryError("the rotation target already exists");
  }
  return { previous: toRecord(previous), current: toRecord(current) };
}
