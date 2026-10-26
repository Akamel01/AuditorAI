// Request actor resolution — the ONE place a request's actor is produced
// (OD2, OD3). Server-only.

import type { AuthSession } from "@/lib/auth/session";

import { userActor, legacyActor, type ActorId } from "@/domain/actor";

export function actorForRequest(session: AuthSession | null, legacyHash: string): ActorId {
  if (session) return userActor(session.subject);
  return legacyActor(legacyHash);
}
