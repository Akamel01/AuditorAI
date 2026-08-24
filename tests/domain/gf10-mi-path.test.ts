import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { getPack } from "@/domain/packs";
import { runAudit } from "@/domain/engine";
import type { Project } from "@/domain/types";

const T0 = "2026-08-22T00:00:00.000Z";
const fixture = JSON.parse(
  readFileSync(
    new URL("../fixtures/gf10-canada-corridor-planning.json", import.meta.url),
    "utf8",
  ),
);

/**
 * Deterministic contract pinning the GF-10 'conflicting' missing-information path:
 * pack declaration + fixture state + engine emission, independent of baseline prose
 * or judge scoring (eval-gates §5 rot-family insurance for VAL-024 fallout).
 */
describe("GF-10 conflicting-state MI path", () => {
  it("CA pack declares network_continuity_constraints required at ca-tac:planning citing EV-CA-027", () => {
    const ca = getPack("CA");
    const rule = ca.inputs.find(
      (i) => i.input_id === "network_continuity_constraints",
    );
    expect(rule).toBeDefined();
    expect(rule?.stage_ids).toContain("ca-tac:planning");
    expect(rule?.requirement_level).toBe("required");
    expect(rule?.evidence_ids).toContain("EV-CA-027");
  });

  it("fixture records the explicit 'conflicting' input state", () => {
    expect(fixture.inputs.network_continuity_constraints.state).toBe("conflicting");
  });

  it("engine emits a blocking MI question for the conflicting state", () => {
    const p: Project = {
      project_id: "P-GF10-MI",
      workspace_key_hash: "h",
      metadata: { ...fixture.metadata },
      stage_selection: { jurisdiction: "CA", native_stage_id: "ca-tac:planning" },
      input_values: Object.fromEntries(
        Object.entries(fixture.inputs)
          .filter(
            ([, v]) =>
              v !== null && typeof v === "object" && "state" in (v as object),
          )
          .map(([k, v]) => [
            k,
            {
              state: (v as { state: Project["input_values"][string]["state"] }).state,
              ...(typeof (v as { value?: unknown }).value === "string"
                ? { value: (v as { value: string }).value }
                : {}),
            },
          ]),
      ),
      created_at: T0,
      updated_at: T0,
    };
    const r = runAudit(p, T0);
    const mi = r.missing_information.find(
      (m) => m.input_id === "network_continuity_constraints",
    );
    expect(mi).toBeDefined();
  });
});
