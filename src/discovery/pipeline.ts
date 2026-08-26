// Discovery pipeline driver (D01..D10). Mirrors src/domain/pipeline discipline:
// pure node functions, slices replaced whole, write-scope enforced, artifacts
// carry provenance. No conversational memory is authoritative state.
import type { CanonicalStage } from "@/domain/types";
import {
  DISCOVERY_NODE_IDS,
  type AcquisitionBundle,
  type DiscoveryArtifact,
  type DiscoveryHit,
  type DiscoveryNodeId,
  type DiscoverySharedState,
  type MatchAssignment,
  type PayloadKind,
  type ProjectPackageAssembly,
  type ProvenanceRecord,
  type QualityVerdictRecord,
} from "@/discovery/types";
import { sha256Hex } from "@/discovery/ids";
import { qualifyHits } from "@/discovery/qualifier";
import { matchQualified } from "@/discovery/matcher";
import { classifyBundle } from "@/discovery/classifier";
import { assemblePackage } from "@/discovery/packager";
import { writeProvenance } from "@/discovery/provenance";
import { checkDuplicate, claimFingerprints, emptyDedupeIndex, type DedupeIndexDoc } from "@/discovery/dedupe";
import { buildQueue, computeCoverage } from "@/discovery/coverage";
import { getDrawingProcessor } from "@/discovery/drawing";
import type { DiscoverQuery, DiscoveryProvider } from "@/discovery/providers/provider-types";

export interface RawDocument {
  url: string;
  bytes: Uint8Array;
  mime: "application/pdf" | "image/png" | "image/jpeg" | "image/webp";
}

export interface DiscoveryCtx {
  ranAtIso: string;
  query: DiscoverQuery;
  providers: DiscoveryProvider[];
  /** Supplies raw documents for a match (live: provider.fetch; dry-run: fixture). */
  acquireDocs?: (match: MatchAssignment) => Promise<RawDocument[]>;
  dedupeIndex?: DedupeIndexDoc;
}

export interface NodeResult {
  patch: DiscoverySharedState;
  artifacts: DiscoveryArtifact[];
  refusals?: string[];
}

const WRITES: Record<DiscoveryNodeId, (keyof DiscoverySharedState)[]> = {
  "D01-DISCOVER": ["discovery_hits"],
  "D02-QUALIFY": ["qualified"],
  "D03-MATCH": ["matched"],
  "D04-ACQUIRE": ["acquired"],
  "D05-CLASSIFY": ["classified"],
  "D06-PACKAGE": ["package"],
  "D07-PROVENANCE": ["provenance"],
  "D08-QUALITY": ["quality"],
  "D09-COVERAGE": ["coverage"],
  "D10-QUEUE": ["queue"],
};

function assertWriteScope(nodeId: DiscoveryNodeId, patch: DiscoverySharedState): void {
  const allowed = new Set(WRITES[nodeId]);
  const rogue = Object.keys(patch).filter((k) => !allowed.has(k as keyof DiscoverySharedState));
  if (rogue.length > 0) {
    throw new Error(`${nodeId} attempted undeclared slice writes: ${rogue.join(", ")}`);
  }
}

function artifact<P>(nodeId: DiscoveryNodeId, payload_kind: PayloadKind, ranAtIso: string, payload: P, n = 1): DiscoveryArtifact<P> {
  return {
    artifact_id: `${nodeId}:${payload_kind}:${n}`,
    node_id: nodeId,
    payload_kind,
    validation_status: "verified",
    created_at: ranAtIso,
    payload,
  };
}

// ---- Nodes --------------------------------------------------------------------

function d01Discover(ctx: DiscoveryCtx): Promise<NodeResult> {
  return (async () => {
    const hits: DiscoveryHit[] = [];
    for (const provider of ctx.providers) {
      const found = await provider.discover(ctx.query);
      hits.push(...found);
    }
    // Cross-provider URL collapse: same URL discovered twice keeps first hit.
    const byUrl = new Map<string, DiscoveryHit>();
    for (const h of hits) if (!byUrl.has(h.url)) byUrl.set(h.url, h);
    const unique = [...byUrl.values()];
    return {
      patch: { discovery_hits: unique },
      artifacts: [artifact("D01-DISCOVER", "discovery.hitset", ctx.ranAtIso, unique)],
    };
  })();
}

function d02Qualify(state: DiscoverySharedState, ctx: DiscoveryCtx): NodeResult {
  const qualified = qualifyHits(state.discovery_hits ?? []);
  return {
    patch: { qualified },
    artifacts: [artifact("D02-QUALIFY", "qualification.verdicts", ctx.ranAtIso, qualified)],
  };
}

function d03Match(state: DiscoverySharedState, ctx: DiscoveryCtx): NodeResult {
  const assignments: MatchAssignment[] = [];
  const refusals: string[] = [];
  for (const q of state.qualified ?? []) {
    if (q.verdict !== "in_scope") continue;
    const outcome = matchQualified(q);
    if (outcome.assignment && outcome.assignment.odd_status) assignments.push(outcome.assignment);
    if (outcome.refusal_reason) refusals.push(`${q.qualification_id}: ${outcome.refusal_reason}`);
  }
  return {
    patch: { matched: assignments },
    artifacts: [artifact("D03-MATCH", "match.assignments", ctx.ranAtIso, assignments)],
    refusals,
  };
}

async function d04Acquire(state: DiscoverySharedState, ctx: DiscoveryCtx): Promise<NodeResult> {
  const bundles: AcquisitionBundle[] = [];
  let seq = 0;
  for (const match of state.matched ?? []) {
    let docs: RawDocument[];
    if (ctx.acquireDocs) {
      docs = await ctx.acquireDocs(match);
    } else {
      // Live fallback: fetch the originating hit URL (single PDF per hit for now)
      const qual = (state.qualified ?? []).find((q) => q.qualification_id === match.qualification_id);
      const hit = qual ? (state.discovery_hits ?? []).find((h) => h.hit_id === qual.hit_id) : undefined;
      if (!hit) {
        docs = [];
      } else {
        const { withHostBudget } = await import("@/discovery/ratelimit");
        try {
          const fetched = await withHostBudget(hit.url, async () => {
            const res = await fetch(hit.url, { headers: { Accept: "application/pdf,*/*" } });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const buf = new Uint8Array(await res.arrayBuffer());
            const ct = res.headers.get("content-type") ?? "";
            // Validate %PDF magic
            const head = new TextDecoder().decode(buf.slice(0, 5));
            if (!head.startsWith("%PDF") && !ct.includes("pdf")) {
              throw new Error(`not a PDF (content-type ${ct}, head ${head.slice(0, 20)})`);
            }
            return buf;
          });
          docs = [{ url: hit.url, bytes: fetched, mime: "application/pdf" }];
        } catch (e) {
          console.warn(`[d04] fetch failed for ${hit.url}: ${e instanceof Error ? e.message : String(e)}`);
          docs = [];
        }
      }
    }
    const processor = getDrawingProcessor();
    const acquiredDocs = [] as AcquisitionBundle["documents"];
    for (const doc of docs) {
      seq += 1;
      let page_count = 0;
      let text_sha256: string | null = null;
      let engine = "passthrough";
      if (doc.mime === "application/pdf") {
        const extracted = await processor.extractPdf(doc.bytes);
        page_count = extracted.page_count;
        text_sha256 = extracted.text_sha256;
        engine = extracted.engine;
      } else {
        text_sha256 = sha256Hex(doc.bytes);
        page_count = 1;
        engine = "raw-bytes";
      }
      // Propagate the originating hit title for classification (URL alone loses audit keywords after encoding)
      const hitTitle = (() => {
        const qualForMatch = (state.qualified ?? []).find((q) => q.qualification_id === match.qualification_id);
        const hitForQual = qualForMatch ? (state.discovery_hits ?? []).find((h) => h.hit_id === qualForMatch.hit_id) : undefined;
        return hitForQual?.title_hint ?? null;
      })();
      acquiredDocs.push({
        doc_id: `DOC-${sha256Hex(`${match.match_id}|${doc.url}`).slice(0, 16)}`,
        url: doc.url,
        title_hint: hitTitle,
        sha256: sha256Hex(doc.bytes),
        bytes: doc.bytes.byteLength,
        mime: doc.mime,
        page_count,
        pages: Array.from({ length: page_count }, (_, i) => ({
          page_no: i + 1,
          png_sha256: null,
          ocr_sha256: null,
          ocr_conf: null,
        })),
        extraction: { engine, text_sha256 },
      });
    }
    bundles.push({ bundle_id: `ACQ-${sha256Hex(match.match_id).slice(0, 16)}`, match_id: match.match_id, documents: acquiredDocs });
  }
  void seq;
  return {
    patch: { acquired: bundles },
    artifacts: [artifact("D04-ACQUIRE", "acquisition.bundles", ctx.ranAtIso, bundles)],
  };
}

function d05Classify(state: DiscoverySharedState, ctx: DiscoveryCtx): NodeResult {
  const labelsets = (state.acquired ?? []).map((b) => classifyBundle(b));
  return {
    patch: { classified: labelsets },
    artifacts: [artifact("D05-CLASSIFY", "classification.labelsets", ctx.ranAtIso, labelsets)],
  };
}

function d06Package(state: DiscoverySharedState, ctx: DiscoveryCtx): NodeResult {
  const hitById = new Map((state.discovery_hits ?? []).map((h) => [h.hit_id, h]));
  const qualById = new Map((state.qualified ?? []).map((q) => [q.qualification_id, q]));
  const bundleByMatch = new Map((state.acquired ?? []).map((b) => [b.match_id, b]));
  const labelsetByBundle = new Map((state.classified ?? []).map((l) => [l.bundle_id, l]));

  const packages: ProjectPackageAssembly[] = [];
  for (const match of state.matched ?? []) {
    const qual = qualById.get(match.qualification_id);
    const bundle = bundleByMatch.get(match.match_id);
    const labels = bundle ? labelsetByBundle.get(bundle.bundle_id) : undefined;
    if (!qual || !bundle || !labels) continue;
    if (bundle.documents.length === 0) continue; // nothing fetched — don't emit an empty package
    const pkg = assemblePackage(match, qual, labels);
    const urls = new Set<string>();
    const hit = hitById.get(qual.hit_id);
    if (hit) urls.add(hit.url);
    for (const d of bundle.documents) urls.add(d.url);
    pkg.metadata.source_urls = [...urls];
    packages.push(pkg);
  }
  return {
    patch: { package: packages },
    artifacts: [artifact("D06-PACKAGE", "package.assemblies", ctx.ranAtIso, packages)],
  };
}

function d07Provenance(state: DiscoverySharedState, ctx: DiscoveryCtx): NodeResult {
  const records: ProvenanceRecord[] = [];
  const matchedById = new Map((state.matched ?? []).map((m) => [m.match_id, m]));
  const labelsByBundle = new Map((state.classified ?? []).map((l) => [l.bundle_id, l]));
  for (const pkg of state.package ?? []) {
    const match = matchedById.get(pkg.match_id);
    const bundle = (state.acquired ?? []).find((b) => b.match_id === pkg.match_id);
    const labels = bundle ? labelsByBundle.get(bundle.bundle_id) : undefined;
    if (!match || !bundle || !labels) continue;
    records.push(
      writeProvenance({
        pkg,
        match,
        labels,
        sha256Chain: bundle.documents.map((d) => ({ doc_id: d.doc_id, sha256: d.sha256 })),
        retrievedAtIso: ctx.ranAtIso,
      }),
    );
  }
  return {
    patch: { provenance: records },
    artifacts: [artifact("D07-PROVENANCE", "provenance.records", ctx.ranAtIso, records)],
  };
}

function d08Quality(state: DiscoverySharedState, ctx: DiscoveryCtx): NodeResult {
  const index: DedupeIndexDoc = ctx.dedupeIndex ? structuredClone(ctx.dedupeIndex) : emptyDedupeIndex();
  const verdicts: QualityVerdictRecord[] = [];
  const bundleByMatch = new Map((state.acquired ?? []).map((b) => [b.match_id, b]));
  for (const pkg of state.package ?? []) {
    const bundle = bundleByMatch.get(pkg.match_id)!;
    const verdict = checkDuplicate(pkg, bundle, index);
    const reasons: string[] = [];
    if (verdict.status !== "unique") reasons.push(`${verdict.status} of ${verdict.canonical_package_id}`);
    const humanRequired =
      pkg.completeness === "full-package" &&
      (state.provenance ?? []).find((p) => p.package_id === pkg.package_id)?.licence === "unknown";
    if (humanRequired) reasons.push("full-package with unknown licence — owner review before ODD proof use");
    verdicts.push({
      package_id: pkg.package_id,
      completeness: pkg.completeness,
      dedupe_status: verdict.status,
      canonical_package_id: verdict.canonical_package_id,
      quality_score: verdict.status === "unique" ? 1 : 0,
      human_required: humanRequired || verdict.status !== "unique",
      reasons,
    });
    if (verdict.status === "unique") claimFingerprints(pkg, bundle, index);
  }
  return {
    patch: { quality: verdicts },
    artifacts: [artifact("D08-QUALITY", "quality.verdicts", ctx.ranAtIso, verdicts)],
  };
}

function d09Coverage(state: DiscoverySharedState, ctx: DiscoveryCtx): NodeResult {
  const matchedById = new Map((state.matched ?? []).map((m) => [m.match_id, m]));
  const packaged = (state.package ?? [])
    .map((pkg) => {
      const match = matchedById.get(pkg.match_id);
      return match
        ? { pkg, match: { ...match, canonical_stages: match.canonical_stages as CanonicalStage[] } }
        : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  const view = computeCoverage(packaged, ctx.ranAtIso);
  return {
    patch: { coverage: view },
    artifacts: [artifact("D09-COVERAGE", "coverage.view", ctx.ranAtIso, view)],
  };
}

function d10Queue(state: DiscoverySharedState, ctx: DiscoveryCtx): NodeResult {
  const items = buildQueue(state.coverage!);
  return {
    patch: { queue: items },
    artifacts: [artifact("D10-QUEUE", "queue.items", ctx.ranAtIso, items)],
  };
}

// ---- Driver -------------------------------------------------------------------

export interface DiscoveryRunOutcome {
  state: DiscoverySharedState;
  artifacts: DiscoveryArtifact[];
  refusals: string[];
}

export async function runDiscoveryPipeline(ctx: DiscoveryCtx): Promise<DiscoveryRunOutcome> {
  let state: DiscoverySharedState = {};
  const artifacts: DiscoveryArtifact[] = [];
  let refusals: string[] = [];

  const step = async (id: DiscoveryNodeId, fn: () => Promise<NodeResult> | NodeResult) => {
    const res = await fn();
    assertWriteScope(id, res.patch);
    state = { ...state, ...res.patch };
    artifacts.push(...res.artifacts);
    if (res.refusals?.length) refusals = [...refusals, ...res.refusals];
  };

  await step("D01-DISCOVER", () => d01Discover(ctx));
  await step("D02-QUALIFY", () => d02Qualify(state, ctx));
  await step("D03-MATCH", () => d03Match(state, ctx));
  await step("D04-ACQUIRE", () => d04Acquire(state, ctx));
  await step("D05-CLASSIFY", () => d05Classify(state, ctx));
  await step("D06-PACKAGE", () => d06Package(state, ctx));
  await step("D07-PROVENANCE", () => d07Provenance(state, ctx));
  await step("D08-QUALITY", () => d08Quality(state, ctx));
  await step("D09-COVERAGE", () => d09Coverage(state, ctx));
  await step("D10-QUEUE", () => d10Queue(state, ctx));

  return { state, artifacts, refusals };
}

/** Single-node execution with scope enforcement (step-mode / tests). */
export async function runDiscoveryNode(
  nodeId: DiscoveryNodeId,
  state: DiscoverySharedState,
  ctx: DiscoveryCtx,
): Promise<NodeResult> {
  let res: NodeResult;
  switch (nodeId) {
    case "D01-DISCOVER": res = await d01Discover(ctx); break;
    case "D02-QUALIFY": res = d02Qualify(state, ctx); break;
    case "D03-MATCH": res = d03Match(state, ctx); break;
    case "D04-ACQUIRE": res = await d04Acquire(state, ctx); break;
    case "D05-CLASSIFY": res = d05Classify(state, ctx); break;
    case "D06-PACKAGE": res = d06Package(state, ctx); break;
    case "D07-PROVENANCE": res = d07Provenance(state, ctx); break;
    case "D08-QUALITY": res = d08Quality(state, ctx); break;
    case "D09-COVERAGE": res = d09Coverage(state, ctx); break;
    case "D10-QUEUE": res = d10Queue(state, ctx); break;
    default: throw new Error(`unknown discovery node ${String(nodeId)}`);
  }
  assertWriteScope(nodeId, res.patch);
  return res;
}

export function describeDiscoveryNodes(): { id: DiscoveryNodeId; writes: readonly string[] }[] {
  return DISCOVERY_NODE_IDS.map((id) => ({ id, writes: WRITES[id] }));
}
