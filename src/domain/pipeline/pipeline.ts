// AuditPipeline seam (N1/N2): runAll is behavior-identical to the legacy
// engine (synchronous fold); runNode enables step-mode driving; runNodeAsync
// is the registry-driven async dispatcher (ai-bounded nodes go live, the
// non-batch persistence node persists, everything else stays synchronous);
// describe() introspects the graph.
import { BATCH_NODES, DESCRIPTORS, NODE_FNS } from "@/domain/pipeline/registry";
import { persistRun } from "@/domain/pipeline/nodes/persist";
import { generateCandidatesLive } from "@/domain/pipeline/nodes/ai-candidates";
import { getAiAdapter, type AiAdapter, type CandidateVocabulary } from "@/lib/ai";
import type { DataStore } from "@/lib/persistence";
import type {
  AgNodeId,
  AuditArtifact,
  NodeDescriptor,
  NodeResult,
  NodeRunCtx,
  PersistenceRefSlice,
  SharedState,
} from "@/domain/pipeline/types";
import type { AuditResult, Project } from "@/domain/types";

export interface PipelineRun {
  result: AuditResult;
  artifacts: AuditArtifact[];
  state: SharedState;
}

/** I/O required to dispatch the persistence node through runNodeAsync. */
export interface PersistIo {
  store: DataStore;
  workspace: string;
}

export interface AsyncNodeOutcome {
  state: SharedState;
  artifacts: AuditArtifact[];
}

const WRITE_SCOPE = new Map<AgNodeId, Set<string>>(
  DESCRIPTORS.map((d) => [d.id, new Set<string>(d.writes)]),
);

function assertWriteScope(nodeId: AgNodeId, patch: SharedState): void {
  const allowed = WRITE_SCOPE.get(nodeId);
  if (!allowed) throw new Error(`unknown pipeline node: ${nodeId}`);
  const rogue = Object.keys(patch).filter((k) => !allowed.has(k));
  if (rogue.length > 0) {
    throw new Error(
      `${nodeId} attempted undeclared slice write(s): ${rogue.join(", ")}; declared writes: ${[...allowed].join(", ") || "none"}`,
    );
  }
}

export interface AuditPipeline {
  /** Behavior-identical public entry point (legacy runAudit); synchronous. */
  runAll(project: Project, ranAtIso: string): AuditResult;
  /** Batch run that also returns the artifact trail and final shared state. */
  runAllArtifacts(project: Project, ranAtIso: string): PipelineRun;
  /**
   * Async driver for live inference: identical fold, but ai-bounded nodes
   * await the adapter when live inference is permitted. Deterministic nodes
   * stay synchronous.
   */
  runAllLiveArtifacts(
    project: Project,
    ranAtIso: string,
    opts?: {
      aiAdapter?: AiAdapter;
      attachments?: { attachment_id: string; file_name: string; data_url: string }[];
      candidateVocabulary?: CandidateVocabulary;
    },
  ): Promise<PipelineRun>;
  /** Live driver returning just the AuditResult (report bundle JSON). */
  runAllLive(
    project: Project,
    ranAtIso: string,
    opts?: {
      aiAdapter?: AiAdapter;
      attachments?: { attachment_id: string; file_name: string; data_url: string }[];
      candidateVocabulary?: CandidateVocabulary;
    },
  ): Promise<AuditResult>;
  /** Execute a single node against a shared state; caller merges the patch. */
  runNode(nodeId: AgNodeId, state: SharedState, ctx: NodeRunCtx): NodeResult;
  /**
   * Registry-driven single-node dispatch. Version assignment is owned here:
   * versions seed from priorArtifacts.length, callers never thread them.
   * Behavior selection reads the registry descriptor: ai-bounded nodes run
   * live candidate generation when permitted; the node outside the batch
   * (persistence) runs persistRun via `io`; everything else is synchronous.
   */
  runNodeAsync(
    nodeId: AgNodeId,
    state: SharedState,
    ctx: Omit<NodeRunCtx, "versionStart">,
    priorArtifacts: readonly AuditArtifact[],
    io?: PersistIo,
  ): Promise<AsyncNodeOutcome>;
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

  async runAllLive(
    project: Project,
    ranAtIso: string,
    opts?: { aiAdapter?: AiAdapter },
  ): Promise<AuditResult> {
    return (await this.runAllLiveArtifacts(project, ranAtIso, opts)).result;
  }

  async runAllLiveArtifacts(
    project: Project,
    ranAtIso: string,
    opts?: {
      aiAdapter?: AiAdapter;
      attachments?: { attachment_id: string; file_name: string; data_url: string }[];
      candidateVocabulary?: CandidateVocabulary;
    },
  ): Promise<PipelineRun> {
    const adapter = opts?.aiAdapter;
    let state = this.initialState();
    const artifacts: AuditArtifact[] = [];
    for (const id of BATCH_NODES) {
      const out = await this.runNodeAsync(
        id,
        state,
        {
          ranAtIso,
          project,
          ...(adapter ? { aiAdapter: adapter } : {}),
          ...(adapter?.enabled ? { allowLiveInference: true } : {}),
          ...(opts?.attachments ? { attachments: opts.attachments } : {}),
          ...(opts?.candidateVocabulary
            ? { candidateVocabulary: opts.candidateVocabulary }
            : {}),
        },
        artifacts,
      );
      state = out.state;
      artifacts.push(...out.artifacts);
    }
    if (!state.report_bundle) {
      throw new Error("pipeline batch run finished without a report bundle");
    }
    return { result: state.report_bundle.json, artifacts, state };
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
    const res = fn(state, ctx);
    assertWriteScope(nodeId, res.patch);
    return res;
  }

  async runNodeAsync(
    nodeId: AgNodeId,
    state: SharedState,
    ctx: Omit<NodeRunCtx, "versionStart">,
    priorArtifacts: readonly AuditArtifact[],
    io?: PersistIo,
  ): Promise<AsyncNodeOutcome> {
    const descriptor = DESCRIPTORS.find((d) => d.id === nodeId);
    if (!descriptor) throw new Error(`unknown pipeline node: ${nodeId}`);
    const fullCtx: NodeRunCtx = { ...ctx, versionStart: priorArtifacts.length + 1 };

    let res: NodeResult;
    if (!descriptor.executed_in_batch) {
      if (!io) {
        throw new Error(`${nodeId} requires persistence io ({ store, workspace }) to dispatch`);
      }
      const persisted = await this.persistRun(state, io.store, io.workspace, {
        ranAtIso: fullCtx.ranAtIso,
        versionStart: fullCtx.versionStart,
      });
      res = persisted;
    } else if (
      descriptor.node_class === "ai-bounded" &&
      ctx.allowLiveInference &&
      (ctx.aiAdapter ?? getAiAdapter()).enabled
    ) {
      res = await generateCandidatesLive(state, fullCtx, ctx.aiAdapter ?? getAiAdapter());
    } else {
      res = this.runNode(nodeId, state, fullCtx);
    }
    assertWriteScope(nodeId, res.patch);
    return { state: mergeState(state, res.patch), artifacts: res.artifacts };
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
