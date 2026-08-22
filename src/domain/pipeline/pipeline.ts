// AuditPipeline seam (N1/N2): runAll is behavior-identical to the legacy
// engine (synchronous fold); runNode enables step-mode driving; describe()
// introspects the graph; persistRun performs the storage receipt.
import { BATCH_NODES, DESCRIPTORS, NODE_FNS } from "@/domain/pipeline/registry";
import { persistRun } from "@/domain/pipeline/nodes/persist";
import type {
  AgNodeId,
  AuditArtifact,
  NodeDescriptor,
  NodeResult,
  NodeRunCtx,
  PersistenceRefSlice,
  SharedState,
} from "@/domain/pipeline/types";
import type { DataStore } from "@/lib/persistence";
import type { AuditResult, Project } from "@/domain/types";

export interface PipelineRun {
  result: AuditResult;
  artifacts: AuditArtifact[];
  state: SharedState;
}

export interface AuditPipeline {
  /** Behavior-identical public entry point (legacy runAudit); synchronous. */
  runAll(project: Project, ranAtIso: string): AuditResult;
  /** Batch run that also returns the artifact trail and final shared state. */
  runAllArtifacts(project: Project, ranAtIso: string): PipelineRun;
  /** Execute a single node against a shared state; caller merges the patch. */
  runNode(nodeId: AgNodeId, state: SharedState, ctx: NodeRunCtx): NodeResult;
  /** Storage side effect for step mode; batch runs never persist. */
  persistRun(
    state: SharedState,
    store: DataStore,
    workspace: string,
    ctx: Pick<NodeRunCtx, "ranAtIso" | "versionStart">,
  ): Promise<{ patch: { persistence_ref: PersistenceRefSlice }; artifacts: AuditArtifact[] }>;
  /** Node descriptors for introspection (dev tab renders these live). */
  describe(): NodeDescriptor[];
  /** Empty starting state; AG-PROJECT seeds everything from ctx.project. */
  initialState(): SharedState;
}

export function mergeState(state: SharedState, patch: SharedState): SharedState {
  // Slices are replaced whole, never patched in place.
  return { ...state, ...patch };
}

export class DefaultAuditPipeline implements AuditPipeline {
  runAll(project: Project, ranAtIso: string): AuditResult {
    return this.runAllArtifacts(project, ranAtIso).result;
  }

  runAllArtifacts(project: Project, ranAtIso: string): PipelineRun {
    let state = this.initialState();
    const artifacts: AuditArtifact[] = [];
    for (const id of BATCH_NODES) {
      const res = this.runNode(id, state, {
        ranAtIso,
        project,
        versionStart: artifacts.length + 1,
      });
      state = mergeState(state, res.patch);
      artifacts.push(...res.artifacts);
    }
    if (!state.report_bundle) {
      throw new Error("pipeline batch run finished without a report bundle");
    }
    return { result: state.report_bundle.json, artifacts, state };
  }

  runNode(nodeId: AgNodeId, state: SharedState, ctx: NodeRunCtx): NodeResult {
    if (nodeId === "AG-PERSIST") {
      throw new Error("AG-PERSIST is async; call pipeline.persistRun instead");
    }
    const fn = NODE_FNS[nodeId];
    if (!fn) throw new Error(`unknown pipeline node: ${nodeId}`);
    return fn(state, ctx);
  }

  async persistRun(
    state: SharedState,
    store: DataStore,
    workspace: string,
    ctx: Pick<NodeRunCtx, "ranAtIso" | "versionStart">,
  ) {
    if (!state.report_bundle) {
      throw new Error("AG-PERSIST requires slice 'report_bundle' which is absent from SharedState");
    }
    return persistRun(state.report_bundle, store, workspace, ctx);
  }

  describe(): NodeDescriptor[] {
    return DESCRIPTORS.map((d) => ({ ...d }));
  }

  initialState(): SharedState {
    return {};
  }
}

let singleton: AuditPipeline | null = null;

export function getPipeline(): AuditPipeline {
  if (!singleton) singleton = new DefaultAuditPipeline();
  return singleton;
}
