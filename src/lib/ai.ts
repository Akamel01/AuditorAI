// AI seam (ADR-0001): provider-agnostic, OFF by default. Adapters may emit only
// bounded candidate artifacts; nothing here can produce final determinations.
import Ajv from "ajv/dist/2020.js";
import { getEvidence } from "@/lib/evidence";
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
> & { producer: string };

type Finding = AuditResult["findings"][number];

export interface AiAdapter {
  readonly enabled: boolean;
  /** Generate bounded candidate findings for human adjudication. */
  generateCandidates(audit: AuditResult): Promise<CandidateFinding[]>;
}

export class OffAiAdapter implements AiAdapter {
  readonly enabled = false;
  async generateCandidates(): Promise<CandidateFinding[]> {
    return [];
  }
}

// ---- Zen adapter (A1): OpenAI-compatible, fetch-only, strict boundary -------

export type ReasoningEffort = "low" | "high" | "max";

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

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content:
    | string
    | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[];
}

const DEFAULT_BASE_URL = "https://opencode.ai/zen/v1";
const DEFAULT_MODEL = "x-preview-f-free";

const SYSTEM_PROMPT = [
  "You assist a Road Safety Audit by proposing bounded candidate findings for human adjudication.",
  "Doctrine you must follow:",
  "- You never make final determinations; a qualified auditor disposes of every candidate.",
  "- Compliance questions and safety concerns are categorically distinct; do not blur them.",
  "- Every normative claim must cite an evidence_id given to you; invent nothing.",
  "- Recommendations must be specific and actionable; the words 'consider' and 'must' are banned.",
  'Respond with ONLY a JSON array. Each item: {"kind":"safety_concern"|"compliance_question","category":string,"location":string|null,"road_users":string[],"scenario":string|null,"statement":{"text":string,"normative_basis_note":string|null},"evidence":[{"evidence_id":string,"quote":string|null,"use":"supports_concern"|"defines_requirement"|"context"}],"assumptions":[{"text":string,"basis":string|null}],"rationale":string,"recommendation":string|null}.',
].join("\n");

const REPAIR_INSTRUCTION =
  "Your previous output was rejected (malformed JSON or schema violation). Return ONLY the JSON array, no prose, no code fences.";

export function buildPromptMessages(
  audit: AuditResult,
  images?: string[],
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
    `Audit context: ${audit.jurisdiction} / ${audit.framework_name} / native stage ${audit.native_stage_id}.`,
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

const candidateFindingSchema = {
  type: "object",
  required: [
    "kind",
    "category",
    "statement",
    "evidence",
    "assumptions",
    "rationale",
  ],
  properties: {
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
  },
  additionalProperties: false,
} as const;

const ajv = new Ajv({ strict: false, allErrors: true });
const validateCandidateArray = ajv.compile({
  type: "array",
  items: candidateFindingSchema,
});

function extractJsonArray(content: string): unknown {
  const stripped = content.replace(/```(?:json)?/g, "").trim();
  const start = stripped.indexOf("[");
  const end = stripped.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) throw new Error("no JSON array found");
  return JSON.parse(stripped.slice(start, end + 1));
}

function labelProducers(items: unknown): CandidateFinding[] {
  return (items as CandidateFinding[]).map((c) => ({
    ...c,
    producer: "safety-reasoning-agent",
  }));
}

export class ZenAiAdapter implements AiAdapter {
  readonly enabled = true;
  private consecutiveFailures = 0;
  private currentBase: string;
  private currentKey: string;
  private fallbackSpent = false;

  constructor(private cfg: ZenAiConfig) {
    this.currentBase = stripTrailingSlash(cfg.baseUrl ?? DEFAULT_BASE_URL);
    this.currentKey = cfg.apiKey;
  }

  private get open(): boolean {
    return this.consecutiveFailures >= (this.cfg.breakerThreshold ?? 3);
  }

  async generateCandidates(audit: AuditResult): Promise<CandidateFinding[]> {
    if (this.open) return [];

    let messages = buildPromptMessages(audit);
    const maxCalls = this.cfg.maxCallsPerRun ?? 3;
    let repairsUsed = 0;

    for (let call = 0; call < maxCalls; call++) {
      let content: string | null = null;
      try {
        content = await this.complete(messages);
      } catch (e) {
        if (!this.fallbackSpent && this.cfg.fallbackBaseUrl && this.cfg.fallbackApiKey) {
          this.currentBase = stripTrailingSlash(this.cfg.fallbackBaseUrl);
          this.currentKey = this.cfg.fallbackApiKey;
          this.fallbackSpent = true;
          continue; // fallback attempt does not consume the repair budget twice
        }
        this.recordFailure(`transport failure: ${describe(e)}`);
        return [];
      }

      try {
        const parsed = extractJsonArray(content);
        if (validateCandidateArray(parsed)) {
          this.consecutiveFailures = 0;
          return labelProducers(parsed);
        }
        throw new Error(ajvErrors(validateCandidateArray.errors));
      } catch (e) {
        if (repairsUsed >= 1) {
          // Contract: ONE repair retry, then graceful empty.
          this.recordFailure(`schema violation after one repair retry: ${describe(e)}`);
          return [];
        }
        repairsUsed += 1;
        messages = [
          ...messages,
          { role: "assistant", content: content ?? "" },
          { role: "user", content: REPAIR_INSTRUCTION },
        ];
      }
    }
    this.recordFailure("call budget exhausted");
    return [];
  }

  private async complete(messages: ChatMessage[]): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs ?? 60_000);
    try {
      const res = await (this.cfg.fetchImpl ?? fetch)(`${this.currentBase}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.currentKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.cfg.model ?? DEFAULT_MODEL,
          messages,
          reasoning_effort: this.cfg.effort ?? "high",
        }),
        signal: controller.signal,
        cache: "no-store",
      });
      if (res.status === 400) {
        // reasoning_effort wire-param discovery: some gateways reject it.
        const body = await safeText(res);
        if (body.includes("reasoning_effort")) {
          return await this.completeWithoutEffort(messages);
        }
        throw new Error(`HTTP 400: ${truncate(body)}`);
      }
      if (res.status === 429) throw new Error("HTTP 429 rate limited");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = json.choices?.[0]?.message?.content;
      if (typeof content !== "string") throw new Error("response missing choices[0].message.content");
      return content;
    } finally {
      clearTimeout(timer);
    }
  }

  private async completeWithoutEffort(messages: ChatMessage[]): Promise<string> {
    const res = await (this.cfg.fetchImpl ?? fetch)(`${this.currentBase}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.currentKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: this.cfg.model ?? DEFAULT_MODEL, messages }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} (without reasoning_effort)`);
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("response missing content");
    return content;
  }

  private recordFailure(reason: string): void {
    this.consecutiveFailures += 1;
    console.warn(
      `[ai] candidates unavailable (${reason}); consecutive failures=${this.consecutiveFailures}${this.open ? "; circuit breaker OPEN — deterministic path continues" : ""}`,
    );
  }
}

function stripTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function ajvErrors(errors: unknown): string {
  return JSON.stringify(errors);
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

function truncate(s: string, n = 200): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function describe(e: unknown): string {
  if (e instanceof Error && e.name === "AbortError") return "timeout";
  return e instanceof Error ? e.message : String(e);
}

let liveSingleton: ZenAiAdapter | null = null;

export function getAiAdapter(): AiAdapter {
  const enabled = process.env.AI_ENABLED === "true" && !!process.env.OPENCODE_API_KEY;
  if (!enabled) {
    // Only 'off' ships unless explicitly enabled; future adapters register behind this seam.
    return new OffAiAdapter();
  }
  liveSingleton ??= new ZenAiAdapter({
    apiKey: process.env.OPENCODE_API_KEY!,
    baseUrl: process.env.AI_BASE_URL,
    model: process.env.AI_MODEL,
    effort: (process.env.AI_EFFORT as ReasoningEffort | undefined) ?? "high",
    fallbackBaseUrl: process.env.AI_FALLBACK_BASE_URL,
    fallbackApiKey: process.env.AI_FALLBACK_API_KEY,
  });
  return liveSingleton;
}
