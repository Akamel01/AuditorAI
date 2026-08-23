// Node-internal artifact envelope helper shared across pipeline node modules.
import type {
  AgNodeId,
  AuditArtifact,
  NodeRunCtx,
  ProducerId,
  PayloadKind,
  ValidationStatus,
} from "@/domain/pipeline/types";

export function makeArtifact<P>(
  node: AgNodeId,
  producer: ProducerId,
  kind: PayloadKind,
  seq: number,
  ctx: NodeRunCtx,
  status: ValidationStatus,
  payload: P,
): AuditArtifact<P> {
  return {
    artifact_id: `ART-${node.replace(/^AG-/, "")}-${seq}`,
    node_id: node,
    producer,
    version: (ctx.versionStart ?? 1) + seq - 1,
    created_at: ctx.ranAtIso,
    validation_status: status,
    payload_kind: kind,
    payload,
  };
}
