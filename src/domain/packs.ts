// Policy pack loading + validation (deep module: ajv validation, evidence
// cross-checks and caching all live behind getPack/listJurisdictions).
// loadPack is injectable (io) so tests can exercise failure paths without a
// real filesystem.
import { readFileSync } from "node:fs";
import path from "node:path";
import Ajv from "ajv/dist/2020.js";
import { tryGetEvidence } from "@/lib/evidence";
import packSchema from "../../contracts/schemas/policy-pack.schema.json";
import type { JurisdictionId } from "./types";

export interface PolicyPack {
  schema_version: "1.0.0";
  pack_version: string;
  jurisdiction: JurisdictionId;
  jurisdiction_label: string;
  framework: {
    name: string;
    publisher: string;
    revision: string | null;
    publication_date: string | null;
    status:
      | "authoritative_current"
      | "recommended_practice"
      | "provincial_instruments"
      | "qualified_baseline"
      | "unknown_unavailable";
    qualification_note: string | null;
    stage_limitation_note?: string | null;
    evidence_ids: string[];
  };
  stages: {
    native_stage_id: string;
    display_name: string;
    definition: string;
    trigger: string | null;
    canonical_stages: ("FEASIBILITY_CONCEPT" | "PRELIMINARY_DESIGN" | "DETAILED_DESIGN")[];
    confidence: "authoritative" | "interpreted" | "inferred";
    mvp_scope: boolean;
    order: number;
    notes?: string | null;
    evidence_ids?: string[];
  }[];
  exceptions: {
    exception_id: string;
    kind: string;
    spans_native_stage_ids: string[];
    condition: string;
    alternative: string | null;
    evidence_ids: string[];
  }[];
  inputs: {
    input_id: string;
    stage_ids: string[];
    label: string;
    description?: string;
    requirement_level: "required" | "recommended" | "optional" | "unknown";
    conditional_on?: string | null;
    evidence_ids: string[];
  }[];
  outputs: {
    output_id: string;
    stage_ids: string[];
    label: string;
    description?: string;
    requirement_level: "required" | "recommended" | "optional" | "unknown";
    evidence_ids: string[];
  }[];
  audit_questions: {
    question_id: string;
    text: string;
    topic: string;
    applies_to_canonical: string[];
    road_users?: string[];
    source_note?: string;
  }[];
  rules: {
    rule_id: string;
    kind: "completeness" | "process" | "eligibility" | "output_discipline";
    description: string;
    applies_to_native_stage_ids: string[];
    requires_input_ids: string[];
    effects: { finding_kind: string };
    severity_hint?: string | null;
    evidence_ids: string[];
  }[];
  road_user_categories: string[];
  issue_categories: string[];
  sources: {
    title: string;
    publisher: string;
    url: string | null;
    revision: string | null;
    date: string | null;
    accessed: string | null;
    evidence_ids: string[];
  }[];
}

const PACK_DIRS: Record<JurisdictionId, string> = {
  INT: "international",
  UK: "uk",
  US: "usa",
  CA: "canada",
  AE: "uae",
};

export interface PackIo {
  cwd(): string;
  readUtf8(filePath: string): string;
}

const defaultPackIo: PackIo = {
  cwd: () => process.cwd(),
  readUtf8: (filePath) => readFileSync(filePath, "utf8"),
};

const ajv = new Ajv({ strict: false, allErrors: true });
const validatePack = ajv.compile<PolicyPack>(packSchema);

const cache = new Map<JurisdictionId, PolicyPack>();

export function listJurisdictions(): {
  id: JurisdictionId;
  label: string;
  framework_name: string;
  framework_status: PolicyPack["framework"]["status"];
}[] {
  return (Object.keys(PACK_DIRS) as JurisdictionId[]).map((id) => {
    const p = getPack(id);
    return {
      id,
      label: p.jurisdiction_label,
      framework_name: p.framework.name,
      framework_status: p.framework.status,
    };
  });
}

export function getPack(jurisdiction: JurisdictionId): PolicyPack {
  const cached = cache.get(jurisdiction);
  if (cached) return cached;
  const pack = loadPack(jurisdiction);
  cache.set(jurisdiction, pack);
  return pack;
}

/** Load + validate one pack without touching the cache; I/O is injectable. */
export function loadPack(
  jurisdiction: JurisdictionId,
  io: PackIo = defaultPackIo,
): PolicyPack {
  const file = path.join(io.cwd(), "policies", PACK_DIRS[jurisdiction], "pack.json");
  let raw: unknown;
  try {
    raw = JSON.parse(io.readUtf8(file));
  } catch (e) {
    throw new Error(`policy pack unreadable for ${jurisdiction}: ${String(e)}`);
  }
  if (!validatePack(raw)) {
    const errs = (validatePack.errors ?? [])
      .map((e) => `${e.instancePath} ${e.message}`)
      .join("; ");
    throw new Error(`policy pack invalid for ${jurisdiction}: ${errs}`);
  }
  const pack = raw as PolicyPack;

  // Deterministic integrity check: every evidence id cited by the pack must
  // exist in the compiled evidence registry.
  for (const rec of collectEvidenceIds(pack)) {
    if (!tryGetEvidence(rec)) {
      throw new Error(
        `policy pack ${jurisdiction} cites unknown evidence id ${rec}`,
      );
    }
  }

  return pack;
}

function collectEvidenceIds(pack: PolicyPack): Set<string> {
  const ids = new Set<string>();
  const push = (arr?: string[] | null) => (arr ?? []).forEach((x) => ids.add(x));
  push(pack.framework.evidence_ids);
  pack.stages.forEach((s) => push(s.evidence_ids));
  pack.exceptions.forEach((s) => push(s.evidence_ids));
  pack.inputs.forEach((s) => push(s.evidence_ids));
  pack.outputs.forEach((s) => push(s.evidence_ids));
  pack.rules.forEach((s) => push(s.evidence_ids));
  pack.sources.forEach((s) => push(s.evidence_ids));
  ids.delete("");
  return ids;
}
