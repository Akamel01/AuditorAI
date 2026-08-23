// Public surface of the step-mode audit pipeline (N2).
export { AG_NODE_IDS, PAYLOAD_KINDS, PRODUCERS } from "@/domain/pipeline/types";
export type {
  AdjudicationDecision,
  AgNodeId,
  AuditArtifact,
  CandidatesSlice,
  NodeClass,
  NodeDescriptor,
  NodeFn,
  NodeResult,
  NodeRunCtx,
  PayloadKind,
  ProducerId,
  QuestionsSlice,
  SharedState,
  SliceName,
  StageContextSlice,
  ValidationStatus,
} from "@/domain/pipeline/types";
export type {
  AdjudicationSlice,
  EvidenceLinksetSlice,
  ManifestEntry,
  PersistenceRefSlice,
  ProjectInputSlice,
  ReportBundleSlice,
  RuleResultsSlice,
} from "@/domain/pipeline/types";
export {
  DefaultAuditPipeline,
  getPipeline,
  mergeState,
  type AuditPipeline,
  type PipelineRun,
} from "@/domain/pipeline/pipeline";
export { BATCH_NODES, DESCRIPTORS, NODE_FNS } from "@/domain/pipeline/registry";
export { validateRecommendationWording } from "@/domain/pipeline/wording";
