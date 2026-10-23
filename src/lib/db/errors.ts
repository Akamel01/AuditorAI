// Typed database errors (architecture report-t53.md §4.6). One class per
// outcome the error table in src/lib/api.ts maps (M4 owns that table).
// House style mirrors src/lib/persistence/store.ts:9-14.
//
// TenantHandleMismatchError is DROPPED (M1): it had no producer and no HTTP
// mapping, so it would have been a class nothing could throw.

/** The database is configured but unreachable — transport failure, timeout,
 *  5xx. Maps to 503, message redacted. */
export class DatabaseUnavailableError extends Error {
  constructor(detail: string) {
    super(`database unavailable: ${detail}`);
    this.name = "DatabaseUnavailableError";
  }
}

/** UNUSED BY DESIGN (plan section 9, deviation 1; critique n5). The
 *  "not configured" state is a NOTICE, not an outage: the legacy KV store
 *  still serves the request and the UI shows "database not configured"
 *  (architecture D9). This class is the documented one-line reversal to the
 *  hard 503 — raise it in src/lib/api.ts instead of falling back to legacy —
 *  so it is kept exported even though nothing throws it today. */
export class DatabaseNotConfiguredError extends Error {
  constructor(detail = "database not configured") {
    super(detail);
    this.name = "DatabaseNotConfiguredError";
  }
}

/** The presented credential is revoked. Maps to 401, message redacted. */
export class CredentialRevokedError extends Error {
  constructor(detail = "credential revoked") {
    super(detail);
    this.name = "CredentialRevokedError";
  }
}

/** The subject is not a member of the workspace. Maps to 403, message
 *  redacted. */
export class WorkspaceMembershipError extends Error {
  constructor(detail = "not a member of this workspace") {
    super(detail);
    this.name = "WorkspaceMembershipError";
  }
}

export class NotSignedInError extends Error {
  constructor(detail = "not signed in") {
    super(detail);
    this.name = "NotSignedInError";
  }
}

export class AuthNotConfiguredError extends Error {
  constructor(detail = "auth not configured") {
    super(detail);
    this.name = "AuthNotConfiguredError";
  }
}

export class ProviderNotConfiguredError extends Error {
  constructor(detail = "provider not configured") {
    super(detail);
    this.name = "ProviderNotConfiguredError";
  }
}

export class TenantStoreRequiredError extends Error {
  constructor(detail = "tenant store required") {
    super(detail);
    this.name = "TenantStoreRequiredError";
  }
}

export class SeatLimitExceededError extends Error {
  constructor(detail = "seat limit exceeded") {
    super(detail);
    this.name = "SeatLimitExceededError";
  }
}

export class NotWorkspaceAdminError extends Error {
  constructor(detail = "not a workspace admin") {
    super(detail);
    this.name = "NotWorkspaceAdminError";
  }
}

export class NoInvitationError extends Error {
  constructor(detail = "no invitation") {
    super(detail);
    this.name = "NoInvitationError";
  }
}
