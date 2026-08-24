// ODD declaration resolution (ADR-0005 / DEC-0006; declaration log in ADR-0005).
// Membership is conjunctive and default-refuse: a selection absent from the
// matrix is outside the domain, whatever its pack says. Deep module: schema
// validation, caching and cell matching live behind resolveOdd.
import { readFileSync } from "node:fs";
import path from "node:path";
import Ajv from "ajv/dist/2020.js";
import oddSchema from "../../contracts/schemas/odd-declaration.schema.json";
import type { CanonicalStage, JurisdictionId } from "./types";

export interface OddCell {
  jurisdiction_id: string;
  framework_id: string;
  native_stage_id: string | null;
  canonical_stage: CanonicalStage[];
  mapping_confidence: "authoritative" | "interpreted" | "inferred" | null;
  status: "in" | "mapped_unproven" | "structurally_absent";
  fixture_ids: string[];
  incident_flags: string[];
  input_floor: string[];
  scheme_scope_note?: string;
}

export interface OddDeclaration {
  schema_version: string;
  declaration_version: string;
  date: string;
  adr_ref: string;
  decision_ref: string;
  cells: OddCell[];
}

export type OddStatus = OddCell["status"] | "unlisted";

export interface OddResolution {
  status: OddStatus;
  declaration_version: string;
  /** Present for every declared cell, including structurally-absent ones. */
  cell?: OddCell;
}

const ODD_DIR_IDS: Record<JurisdictionId, string> = {
  INT: "international",
  UK: "uk",
  US: "usa",
  CA: "canada",
  AE: "uae",
};

let cache: OddDeclaration | null = null;

export function getOddDeclaration(): OddDeclaration {
  if (cache) return cache;
  const file = path.join(process.cwd(), "policies", "odd.json");
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    throw new Error(`ODD declaration unreadable: ${String(e)}`);
  }
  const ajv = new Ajv({ strict: false, allErrors: true });
  const validate = ajv.compile<OddDeclaration>(oddSchema);
  if (!validate(raw)) {
    const errs = (validate.errors ?? [])
      .map((e) => `${e.instancePath} ${e.message}`)
      .join("; ");
    throw new Error(`ODD declaration invalid: ${errs}`);
  }
  cache = raw as OddDeclaration;
  return cache;
}

/** Cell identity is jurisdiction + exact canonical-stage multiset. */
function canonicalKey(stages: CanonicalStage[]): string {
  return [...stages].sort().join("+");
}

export function resolveOdd(
  jurisdiction: JurisdictionId,
  canonicalStages: CanonicalStage[],
): OddResolution {
  const decl = getOddDeclaration();
  const dirId = ODD_DIR_IDS[jurisdiction];
  const key = canonicalKey(canonicalStages);
  const cell = decl.cells.find(
    (c) => c.jurisdiction_id === dirId && canonicalKey(c.canonical_stage) === key,
  );
  if (!cell) return { status: "unlisted", declaration_version: decl.declaration_version };
  return { status: cell.status, declaration_version: decl.declaration_version, cell };
}

/** Claim language per the three-zone discipline (ADR-0005 decision 9). */
export function oddClaimZone(res: OddResolution): {
  claims_allowed: boolean;
  stamp: string | null;
} {
  switch (res.status) {
    case "in":
      return { claims_allowed: true, stamp: null };
    case "mapped_unproven":
      return {
        claims_allowed: false,
        stamp: `outside ODD v${res.declaration_version} — validation pending`,
      };
    default:
      return { claims_allowed: false, stamp: null };
  }
}

/**
 * Input-floor check for 'in' cells: every floor class must be provided.
 * Below the floor the capability claim does not apply at all (ADR-0005 d5) —
 * runs still execute (Input-State degradation governs thinness) but the
 * result records an invalid capability claim.
 */
export function oddFloorSatisfied(
  res: OddResolution,
  providedInputIds: ReadonlySet<string>,
): boolean | null {
  if (res.status !== "in" || !res.cell) return null;
  return res.cell.input_floor.every((id) => providedInputIds.has(id));
}
