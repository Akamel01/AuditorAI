// AI seam (ADR-0001): provider-agnostic, OFF by default. Adapters may emit only
// bounded candidate artifacts; nothing here can produce final determinations.
import Ajv from "ajv/dist/2020.js";
import { getEvidence } from "@/lib/evidence";
import { BANNED_WORDS } from "@/domain/pipeline/wording";
import {
  CircuitBreaker,
  FailoverEndpoint,
  chatComplete,
  extractJsonArray,
  runInferenceLoop,
  type ChatMessage,
  type ReasoningEffort,
} from "@/lib/inference";
import type { AuditResult } from "@/domain/types";

export type CandidateFinding = Pick<
  Finding,
  | "kind"
  | "category"
  | "location"
  | "road_users"
  | "scenario"
  | "statement"
  | "evidence"
  | "assumptions"
  | "rationale"
  | "recommendation"
> & {
  producer: string;
  /** M3: drawing ids this candidate was derived from (vision path). */
  source_attachment_ids?: string[];
};

type Finding = AuditResult["findings"][number];

/** M3 vision budget: max drawings passed as image blocks per judge/candidate call. */
export const MAX_IMAGES_PER_CALL = 4;

export interface CandidateVocabulary {
  issue_categories: readonly string[];
  road_user_categories: readonly string[];
}

export interface AiAdapter {
  readonly enabled: boolean;
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

function schemaSketch(schema: JsonSchemaish): string {
  if (schema.enum) return schema.enum.map((v) => `"${v}"`).join("|");
  if (Array.isArray(schema.type)) return schema.type.join("|");
  if (schema.type === "array") {
    const items = schemaSketch(schema.items ?? {});
    return items.startsWith("{") ? `[${items}]` : `${items}[]`;
  }
  if (schema.type === "object") {
    return `{${Object.entries(schema.properties ?? {})
      .map(([k, v]) => `"${k}":${schemaSketch(v)}`)
      .join(",")}}`;
  }
  return String(schema.type);
}

const CANDIDATE_JSON_TEMPLATE = `{${CANDIDATE_FIELDS.map(
  (f) => `"${f}":${schemaSketch(CANDIDATE_FIELD_SCHEMAS[f])}`,
).join(",")}}`;

const SYSTEM_PROMPT = [
  "You assist a Road Safety Audit by proposing bounded candidate findings for human adjudication.",
  "Doctrine you must follow:",
  "- You never make final determinations; a qualified auditor disposes of every candidate.",
  "- Compliance questions and safety concerns are categorically distinct; do not blur them.",
  "- Every normative claim must cite an evidence_id given to you; invent nothing.",
  `- Recommendations must be specific and actionable; the words ${BANNED_WORDS.map((w) => `'${w}'`).join(" and ")} are banned.`,
  `Respond with ONLY a JSON array. Each item: ${CANDIDATE_JSON_TEMPLATE}.`,
].join("\n");

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

  return [
    { role: "system", content: SYSTEM_PROMPT },
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
  readonly enabled = true;
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
