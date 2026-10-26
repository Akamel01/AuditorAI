export class AuditTrailSigningNotConfiguredError extends Error {
  constructor() {
    super("audit trail signing not configured");
    this.name = "AuditTrailSigningNotConfiguredError";
  }
}

export function requireAuditTrailSigningKey(): string {
  const key = process.env.AUDIT_TRAIL_SIGNING_KEY;
  if (!key || key.trim() === "") {
    throw new AuditTrailSigningNotConfiguredError();
  }
  return key;
}
