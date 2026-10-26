// Shared request-body validation: ONE Ajv instance, one compiled validator per
// request shape, one body reader. The schema owns type and shape (422); the
// domain keeps the semantics (400). Route files never call req.json(),
// req.text() or req.formData() directly — they read a body through
// readJsonBody / validateFormFields, both of which throw the existing
// RequestContractError (src/lib/api.ts:135), mapped to 422 by ERROR_TABLE
// (src/lib/api.ts:153).
import Ajv from "ajv/dist/2020.js";
import type { ErrorObject, Schema } from "ajv/dist/2020.js";
import { RequestContractError } from "@/lib/api";
import auditPatchRequestSchema from "../../contracts/schemas/api/audit-patch-request.schema.json";
import authEmailRequestSchema from "../../contracts/schemas/api/auth-email-request.schema.json";
import createProjectRequestSchema from "../../contracts/schemas/api/create-project-request.schema.json";
import devDiscoveryRunRequestSchema from "../../contracts/schemas/api/dev-discovery-run-request.schema.json";
import devHarvestStreamRequestSchema from "../../contracts/schemas/api/dev-harvest-stream-request.schema.json";
import devRunEditRequestSchema from "../../contracts/schemas/api/dev-run-edit-request.schema.json";
import devRunRequestSchema from "../../contracts/schemas/api/dev-run-request.schema.json";
import devRunStepRequestSchema from "../../contracts/schemas/api/dev-run-step-request.schema.json";
import devSecretsRequestSchema from "../../contracts/schemas/api/dev-secrets-request.schema.json";
import issueRequestSchema from "../../contracts/schemas/api/issue-request.schema.json";
import patchProjectRequestSchema from "../../contracts/schemas/api/patch-project-request.schema.json";
import teamInviteRequestSchema from "../../contracts/schemas/api/team-invite-request.schema.json";
import uploadFieldsSchema from "../../contracts/schemas/api/upload-fields.schema.json";

// The repo's established Ajv options (src/domain/packs.ts:138).
const ajv = new Ajv({ strict: false, allErrors: true });

export type Validator = ReturnType<typeof ajv.compile>;

export function compileSchema(schema: Schema): Validator {
  return ajv.compile(schema);
}

export const createProjectRequest = compileSchema(createProjectRequestSchema);
export const patchProjectRequest = compileSchema(patchProjectRequestSchema);
export const auditPatchRequest = compileSchema(auditPatchRequestSchema);
export const issueRequest = compileSchema(issueRequestSchema);
export const uploadFields = compileSchema(uploadFieldsSchema);
export const devRunRequest = compileSchema(devRunRequestSchema);
export const devRunEditRequest = compileSchema(devRunEditRequestSchema);
export const devRunStepRequest = compileSchema(devRunStepRequestSchema);
export const devDiscoveryRunRequest = compileSchema(devDiscoveryRunRequestSchema);
export const devHarvestStreamRequest = compileSchema(devHarvestStreamRequestSchema);
export const devSecretsRequest = compileSchema(devSecretsRequestSchema);
export const authEmailRequest = compileSchema(authEmailRequestSchema);
export const teamInviteRequest = compileSchema(teamInviteRequestSchema);

/** The $id of every compiled validator — the link between the registry
 *  (contracts/api-surface.json) and the schema files on disk. */
export const REQUEST_SCHEMA_IDS = {
  createProjectRequest: createProjectRequestSchema.$id,
  patchProjectRequest: patchProjectRequestSchema.$id,
  auditPatchRequest: auditPatchRequestSchema.$id,
  issueRequest: issueRequestSchema.$id,
  uploadFields: uploadFieldsSchema.$id,
  devRunRequest: devRunRequestSchema.$id,
  devRunEditRequest: devRunEditRequestSchema.$id,
  devRunStepRequest: devRunStepRequestSchema.$id,
  devDiscoveryRunRequest: devDiscoveryRunRequestSchema.$id,
  devHarvestStreamRequest: devHarvestStreamRequestSchema.$id,
  devSecretsRequest: devSecretsRequestSchema.$id,
  authEmailRequest: authEmailRequestSchema.$id,
  teamInviteRequest: teamInviteRequestSchema.$id,
} as const;

export interface ReadJsonOptions {
  /** true only where an absent body is legal today (R4, R9, R10). */
  allowEmpty?: boolean;
}

const MAX_MESSAGE_CHARS = 300;

function failureList(errors: ErrorObject[]): string {
  return errors
    .slice(0, 3)
    .map((e) => {
      const text = `${e.instancePath || "/"} ${e.message ?? "is invalid"}`;
      if (e.keyword !== "additionalProperties") return text;
      // ajv hides the offending key unless the caller names it.
      const prop = (e.params as { additionalProperty?: string }).additionalProperty;
      return prop ? `${text} (unexpected field '${prop}')` : text;
    })
    .join("; ");
}

/** Read a JSON body and validate it. A contract failure throws
 *  RequestContractError, which ERROR_TABLE maps to 422 with the message
 *  exposed (src/lib/api.ts:153). */
export async function readJsonBody<T>(
  req: Request,
  validate: Validator,
  opts?: ReadJsonOptions,
): Promise<T> {
  const raw = await req.text();
  let parsed: unknown;
  if (raw.trim() === "") {
    if (!opts?.allowEmpty) {
      throw new RequestContractError("request body is not valid JSON");
    }
    parsed = {};
  } else {
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new RequestContractError("request body is not valid JSON");
    }
  }
  if (!validate(parsed)) {
    const message = `request body failed schema validation: ${failureList(validate.errors ?? [])}`;
    throw new RequestContractError(message.slice(0, MAX_MESSAGE_CHARS));
  }
  return parsed as T;
}

/** Validate the multipart body. A text part is a validated field. A File/Blob
 *  part is one only when the schema declares that key — then ajv rejects it as
 *  a type violation instead of silently dropping it. The upload's own file part
 *  is not declared by the schema, so it stays out of the validated field set
 *  (the file policy stays with src/lib/intake.ts and src/lib/extract.ts). */
export function validateFormFields(
  form: FormData,
  validate: Validator,
): { ok: true; value: Record<string, string> } | { ok: false; error: string } {
  const declared =
    (validate.schema as { properties?: Record<string, unknown> } | undefined)?.properties ?? {};
  const fields: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    // a non-text part for a key the schema does not declare is the file part
    if (typeof value !== "string" && !Object.hasOwn(declared, key)) continue;
    // FormData.get semantics: a repeated key keeps its FIRST value, so the
    // route and src/lib/intake.ts:55 read the same project_id.
    if (!Object.hasOwn(fields, key)) fields[key] = value;
  }
  if (!validate(fields)) {
    const errors = validate.errors ?? [];
    // a wrongly-typed part (a File where the schema wants text) wins over an
    // unknown field: it is the one the caller cannot see in the request.
    const first = errors.find((e) => e.keyword === "type") ?? errors[0];
    const detail =
      first?.keyword === "additionalProperties"
        ? `unexpected field '${(first.params as { additionalProperty?: string }).additionalProperty ?? ""}'`
        : first?.instancePath
          ? `${first.instancePath} ${first.message ?? "is invalid"}`
          : (first?.message ?? "is invalid");
    return { ok: false, error: `invalid form field: ${detail}` };
  }
  return { ok: true, value: fields as Record<string, string> };
}
