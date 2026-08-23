// Dev-tab server-side support (D3): run-scoped step sessions + DAG layout.
// Sessions are in-memory per server instance — acceptable for a developer
// console; state is returned to the client between calls so nothing durable
// depends on this Map.
import type { AuditArtifact, SharedState } from "@/domain/pipeline/types";
import type { Project } from "@/domain/types";
import { workspaceHash } from "@/lib/persistence";

const DEV_WORKSPACE_KEY = "dev-console";

/** One derivation point for the dev-console storage workspace: finish archives
 *  stepped runs there; replay reads them back. A presented workspace key
 *  (credential) overrides the default namespace; hashing stays behind the
 *  persistence seam — no route assembles namespaces itself. */
export function devWorkspaceHash(presentedKey?: string | null): string {
  return workspaceHash(presentedKey ?? DEV_WORKSPACE_KEY);
}

export interface DevRunSession {
  runId: string;
  project: Project;
  ranAtIso: string;
  state: SharedState;
  executed: { nodeId: string; artifactCount: number }[];
  /** Flat artifact trail accumulated across steps (what-if edits included). */
  artifacts: AuditArtifact[];
}

const sessions = new Map<string, DevRunSession>();
const MAX_SESSIONS = 32;

export function putSession(s: DevRunSession): void {
  if (sessions.size >= MAX_SESSIONS) {
    const oldest = sessions.keys().next().value;
    if (oldest) sessions.delete(oldest);
  }
  sessions.set(s.runId, s);
}
export function getSession(runId: string): DevRunSession | undefined {
  return sessions.get(runId);
}
export function dropSession(runId: string): void {
  sessions.delete(runId);
}
