// D09-COVERAGE + D10-QUEUE — ODD Coverage Score over policies/odd.json vs the
// discovery ledger. Owner decisions baked in (2026-08-25):
//   target allocation weighted by gap+risk; structurally-absent excluded;
//   fragile single-fixture IN cells get a risk bonus; queue ranks by
//   priority = gap_share × risk_weight.
import { readFileSync } from "node:fs";
import path from "node:path";
import Ajv from "ajv/dist/2020.js";
import oddSchema from "../../contracts/schemas/odd-declaration.schema.json";
import coverageSchema from "../../contracts/schemas/odd-coverage.schema.json";
import type { CanonicalStage, JurisdictionId } from "@/domain/types";
import type {
  MatchAssignment,
  OddCoverageView,
  ProjectPackageAssembly,
  QueueItem,
  CoverageCellView,
} from "@/discovery/types";

const JUR_DIR_IDS: Record<JurisdictionId, string> = {
  INT: "international",
  UK: "uk",
  US: "usa",
  CA: "canada",
  AE: "uae",
};

interface OddDeclarationFile {
  declaration_version: string;
  cells: {
    jurisdiction_id: string;
    native_stage_id: string | null;
    canonical_stage: CanonicalStage[];
    status: "in" | "mapped_unproven" | "structurally_absent";
    fixture_ids: string[];
  }[];
}

export const TARGET_TOTAL = 500;

const RISK_WEIGHT: Record<OddDeclarationFile["cells"][number]["status"], number> = {
  in: 1,
  mapped_unproven: 3,
  structurally_absent: 0,
};

/** Fragile bonus: IN cell held up by exactly one fixture. */
function riskBonus(fixtureCount: number, status: OddDeclarationFile["cells"][number]["status"]): number {
  if (status === "in" && fixtureCount <= 1) return 2;
  return 0;
}

let cachedDecl: OddDeclarationFile | null = null;

export function loadOddDeclaration(): OddDeclarationFile {
  if (cachedDecl) return cachedDecl;
  const raw: unknown = JSON.parse(
    readFileSync(path.join(process.cwd(), "policies", "odd.json"), "utf8"),
  );
  const ajv = new Ajv({ strict: false, allErrors: true });
  const validate = ajv.compile<OddDeclarationFile>(oddSchema);
  if (!validate(raw)) throw new Error("odd.json failed schema validation");
  cachedDecl = raw;
  return cachedDecl;
}

/** Test hook: drop cached declaration (callers changing cwd between cases). */
export function resetOddDeclarationCache(): void {
  cachedDecl = null;
}

export interface PackagedMatch {
  pkg: ProjectPackageAssembly;
  match: MatchAssignment;
}

function cellKeyFor(jur: JurisdictionId, stages: CanonicalStage[]): string {
  return `${JUR_DIR_IDS[jur]}:${[...stages].sort().join("+")}`;
}

function tally(packages: readonly PackagedMatch[]): Map<string, { full: number; total: number }> {
  const totals = new Map<string, { full: number; total: number }>();
  const declared = new Set(
    loadOddDeclaration()
      .cells.filter((c) => c.status !== "structurally_absent")
      .map((c) => `${c.jurisdiction_id}:${[...c.canonical_stage].sort().join("+")}`),
  );
  for (const { pkg, match } of packages) {
    const key = cellKeyFor(match.jurisdiction, match.canonical_stages);
    if (!declared.has(key)) continue; // outside declared matrix — never counted
    const entry = totals.get(key) ?? { full: 0, total: 0 };
    entry.total += 1;
    if (pkg.completeness === "full-package") entry.full += 1;
    totals.set(key, entry);
  }
  return totals;
}

export function computeCoverage(
  packages: readonly PackagedMatch[],
  generatedIso: string,
): OddCoverageView {
  const decl = loadOddDeclaration();
  const ajv = new Ajv({ strict: false, allErrors: true });
  const validateView = ajv.compile(coverageSchema);

  const totals = tally(packages);
  const weightSum = decl.cells.reduce(
    (s, c) => s + RISK_WEIGHT[c.status] + riskBonus(c.fixture_ids.length, c.status),
    0,
  );

  // Largest-remainder allocation so integer targets sum exactly to TARGET_TOTAL.
  const activeCells = decl.cells.filter((c) => c.status !== "structurally_absent" && weightSum > 0);
  const rawTargets = new Map(
    activeCells.map((c) => {
      const w = RISK_WEIGHT[c.status] + riskBonus(c.fixture_ids.length, c.status);
      return [cellIdOf(c), (TARGET_TOTAL * w) / weightSum] as const;
    }),
  );
  const targets = new Map<string, number>();
  let allocated = 0;
  for (const [id, raw] of rawTargets) {
    targets.set(id, Math.floor(raw));
    allocated += Math.floor(raw);
  }
  const byRemainder = [...rawTargets.entries()].sort(
    (a, b) => (b[1] - Math.floor(b[1])) - (a[1] - Math.floor(a[1])) || a[0].localeCompare(b[0]),
  );
  for (let i = 0; allocated < TARGET_TOTAL && i < byRemainder.length; i++, allocated++) {
    targets.set(byRemainder[i][0], targets.get(byRemainder[i][0])! + 1);
  }

  const views: CoverageCellView[] = decl.cells.map((cell) => {
    const jurId = (Object.entries(JUR_DIR_IDS).find(([, d]) => d === cell.jurisdiction_id)?.[0] ??
      "INT") as JurisdictionId;
    const key = cellKeyFor(jurId, cell.canonical_stage);
    const counts = totals.get(key) ?? { full: 0, total: 0 };
    const weight = RISK_WEIGHT[cell.status] + riskBonus(cell.fixture_ids.length, cell.status);
    const target =
      cell.status === "structurally_absent" || weightSum === 0
        ? 0
        : targets.get(cellIdOf(cell)) ?? 0;
    const label =
      target === 0
        ? "EXCLUDED"
        : counts.total >= target * 1.5
          ? "OVER-REPRESENTED"
          : counts.total >= target
            ? "COVERED"
            : counts.total > 0
              ? "UNDER-COVERED"
              : "MISSING";
    const uncovered: string[] = [];
    if (target > 0 && counts.total < target) {
      uncovered.push(`need ${target - counts.total} more packages (${counts.total}/${target})`);
      if (counts.full === 0) uncovered.push("no full-package yet");
    }
    return {
      cell_key: key,
      jurisdiction_id: jurId,
      native_stage_id: cell.native_stage_id,
      canonical_stage: [...cell.canonical_stage],
      status: cell.status,
      fixture_ids: [...cell.fixture_ids],
      target,
      have_full_package: counts.full,
      have_total: counts.total,
      label,
      priority: round4(Math.max(0, target > 0 ? ((target - counts.total) / target) * weight : 0)),
      uncovered_reasons: uncovered,
    };
  });

  const view: OddCoverageView = {
    schema_version: "1.0.0",
    declaration_version: decl.declaration_version,
    generated: generatedIso,
    target_total: TARGET_TOTAL,
    cells: views,
    gaps_ranked: [...views]
      .filter((c) => c.target > 0)
      .sort((a, b) => b.priority - a.priority)
      .map((c) => c.cell_key),
  };

  if (!validateView(view)) {
    throw new Error(`coverage view invalid: ${JSON.stringify(validateView.errors)}`);
  }
  return view;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}


function cellIdOf(c: OddDeclarationFile["cells"][number]): string {
  return `${c.jurisdiction_id}:${[...c.canonical_stage].sort().join("+")}:${c.native_stage_id ?? "-"}`;
}

// ---- D10-QUEUE ----------------------------------------------------------------

const QUERY_THEMES: Record<JurisdictionId, string[]> = {
  UK: ['"road safety audit" "stage 1"', 'NSIP "road safety audit" preliminary design'],
  US: ["FHWA road safety audit preliminary design report", 'site:dot.state.mn.us "road safety audit"'],
  CA: ['Alberta "road safety audit" functional planning', 'BC MoTI "road safety audit"'],
  AE: ["Abu Dhabi road safety audit stage 0", "jawdah qcc ISGL audit"],
  INT: ["CAREC road safety audit worked example", '"stage 2" RSA detailed design Ireland ABP'],
};

export function buildQueue(view: OddCoverageView, limit = 10): QueueItem[] {
  return view.gaps_ranked
    .map((key, idx) => {
      const cell = view.cells.find((c) => c.cell_key === key)!;
      return {
        rank: idx + 1,
        cell_key: key,
        jurisdiction_id: cell.jurisdiction_id,
        query_theme:
          QUERY_THEMES[cell.jurisdiction_id][idx % QUERY_THEMES[cell.jurisdiction_id].length],
        reason:
          cell.uncovered_reasons[0] ??
          `priority ${cell.priority} (status ${cell.status}, ${cell.have_total}/${cell.target})`,
      };
    })
    .slice(0, limit);
}
