// Actor vocabulary for ticket #54 (OD2, OD20-N5). One owner of every actor string.
import { createHash } from "node:crypto";

export type ActorKind = "user" | "workspace-credential" | "admin" | "unattributed";

export type ActorId = `u:${string}` | `legacy:${string}` | `admin:${string}`;

/** The READ union: the pre-#54 constant survives as a read value (historical rows only). */
export type AuditActor = ActorId | "auditor";

export function userActor(subjectId: string): ActorId {
  return `u:${subjectId}`;
}

export function legacyActor(legacyHash: string): ActorId {
  return `legacy:${legacyHash}`;
}

export function adminActor(digest: string): ActorId {
  return `admin:${digest}`;
}

export function parseActorId(value: string): { kind: ActorKind; id: string } | null {
  if (value === "auditor") return { kind: "unattributed", id: value };
  const colon = value.indexOf(":");
  if (colon <= 0) return null;
  const prefix = value.slice(0, colon);
  const id = value.slice(colon + 1);
  if (!id) return null;
  switch (prefix) {
    case "u":
      return { kind: "user", id };
    case "legacy":
      return { kind: "workspace-credential", id };
    case "admin":
      return { kind: "admin", id };
    default:
      return null;
  }
}

export function isWrittenActor(value: string): value is ActorId {
  return (
    value.startsWith("u:") ||
    value.startsWith("legacy:") ||
    value.startsWith("admin:")
  ) && value.length > 2;
}

/** The write-site guard (OD20-N5): "auditor" is a READ value; a write throws. */
export function assertWritableActor(value: string): ActorId {
  if (!isWrittenActor(value)) {
    throw new Error(`not a writable actor: ${value}`);
  }
  return value as ActorId;
}

/** The subject of a PENDING invitation (no user yet): `pending:<16-hex>`. */
export function pendingSubjectFor(email: string): string {
  const hash = createHash("sha256").update(email).digest("hex").slice(0, 16);
  return `pending:${hash}`;
}
