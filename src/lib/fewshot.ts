// Few-shot exemplar selection (ADR-0008 §3) over the compiled few-shot store
// (ADR-0011). Selection is a pure deterministic cascade: native_stage_id exact
// → canonical_stage → jurisdiction → global generic; k ≤ 3 exemplars per call;
// release-test/reserve inherited roles are excluded absolutely; same-programme
// clusters dedupe so one scheme cannot dominate a prompt. Only exemplar ids
// are returned — the caller stamps them into run logs and outcome rows.
import { readFileSync } from "node:fs";
import path from "node:path";
import type { CanonicalStage, JurisdictionId } from "@/domain/types";
import type { CandidateFindingRecord } from "@/domain/types";

/** Strictest role inherited from an exemplar's source samples (ADR-0011 §3);
 *  mirrors the ADR-0007 sample-corpus consumer roles. */
export type FewshotRole =
  | "engine-fewshot"
  | "judge-calibration"
  | "release-test"
  | "reserve"
  | "unassigned";

export interface FewshotRecord {
  exemplar_id: string;
  sample_ids: string[];
  jurisdiction: JurisdictionId;
  native_stage_id: string;
  canonical_stage: CanonicalStage | null;
  /** Programme cluster key (e.g. one corridor/scheme); deduped in selection. */
  programme?: string | null;
  inherited_role: FewshotRole;
  provenance_outcome_id: string | null;
  approved_by: string;
  approved_at: string;
  candidate_snapshot: CandidateFindingRecord;
}

export interface FewshotStore {
  schema_version: string;
  store_version: number;
  records: FewshotRecord[];
}

export interface FewshotQuery {
  jurisdiction: JurisdictionId;
  native_stage_id: string;
  canonical_stage: CanonicalStage | null;
}

export const FEWSHOT_STORE_PATH = "state/few-shot-store.json";

const EXCLUDED_ROLES: ReadonlySet<string> = new Set(["release-test", "reserve"]);
export const DEFAULT_FEWSHOT_K = 3;

function byExemplarId(a: FewshotRecord, b: FewshotRecord): number {
  return a.exemplar_id.localeCompare(b.exemplar_id);
}

/** Deterministic cascade select (pure): returns up to k exemplar ids, ordered
 *  native exact matches first, then canonical, then jurisdiction, then global
 *  generic fill; ids unique, programme clusters represented at most once. */
export function selectFewshots(
  query: FewshotQuery,
  store: FewshotStore,
  k: number = DEFAULT_FEWSHOT_K,
): string[] {
  const eligible = store.records.filter((r) => !EXCLUDED_ROLES.has(r.inherited_role));
  const canonicalTier =
    query.canonical_stage === null
      ? []
      : eligible.filter((r) => r.canonical_stage === query.canonical_stage);
  const tiers: FewshotRecord[][] = [
    eligible.filter((r) => r.native_stage_id === query.native_stage_id),
    canonicalTier,
    eligible.filter((r) => r.jurisdiction === query.jurisdiction),
    eligible,
  ];

  const chosenIds = new Set<string>();
  const seenProgrammes = new Set<string>();
  const selected: string[] = [];
  for (const tier of tiers) {
    for (const r of [...tier].sort(byExemplarId)) {
      if (selected.length >= k) return selected;
      if (chosenIds.has(r.exemplar_id)) continue;
      if (r.programme && seenProgrammes.has(r.programme)) continue;
      chosenIds.add(r.exemplar_id);
      if (r.programme) seenProgrammes.add(r.programme);
      selected.push(r.exemplar_id);
    }
  }
  return selected;
}

/** Runtime loader for the compiled store; absence degrades to null so the
 *  candidate path continues without exemplars (never blocks generation).
 *  Callers log the returned store_version alongside the selection. */
export function loadFewshotStore(
  filePath: string = path.join(process.cwd(), FEWSHOT_STORE_PATH),
): FewshotStore | null {
  try {
    const doc = JSON.parse(readFileSync(filePath, "utf8")) as FewshotStore;
    if (!doc || typeof doc.store_version !== "number" || !Array.isArray(doc.records)) {
      console.warn(`[fewshot] ${FEWSHOT_STORE_PATH} malformed; proceeding without exemplars`);
      return null;
    }
    return doc;
  } catch {
    console.warn(`[fewshot] ${FEWSHOT_STORE_PATH} missing/unreadable; proceeding without exemplars`);
    return null;
  }
}
