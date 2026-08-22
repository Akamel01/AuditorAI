// Dev-tab server-side support (D3): run-scoped step sessions + DAG layout.
// Sessions are in-memory per server instance — acceptable for a developer
// console; state is returned to the client between calls so nothing durable
// depends on this Map.
import type { AgNodeId, AuditArtifact, NodeDescriptor, SharedState } from "@/domain/pipeline/types";
import type { Project } from "@/domain/types";

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

/** Longest-path layering for Candidate-A-style vertical rendering. */
export function buildLayers(descriptors: NodeDescriptor[]): NodeDescriptor[][] {
  const depth = new Map<string, number>();
  const byId = new Map(descriptors.map((d) => [d.id, d]));
  const resolve = (id: AgNodeId): number => {
    if (depth.has(id)) return depth.get(id)!;
    const d = byId.get(id);
    const val =
      !d || d.depends_on.length === 0
        ? 0
        : Math.max(...d.depends_on.map((dep) => resolve(dep) + 1));
    depth.set(id, val);
    return val;
  };
  descriptors.forEach((d) => resolve(d.id));

  const layers: NodeDescriptor[][] = [];
  for (const d of descriptors) {
    const idx = depth.get(d.id) ?? 0;
    (layers[idx] ||= []).push(d);
  }
  return layers.filter(Boolean);
}
