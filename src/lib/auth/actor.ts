// Request actor resolution — the ONE place a request's actor is produced
// (OD2, OD3). Server-only.

import { readSession, type AuthSession } from "@/lib/auth/session";

import { userActor, legacyActor, adminActor, type ActorId } from "@/domain/actor";

export function resolveActor(req: Request): ActorId | null {
  const session = readSession(req);
  if (!session) return null;
  return userActor(session.subject);
}

export function actorForRequest(session: AuthSession | null, legacyHash: string): ActorId {
  if (session) return userActor(session.subject);
  return legacyActor(legacyHash);
}

export function legacyActorFor(ws: string): ActorId {
  return legacyActor(ws);
}

export function adminActorFor(digest: string): ActorId {
  return adminActor(digest);
}
