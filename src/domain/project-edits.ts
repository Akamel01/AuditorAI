// Project input-state policy (creation + patch), as pure domain functions:
// zero I/O, zero route imports. Routes parse requests, delegate here, respond.
// The stage gate and the never-silently-detach-drawings merge rule live here —
// domain owns input-state policy (CONTEXT.md: Project, Designer).
import { getPack } from "@/domain/packs";
import type { InputValueState, JurisdictionId, Project } from "@/domain/types";

export type EditOutcome<T> = { ok: true; value: T } | { ok: false; error: string };

export interface CreateProjectInput {
  name?: string;
  jurisdiction?: JurisdictionId;
  native_stage_id?: string;
  description?: string;
  scheme_summary?: string;
  authority?: string;
  location?: string;
}

export interface PatchProjectInput {
  metadata?: Partial<Project["metadata"]>;
  input_values?: Record<
    string,
    { state: InputValueState; value?: string; attachments?: string[] }
  >;
  native_stage_id?: string;
}

export interface CreateProjectCtx {
  wsHash: string;
  nowIso: string;
  newProjectId: string;
}

/** Shared POST/PATCH stage gate: pack lookup + MVP-scope check. Returns the
 *  validated native stage id for the jurisdiction. */
export function resolveStage(
  jurisdiction: JurisdictionId,
  nativeStageId: string,
): EditOutcome<string> {
  const pack = getPack(jurisdiction);
  const stage = pack.stages.find((s) => s.native_stage_id === nativeStageId);
  if (!stage) return { ok: false, error: `unknown native stage ${nativeStageId}` };
  if (!stage.mvp_scope)
    return { ok: false, error: `stage ${stage.display_name} is outside MVP scope` };
  return { ok: true, value: stage.native_stage_id };
}

export function createProject(
  input: CreateProjectInput,
  ctx: CreateProjectCtx,
): EditOutcome<Project> {
  if (!input.name?.trim()) return { ok: false, error: "name is required" };
  if (!input.jurisdiction || !input.native_stage_id)
    return { ok: false, error: "jurisdiction and native_stage_id are required" };
  const stage = resolveStage(input.jurisdiction, input.native_stage_id);
  if (!stage.ok) return stage;

  return {
    ok: true,
    value: {
      project_id: ctx.newProjectId,
      workspace_key_hash: ctx.wsHash,
      metadata: {
        name: input.name.trim(),
        description: input.description ?? "",
        scheme_summary: input.scheme_summary ?? "",
        authority: input.authority ?? "",
        location: input.location ?? "",
      },
      stage_selection: {
        jurisdiction: input.jurisdiction,
        native_stage_id: stage.value,
      },
      input_values: {},
      created_at: ctx.nowIso,
      updated_at: ctx.nowIso,
    },
  };
}

/** Apply a patch onto a copy of the project; the input project object is never
 *  mutated. Validation failures leave nothing half-applied. */
export function patchProject(
  project: Project,
  patch: PatchProjectInput,
  nowIso: string,
): EditOutcome<Project> {
  const next: Project = {
    ...project,
    metadata: { ...project.metadata },
    stage_selection: { ...project.stage_selection },
    input_values: Object.fromEntries(
      Object.entries(project.input_values).map(([k, v]) => [k, { ...v }]),
    ),
  };

  if (patch.metadata) {
    next.metadata = { ...next.metadata, ...patch.metadata };
  }
  if (patch.native_stage_id) {
    const stage = resolveStage(next.stage_selection.jurisdiction, patch.native_stage_id);
    if (!stage.ok) return stage;
    next.stage_selection.native_stage_id = stage.value;
  }
  if (patch.input_values) {
    for (const [inputId, v] of Object.entries(patch.input_values)) {
      if (!v || typeof v.state !== "string")
        return { ok: false, error: `bad value for ${inputId}` };
      const existing = next.input_values[inputId] ?? { state: v.state, value: "" };
      next.input_values[inputId] = {
        state: v.state,
        value: v.value ?? existing.value ?? "",
        // Omitting attachments in a patch preserves the existing links
        // (text edits must never silently detach drawings).
        ...(v.attachments !== undefined
          ? { attachments: v.attachments }
          : existing.attachments
            ? { attachments: existing.attachments }
            : {}),
      };
    }
  }

  next.updated_at = nowIso;
  return { ok: true, value: next };
}
