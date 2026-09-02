// Sole owner of the physical key scheme (ADR-0001).
// Every persistence module imports from here; outside persistence, callers
// must use Repository.*Key/Prefix helpers (grep ws: outside persistence stays zero).

export function projectKey(ws: string, projectId: string): string {
  return `ws:${ws}:project:${projectId}`;
}
export function projectsPrefix(ws: string): string {
  return `ws:${ws}:project:`;
}
export function auditKey(ws: string, projectId: string, auditId: string): string {
  return `ws:${ws}:audit:${projectId}:${auditId}`;
}
export function auditsPrefix(ws: string, projectId: string): string {
  return `ws:${ws}:audit:${projectId}:`;
}
export function attachmentKey(ws: string, projectId: string, attachmentId: string): string {
  return `ws:${ws}:attachment:${projectId}:${attachmentId}`;
}
export function attachmentsPrefix(ws: string, projectId: string): string {
  return `ws:${ws}:attachment:${projectId}:`;
}
export function artifactKey(
  ws: string,
  projectId: string,
  auditId: string,
  nodeId: string,
  seq: number,
): string {
  return `ws:${ws}:art:${projectId}:${auditId}:${nodeId}:${seq}`;
}
export function artifactTrailPrefix(ws: string, projectId: string, auditId: string): string {
  return `ws:${ws}:art:${projectId}:${auditId}:`;
}
export function artifactSummaryKey(ws: string, projectId: string, auditId: string): string {
  return `${artifactTrailPrefix(ws, projectId, auditId)}_summary`;
}
export function issueKey(ws: string, projectId: string, auditId: string, rev: number): string {
  return `ws:${ws}:issue:${projectId}:${auditId}:${rev}`;
}
export function issuesPrefix(ws: string, projectId: string, auditId: string): string {
  return `ws:${ws}:issue:${projectId}:${auditId}:`;
}

export const artifactSeqOf = (key: string): number => {
  const n = Number.parseInt(key.slice(key.lastIndexOf(":") + 1), 10);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
};

export const DISCOVERY_DEDUPE_INDEX_KEY = "discovery:dedupe-index";
// R10: Deduplication index file seed path and helper key creator
export const DEDUPE_INDEX_PATH = "state/dedupe-index.json";
export function dedupeKvKey(name: string): string {
  return `dedupe:${name}`;
}
