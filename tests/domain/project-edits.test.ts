// Project input-state policy gates (pure domain): creation validation, stage
// gate sharing, and the patch merge table — including the rule that text edits
// must never silently detach drawings.
import { describe, expect, it } from "vitest";
import type { Project } from "@/domain/types";
import {
  createProject,
  patchProject,
  resolveStage,
  type CreateProjectInput,
} from "@/domain/project-edits";

const T0 = "2026-08-22T00:00:00.000Z";
const T1 = "2026-08-23T00:00:00.000Z";

const CTX = { wsHash: "hash01", nowIso: T0, newProjectId: "P-new" };

function baseProject(): Project {
  return {
    project_id: "P-base",
    workspace_key_hash: "hash01",
    metadata: {
      name: "Base",
      description: "",
      scheme_summary: "",
      authority: "",
      location: "",
    },
    stage_selection: { jurisdiction: "UK", native_stage_id: "uk:S2" },
    input_values: {
      drawing_document_register: {
        state: "provided",
        value: "v1",
        attachments: ["ATT-keep"],
      },
      collision_data_analysis_36mo: { state: "provided", value: "stats" },
    },
    created_at: T0,
    updated_at: T0,
  };
}

describe("createProject", () => {
  const rejections: [CreateProjectInput, string][] = [
    [{}, "name is required"],
    [{ name: "  " }, "name is required"],
    [{ name: "X" }, "jurisdiction and native_stage_id are required"],
    [
      { name: "X", jurisdiction: "UK" },
      "jurisdiction and native_stage_id are required",
    ],
    [
      { name: "X", jurisdiction: "UK", native_stage_id: "uk:NOPE" },
      "unknown native stage uk:NOPE",
    ],
    [
      { name: "X", jurisdiction: "UK", native_stage_id: "uk:S3" },
      "stage Stage 3 (Construction complete) is outside MVP scope",
    ],
  ];

  it.each(rejections)("rejects %j with '%s'", (input, error) => {
    expect(createProject(input, CTX)).toEqual({ ok: false, error });
  });

  it("creates the canonical record with defaults and trimmed name", () => {
    const out = createProject(
      {
        name: "  Corridor  ",
        jurisdiction: "UK",
        native_stage_id: "uk:S2",
        description: "d",
      },
      CTX,
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.value).toMatchObject({
      project_id: "P-new",
      workspace_key_hash: "hash01",
      metadata: {
        name: "Corridor",
        description: "d",
        scheme_summary: "",
        authority: "",
        location: "",
      },
      stage_selection: { jurisdiction: "UK", native_stage_id: "uk:S2" },
      input_values: {},
      created_at: T0,
      updated_at: T0,
    });
  });
});

describe("resolveStage (shared POST/PATCH gate)", () => {
  it("accepts in-scope stages and returns the validated id", () => {
    expect(resolveStage("UK", "uk:S2")).toEqual({ ok: true, value: "uk:S2" });
  });
  it("rejects unknown and out-of-MVP stages", () => {
    expect(resolveStage("UK", "uk:NOPE").ok).toBe(false);
    const mvp = resolveStage("UK", "uk:S4");
    expect(mvp.ok).toBe(false);
    if (!mvp.ok) expect(mvp.error).toContain("outside MVP scope");
  });
});

describe("patchProject merge table", () => {
  const NOW = T1;

  const cases: {
    name: string;
    patch: Parameters<typeof patchProject>[1];
    expectError?: string;
    expectErrorContains?: string;
    assert?: (p: Project) => void;
  }[] = [
    {
      name: "text-only edit preserves existing attachment links",
      patch: {
        input_values: {
          drawing_document_register: { state: "provided", value: "v2 edited" },
        },
      },
      assert: (p) => {
        expect(p.input_values.drawing_document_register.value).toBe("v2 edited");
        expect(p.input_values.drawing_document_register.attachments).toEqual(["ATT-keep"]);
      },
    },
    {
      name: "explicit attachments replace existing links",
      patch: {
        input_values: {
          drawing_document_register: {
            state: "provided",
            value: "v2",
            attachments: ["ATT-other"],
          },
        },
      },
      assert: (p) => {
        expect(p.input_values.drawing_document_register.attachments).toEqual(["ATT-other"]);
      },
    },
    {
      name: "explicit empty array is stored as an explicit detach-all",
      patch: {
        input_values: {
          drawing_document_register: { state: "provided", value: "v2", attachments: [] },
        },
      },
      assert: (p) => {
        expect(p.input_values.drawing_document_register.attachments).toEqual([]);
      },
    },
    {
      name: "new inputs are created with an empty default value",
      patch: {
        input_values: { vru_desire_lines: { state: "not_available" } },
      },
      assert: (p) => {
        expect(p.input_values.vru_desire_lines).toEqual({ state: "not_available", value: "" });
      },
    },
    {
      name: "untouched inputs survive untouched",
      patch: { metadata: { name: "Renamed" } },
      assert: (p) => {
        expect(p.metadata.name).toBe("Renamed");
        expect(p.metadata.authority).toBe("");
        expect(p.input_values.collision_data_analysis_36mo.value).toBe("stats");
      },
    },
    {
      name: "valid stage change applies",
      patch: { native_stage_id: "uk:S1" },
      assert: (p) => {
        expect(p.stage_selection.native_stage_id).toBe("uk:S1");
      },
    },
    {
      name: "unknown stage rejected with a meaningful message",
      patch: { native_stage_id: "uk:NOPE" },
      expectError: "unknown native stage uk:NOPE",
    },
    {
      name: "out-of-MVP stage rejected",
      patch: { native_stage_id: "uk:S3" },
      expectErrorContains: "outside MVP scope",
    },
    {
      name: "missing state rejected naming the input",
      patch: {
        input_values: {
          scheme_description_objectives: {} as never,
        },
      },
      expectError: "bad value for scheme_description_objectives",
    },
    {
      name: "stage error short-circuits before input values apply",
      patch: {
        native_stage_id: "uk:NOPE",
        input_values: {
          drawing_document_register: {
            state: "provided",
            value: "should-not-apply",
            attachments: [],
          },
        },
      },
      expectError: "unknown native stage uk:NOPE",
    },
    {
      name: "provided without value or attachment is rejected, naming the input",
      patch: { input_values: { vru_desire_lines: { state: "provided" } } },
      expectError:
        "input vru_desire_lines cannot be 'provided' without a value or attachment",
    },
    {
      name: "whitespace-only value does not substantiate provided",
      patch: { input_values: { vru_desire_lines: { state: "provided", value: "   " } } },
      expectError:
        "input vru_desire_lines cannot be 'provided' without a value or attachment",
    },
    {
      name: "explicit detach-all plus blank value is rejected as unsubstantiated",
      patch: {
        input_values: {
          drawing_document_register: { state: "provided", value: "", attachments: [] },
        },
      },
      expectError:
        "input drawing_document_register cannot be 'provided' without a value or attachment",
    },
    {
      name: "provided survives on preserved attachments alone (no text value)",
      patch: {
        input_values: {
          drawing_document_register: { state: "provided", value: "" },
        },
      },
      assert: (p) => {
        expect(p.input_values.drawing_document_register).toEqual({
          state: "provided",
          value: "",
          attachments: ["ATT-keep"],
        });
      },
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      const original = baseProject();
      const out = patchProject(original, c.patch, NOW);
      if (c.expectError || c.expectErrorContains) {
        expect(out.ok).toBe(false);
        if (!out.ok) {
          if (c.expectError) expect(out.error).toBe(c.expectError);
          else expect(out.error).toContain(c.expectErrorContains);
        }
        return;
      }
      expect(out.ok).toBe(true);
      if (!out.ok) return;
      c.assert?.(out.value);
      expect(out.value.updated_at).toBe(NOW);
    });
  }

  it("never mutates the input project object (purity)", () => {
    const original = baseProject();
    const snapshot = JSON.parse(JSON.stringify(original)) as Project;
    const out = patchProject(
      original,
      {
        metadata: { name: "Changed" },
        native_stage_id: "uk:S1",
        input_values: {
          drawing_document_register: { state: "provided", value: "changed", attachments: [] },
          new_input: { state: "provided", value: "n" },
        },
      },
      NOW,
    );
    expect(out.ok).toBe(true);
    expect(JSON.parse(JSON.stringify(original))).toEqual(snapshot);
  });
});
