// AI seam (ADR-0001): provider-agnostic, OFF by default. Adapters may emit only
// bounded candidate artifacts; nothing here can produce final determinations.
import Ajv from "ajv/dist/2020.js";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { getEvidence } from "@/lib/evidence";
import {
  CircuitBreaker,
  FailoverEndpoint,
  chatComplete,
  extractJsonArray,
  runInferenceLoop,
  type ChatMessage,
  type ReasoningEffort,
} from "@/lib/inference";
import type { AuditResult, CandidateFindingRecord } from "@/domain/types";

/** Single source of truth lives in domain/types (ADR-0006); lib/ai re-exports
 *  under the adapter-facing name. */
export type CandidateFinding = CandidateFindingRecord;

/** M3 vision budget: max drawings passed as image blocks per judge/candidate call. */
export const MAX_IMAGES_PER_CALL = 4;

export interface CandidateVocabulary {
  issue_categories: readonly string[];
  road_user_categories: readonly string[];
}

export interface AiAdapter {
  readonly enabled: boolean;
  /** Registry seam id for provenance stamping (ADR-0012); absent on ad-hoc
   *  test fakes ⇒ callers record null rather than inventing an identity. */
  readonly id?: string;
  /**
   * Generate bounded candidate findings for human adjudication. `images` are
   * data-URLs rendered as image blocks (vision path, M3); `contextNotes` carry
   * degraded text summaries (e.g. overflow attachment names).
   */
  generateCandidates(
    audit: AuditResult,
    images?: string[],
    contextNotes?: string[],
    vocabulary?: CandidateVocabulary,
  ): Promise<CandidateFinding[]>;
}

export class OffAiAdapter implements AiAdapter {
  readonly enabled = false;
  readonly id = "off";
  async generateCandidates(): Promise<CandidateFinding[]> {
    return [];
  }
}

// ---- Zen adapter (A1): OpenAI-compatible, fetch-only, strict boundary -------

export type { ReasoningEffort };

export interface ZenAiConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  effort?: ReasoningEffort;
  timeoutMs?: number;
  maxCallsPerRun?: number;
  breakerThreshold?: number;
  fallbackBaseUrl?: string;
  fallbackApiKey?: string;
  fetchImpl?: typeof fetch;
}

const DEFAULT_BASE_URL = "https://opencode.ai/zen/v1";
const DEFAULT_MODEL = "x-preview-f-free";

interface JsonSchemaish {
  enum?: readonly string[];
  type?: string | string[];
  items?: JsonSchemaish;
  properties?: Record<string, JsonSchemaish>;
  required?: string[];
  minItems?: number;
  additionalProperties?: boolean;
}

export const CANDIDATE_FIELD_SCHEMAS: Record<string, JsonSchemaish> = {
  kind: { enum: ["safety_concern", "compliance_question"] },
  category: { type: "string" },
  location: { type: ["string", "null"] },
  road_users: { type: "array", items: { type: "string" } },
  scenario: { type: ["string", "null"] },
  statement: {
    type: "object",
    required: ["text"],
    properties: {
      text: { type: "string" },
      normative_basis_note: { type: ["string", "null"] },
    },
    additionalProperties: false,
  },
  evidence: {
    type: "array",
    minItems: 1,
    items: {
      type: "object",
      required: ["evidence_id", "use"],
      properties: {
        evidence_id: { type: "string" },
        quote: { type: ["string", "null"] },
        use: { enum: ["supports_concern", "defines_requirement", "context"] },
      },
      additionalProperties: false,
    },
  },
  assumptions: {
    type: "array",
    items: {
      type: "object",
      required: ["text"],
      properties: {
        text: { type: "string" },
        basis: { type: ["string", "null"] },
      },
      additionalProperties: false,
    },
  },
  rationale: { type: "string" },
  recommendation: { type: ["string", "null"] },
};

export const CANDIDATE_FIELDS = Object.keys(CANDIDATE_FIELD_SCHEMAS);

const OPTIONAL_CANDIDATE_FIELDS = new Set(["location", "road_users", "scenario", "recommendation"]);

// ---- System prompt artifact (ADR-0012) ---------------------------------------
// All natural-language instruction text lives in prompts/system-prompt.md;
// this module keeps only structure (message assembly, vocabulary injection).
// Missing/unreadable artifact ⇒ adapters fail closed (enabled=false).

export interface PromptArtifact {
  version: number;
  supersedes: number | null;
  body: string;
  hash: string;
}

const PROMPT_ARTIFACT_PATH = "prompts/system-prompt.md";

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Parse the canonical prompt artifact: front-matter carries version/
 *  supersedes; the body is the exact instruction text up to the Changelog
 *  heading (trailing newlines excluded so the hash covers exactly the text
 *  sent as the system message). Throws on any malformation. */
function parsePromptArtifact(raw: string): PromptArtifact {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!fm) throw new Error("missing front-matter block");
  const fields = new Map<string, string>();
  for (const line of fm[1].split(/\r?\n/)) {
    const m = /^([A-Za-z_][A-Za-z0-9_-]*):(.*)$/.exec(line);
    if (m) fields.set(m[1], m[2].trim());
  }
  const version = Number(fields.get("version"));
  if (!Number.isInteger(version) || version < 1) {
    throw new Error(`bad front-matter version '${fields.get("version") ?? "<missing>"}'`);
  }
  const supRaw = fields.get("supersedes") ?? "none";
  const supersedes = supRaw === "none" ? null : Number(supRaw);
  if (supersedes !== null && (!Number.isInteger(supersedes) || supersedes < 1)) {
    throw new Error(`bad front-matter supersedes '${supRaw}'`);
  }
  const changelogAt = raw.indexOf("\n## Changelog");
  const body = (
    changelogAt === -1 ? raw.slice(fm[0].length) : raw.slice(fm[0].length, changelogAt)
  ).replace(/\n+$/, "");
  if (!body) throw new Error("empty prompt body");
  return { version, supersedes, body, hash: sha256(body) };
}

/** Load + parse the prompt artifact; null (with a warn) when missing or
 *  malformed — callers must treat that as fail-closed. Exported for tests and
 *  tooling; module init below uses the repo-default path. */
export function loadPromptArtifact(
  filePath: string = path.join(process.cwd(), PROMPT_ARTIFACT_PATH),
): PromptArtifact | null {
  try {
    return parsePromptArtifact(readFileSync(filePath, "utf8"));
  } catch (e) {
    console.warn(
      `[ai] ${PROMPT_ARTIFACT_PATH} missing/unreadable (${e instanceof Error ? e.message : String(e)}); AI adapters fail closed (ADR-0012)`,
    );
    return null;
  }
}

let activePrompt = loadPromptArtifact();

/** ADR-0012 identity of the loaded prompt, stamped into outcome rows and eval
 *  scorecards. Null only in the fail-closed state (artifact unavailable). */
export let PROMPT_VERSION: number | null = activePrompt?.version ?? null;
export let PROMPT_HASH: string | null = activePrompt?.hash ?? null;

/** Test seam: reseat the module-level prompt artifact; null simulates the
 *  fail-closed missing-file state for adapter gating assertions. */
export function setPromptArtifactForTests(artifact: PromptArtifact | null): void {
  activePrompt = artifact;
  PROMPT_VERSION = artifact?.version ?? null;
  PROMPT_HASH = artifact?.hash ?? null;
}

const REPAIR_INSTRUCTION =
  "Your previous output was rejected (malformed JSON or schema violation). Return ONLY the JSON array, no prose, no code fences.";

export function buildPromptMessages(
  audit: AuditResult,
  images?: string[],
  vocabulary?: CandidateVocabulary,
): ChatMessage[] {
  const evidenceIds = new Set<string>();
  for (const m of audit.input_manifest) for (const id of m.evidence_ids) evidenceIds.add(id);
  for (const f of audit.findings) for (const e of f.evidence) evidenceIds.add(e.evidence_id);

  const excerpts: string[] = [];
  for (const id of [...evidenceIds].sort()) {
    try {
      const rec = getEvidence(id);
      excerpts.push(`[${id}] ${rec.claim}`);
    } catch {
      excerpts.push(`[${id}] (unresolved)`);
    }
  }

  const manifestLines = audit.input_manifest.map(
    (m) => `- ${m.input_id} (${m.requirement_level}): ${m.state}`,
  );
  const questionLines = audit.audit_questions.map((q) => `- [${q.question_id}] ${q.text}`);

  const text = [
    `Audit context: ${audit.jurisdiction} / ${audit.framework_name} / native stage ${audit.native_stage_display_name}.`,
    "",
    "Recorded input states:",
    ...(manifestLines.length ? manifestLines : ["- (none defined)"]),
    "",
    "Deterministic findings already recorded (do not duplicate):",
    ...(audit.findings.length
      ? audit.findings.map((f) => `- [${f.kind}] ${f.statement.text}`)
      : ["- (none)"]),
    "",
    "Audit questions to reason over:",
    ...(questionLines.length ? questionLines : ["- (none posed at this stage)"]),
    "",
    "Evidence registry excerpts (cite only these ids):",
    ...(excerpts.length ? excerpts : ["- (none available)"]),
    ...(vocabulary
      ? [
          "",
          `Allowed issue categories for 'category' (use one verbatim): ${vocabulary.issue_categories.join(", ")}`,
          `Allowed road-user categories for 'road_users' (draw from): ${vocabulary.road_user_categories.join(", ")}`,
        ]
      : []),
    "",
    "Propose zero to five candidate findings a deterministic rule set could not express.",
  ].join("\n");

  const userContent: ChatMessage["content"] = images?.length
    ? [
        { type: "text", text },
        ...images.map((url) => ({
          type: "image_url" as const,
          image_url: { url },
        })),
      ]
    : text;

  if (!activePrompt) {
    // Unreachable through the adapter gate (enabled=false fail-closed); guards
    // direct callers from silently prompting with an empty system message.
    throw new Error("system prompt artifact unavailable; candidate generation must fail closed (ADR-0012)");
  }

  return [
    { role: "system", content: activePrompt.body },
    { role: "user", content: userContent },
  ];
}

function candidateObjectSchema(withEnvelope: boolean): Record<string, unknown> {
  const properties: Record<string, unknown> = { ...CANDIDATE_FIELD_SCHEMAS };
  const required = CANDIDATE_FIELDS.filter((f) => !OPTIONAL_CANDIDATE_FIELDS.has(f));
  if (withEnvelope) {
    properties.producer = { type: "string" };
    properties.source_attachment_ids = { type: "array", items: { type: "string" } };
    required.push("producer");
  }
  return { type: "object", required, properties, additionalProperties: false };
}

const ajv = new Ajv({ strict: false, allErrors: true });
const validateCandidateArray = ajv.compile({
  type: "array",
  items: candidateObjectSchema(false),
});
export const validateCandidateFinding = ajv.compile(candidateObjectSchema(false));
export const validateCandidateAtBoundary = ajv.compile(candidateObjectSchema(true));

function labelProducers(items: unknown): CandidateFinding[] {
  return (items as CandidateFinding[]).map((c) => ({
    ...c,
    producer: "safety-reasoning-agent",
  }));
}

function appendContextNotes(messages: ChatMessage[], contextNotes: string[]): ChatMessage[] {
  const note = `Attachments not shown as images (budget): ${contextNotes.join("; ")}`;
  const last = messages[messages.length - 1];
  return [
    ...messages.slice(0, -1),
    {
      role: "user",
      content: typeof last.content === "string" ? `${last.content}\n\n${note}` : last.content,
    },
  ];
}

function ajvErrors(errors: unknown): string {
  return JSON.stringify(errors);
}

export class ZenAiAdapter implements AiAdapter {
  /** ADR-0012 fail-closed: no prompt artifact, no candidate generation. */
  get enabled(): boolean {
    return activePrompt !== null;
  }
  readonly id = "zen";
  private breaker: CircuitBreaker;
  private endpoints: FailoverEndpoint;

  constructor(private cfg: ZenAiConfig) {
    this.breaker = new CircuitBreaker(cfg.breakerThreshold ?? 3);
    this.endpoints = new FailoverEndpoint(
      { baseUrl: cfg.baseUrl ?? DEFAULT_BASE_URL, apiKey: cfg.apiKey },
      cfg.fallbackBaseUrl && cfg.fallbackApiKey
        ? { baseUrl: cfg.fallbackBaseUrl, apiKey: cfg.fallbackApiKey }
        : null,
    );
  }

  async generateCandidates(
    audit: AuditResult,
    images?: string[],
    contextNotes?: string[],
    vocabulary?: CandidateVocabulary,
  ): Promise<CandidateFinding[]> {
    if (this.breaker.open) return [];

    let messages = buildPromptMessages(audit, images, vocabulary);
    if (contextNotes?.length) messages = appendContextNotes(messages, contextNotes);

    const { outcome } = await runInferenceLoop({
      budget: this.cfg.maxCallsPerRun ?? 3,
      initialMessages: messages,
      repairUserMessage: REPAIR_INSTRUCTION,
      complete: (msgs) =>
        chatComplete(
          {
            endpoint: this.endpoints.current,
            model: this.cfg.model ?? DEFAULT_MODEL,
            effort: this.cfg.effort ?? "high",
            timeoutMs: this.cfg.timeoutMs,
            fetchImpl: this.cfg.fetchImpl,
          },
          msgs,
        ),
      extract: extractJsonArray,
      validate: (parsed) => {
        if (!validateCandidateArray(parsed)) throw new Error(ajvErrors(validateCandidateArray.errors));
        return labelProducers(parsed);
      },
      onTransportError: () => this.endpoints.switchToFallback(),
    });

    switch (outcome.status) {
      case "ok":
        this.breaker.recordSuccess();
        return outcome.value;
      case "transport-failed":
        this.recordFailure(`transport failure: ${outcome.reason}`);
        return [];
      case "output-invalid":
        this.recordFailure(`schema violation after one repair retry: ${outcome.reason}`);
        return [];
      case "budget-exhausted":
        this.recordFailure("call budget exhausted");
        return [];
    }
  }

  private recordFailure(reason: string): void {
    this.breaker.recordFailure();
    console.warn(
      `[ai] candidates unavailable (${reason}); consecutive failures=${this.breaker.failureCount}${this.breaker.open ? "; circuit breaker OPEN — deterministic path continues" : ""}`,
    );
  }
}

// ---- Adapter registry --------------------------------------------------------

export type AiAdapterFactory = () => AiAdapter;

const ADAPTER_FACTORIES: Record<string, AiAdapterFactory> = {
  off: () => new OffAiAdapter(),
  zen: () =>
    new ZenAiAdapter({
      apiKey: process.env.OPENCODE_API_KEY!,
      baseUrl: process.env.AI_BASE_URL,
      model: process.env.AI_MODEL,
      effort: (process.env.AI_EFFORT as ReasoningEffort | undefined) ?? "high",
      fallbackBaseUrl: process.env.AI_FALLBACK_BASE_URL,
      fallbackApiKey: process.env.AI_FALLBACK_API_KEY,
    }),
};

const liveSingletons = new Map<string, AiAdapter>();

export function registerAiAdapter(name: string, factory: AiAdapterFactory): void {
  ADAPTER_FACTORIES[name] = factory;
}

export function getAiAdapter(): AiAdapter {
  const enabled = process.env.AI_ENABLED === "true" && !!process.env.OPENCODE_API_KEY;
  if (!enabled) return resolveAdapter("off");
  return resolveAdapter(process.env.AI_ADAPTER ?? "zen");
}

function resolveAdapter(name: string): AiAdapter {
  const factory = ADAPTER_FACTORIES[name];
  if (!factory) throw new Error(`unknown AI_ADAPTER '${name}'`);
  if (name === "off") return factory();
  if (!liveSingletons.has(name)) liveSingletons.set(name, factory());
  return liveSingletons.get(name)!;
}

/** ADR-0012 seam identity of the adapter getAiAdapter() resolves to, for
 *  run-level outcome provenance (PATCH route). Null when unresolvable —
 *  provenance is never invented. */
export function getAiAdapterId(): string | null {
  try {
    return getAiAdapter().id ?? null;
  } catch {
    return null;
  }
}
