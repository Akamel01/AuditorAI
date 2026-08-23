// Shared inference infrastructure: OpenAI-compatible transport, resilience
// primitives (circuit breaker, failover, repair-once loop) and JSON extraction.
// Adapters compose these behind the AiAdapter seam; nothing here knows about
// findings or audit doctrine.
export type ReasoningEffort = "low" | "high" | "max";

export interface ChatTextPart {
  type: "text";
  text: string;
}

export interface ChatImagePart {
  type: "image_url";
  image_url: { url: string };
}

export type ChatContent = string | (ChatTextPart | ChatImagePart)[];

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: ChatContent;
}

export interface ChatEndpoint {
  baseUrl: string;
  apiKey: string;
}

export interface ChatCallConfig {
  endpoint: ChatEndpoint;
  model: string;
  effort: ReasoningEffort;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export const DEFAULT_TIMEOUT_MS = 60_000;

/** One chat-completion call with abort-timeout and reasoning_effort discovery. */
export async function chatComplete(
  cfg: ChatCallConfig,
  messages: ChatMessage[],
): Promise<string> {
  return await completeOnce(cfg, messages, true);
}

async function completeOnce(
  cfg: ChatCallConfig,
  messages: ChatMessage[],
  withEffort: boolean,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const res = await (cfg.fetchImpl ?? fetch)(`${cfg.endpoint.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.endpoint.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        ...(withEffort ? { reasoning_effort: cfg.effort } : {}),
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (res.status === 400) {
      const body = await safeText(res);
      if (withEffort && body.includes("reasoning_effort")) {
        return await completeOnce(cfg, messages, false);
      }
      throw new Error(`HTTP 400: ${truncate(body)}`);
    }
    if (res.status === 429) throw new Error("HTTP 429 rate limited");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content;
    if (typeof content !== "string")
      throw new Error(
        withEffort ? "response missing choices[0].message.content" : "response missing content",
      );
    return content;
  } finally {
    clearTimeout(timer);
  }
}

export class CircuitBreaker {
  private consecutiveFailures = 0;

  constructor(private readonly threshold: number) {}

  get open(): boolean {
    return this.consecutiveFailures >= this.threshold;
  }

  get failureCount(): number {
    return this.consecutiveFailures;
  }

  recordFailure(): void {
    this.consecutiveFailures += 1;
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0;
  }
}

export class FailoverEndpoint {
  private currentBase: string;
  private currentKey: string;
  private fallbackBase: string | null;
  private fallbackKey: string | null;
  private spent = false;

  constructor(primary: ChatEndpoint, fallback: ChatEndpoint | null = null) {
    this.currentBase = stripTrailingSlash(primary.baseUrl);
    this.currentKey = primary.apiKey;
    this.fallbackBase = fallback ? stripTrailingSlash(fallback.baseUrl) : null;
    this.fallbackKey = fallback?.apiKey ?? null;
  }

  get current(): ChatEndpoint {
    return { baseUrl: this.currentBase, apiKey: this.currentKey };
  }

  get fallbackSpent(): boolean {
    return this.spent;
  }

  /** Switches once; false when unavailable or already spent. */
  switchToFallback(): boolean {
    if (this.spent || !this.fallbackBase) return false;
    this.currentBase = this.fallbackBase;
    this.currentKey = this.fallbackKey!;
    this.spent = true;
    return true;
  }
}

export function stripTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export function describeError(e: unknown): string {
  if (e instanceof Error && e.name === "AbortError") return "timeout";
  return e instanceof Error ? e.message : String(e);
}

function stripFences(content: string): string {
  return content.replace(/```(?:json)?/g, "").trim();
}

export function extractJsonArray(content: string): unknown {
  const stripped = stripFences(content);
  const start = stripped.indexOf("[");
  const end = stripped.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) throw new Error("no JSON array found");
  return JSON.parse(stripped.slice(start, end + 1));
}

export function extractJsonObject(content: string): unknown {
  const stripped = stripFences(content);
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("no JSON object found");
  return JSON.parse(stripped.slice(start, end + 1));
}

export const DEFAULT_MAX_CALLS_PER_RUN = 3;

export type InferenceOutcome<T> =
  | { status: "ok"; value: T }
  | { status: "transport-failed"; reason: string }
  | { status: "output-invalid"; reason: string }
  | { status: "budget-exhausted" };

export interface InferenceLoopConfig<T> {
  initialMessages: ChatMessage[];
  budget: number;
  repairUserMessage: string;
  complete(messages: ChatMessage[]): Promise<string>;
  extract(content: string): unknown;
  validate(parsed: unknown): T;
  /** Return true to reroute to a fallback provider: consumes a call, not a repair. */
  onTransportError(error: unknown): boolean;
}

export async function runInferenceLoop<T>(
  cfg: InferenceLoopConfig<T>,
): Promise<{ outcome: InferenceOutcome<T>; messages: ChatMessage[] }> {
  let messages = cfg.initialMessages;
  let repairsUsed = 0;
  for (let call = 0; call < cfg.budget; call++) {
    let content: string | null = null;
    try {
      content = await cfg.complete(messages);
    } catch (e) {
      if (cfg.onTransportError(e)) continue;
      return { outcome: { status: "transport-failed", reason: describeError(e) }, messages };
    }
    try {
      const parsed = cfg.extract(content);
      return { outcome: { status: "ok", value: cfg.validate(parsed) }, messages };
    } catch (e) {
      if (repairsUsed >= 1) {
        return { outcome: { status: "output-invalid", reason: describeError(e) }, messages };
      }
      repairsUsed += 1;
      messages = [
        ...messages,
        { role: "assistant", content: content ?? "" },
        { role: "user", content: cfg.repairUserMessage },
      ];
    }
  }
  return { outcome: { status: "budget-exhausted" }, messages };
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
