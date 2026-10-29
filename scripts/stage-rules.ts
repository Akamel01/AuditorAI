/**
 * Pure stage classifier for ticket #62 — the versioned rule sets
 * (`docs/research/stage-rules/stage-rules.v{1,2}.json`) turned into a decision.
 *
 * PURE BY CONTRACT (plan M2.1): this module imports nothing, touches no file
 * and opens no socket. `loadRuleSet` takes an already-parsed JSON value and
 * validates it; `classify` is a total function of (text, title, hint, rule
 * set). Reading the rule files is the caller's job (M3's CLI).
 *
 * Deterministic: no clock, no randomness, no locale-dependent sorting, no
 * floats. The same input always yields the same decision.
 */

export type Confidence = "authoritative" | "interpreted" | "inferred";
export type CanonicalStage =
  | "FEASIBILITY_CONCEPT"
  | "PRELIMINARY_DESIGN"
  | "DETAILED_DESIGN"
  | "PRE_OPENING"
  | "EXISTING"
  | "CONSTRUCTION";
/** MULTI_STAGE is the frozen v1 token: a document naming several stages. */
export type StageToken = CanonicalStage | "MULTI_STAGE";
export type RuleTier = 1 | 2;
export type RuleLanguage = "en" | "fr";
export type RuleScope = "text" | "title" | "any";
export type EvidenceScope = "body" | "title" | "hint";
export type DecisionSource = "text" | "title" | "hint";
export type StageOrUnstaged = StageToken | "UNSTAGED";
export type ConfidenceForm = "named" | "derived";
export type EvidenceKind = "reference-doc" | "corpus" | "ticket-declared";

export interface RuleEvidence {
  phrase: string;
  kind: EvidenceKind;
  reference_doc?: string;
  corpus_sha256?: string;
  attested: boolean;
  note?: string;
}

export interface StageRule {
  id: string;
  pattern: string;
  flags: string;
  scope: RuleScope;
  tier: RuleTier;
  language: RuleLanguage;
  /** The rule's stage. Absent on an ambiguity rule (candidates) and on an asset rule. */
  stage?: CanonicalStage;
  /** The contested pair of an ambiguity rule (tier 2). */
  candidates?: CanonicalStage[];
  /** Asset metadata only (D10): never a stage, never a cell. */
  asset_type?: string;
  confidence_form: ConfidenceForm;
  evidence: RuleEvidence[];
  source_line?: string;
}

export interface SectionConfig {
  enabled: boolean;
  min_section_chars: number;
  max_heading_chars: number;
}

export interface SectionSpan {
  start: number;
  end: number;
}

export interface SectionDecision {
  heading: string;
  span: SectionSpan;
  candidate: StageCandidate;
  evidence_region: "heading" | "body";
}

export interface DocumentDecision {
  decision: StageDecision;
  sections: SectionDecision[];
}

export interface RuleSet {
  rule_set_version: string;
  frozen: boolean;
  scan: { mode: string; chars: number; normalize?: string };
  cells: Record<string, string>;
  rules: StageRule[];
  sections?: SectionConfig;
}

export interface StageCandidate {
  stage: StageToken;
  cell_key: string;
  confidence: Confidence;
  rule_ids: string[];
  evidence_scope: EvidenceScope;
  /** The rule's evidence phrase when it is what matched, else the matched text. */
  matched_phrase: string;
  /** Char offset of the match inside its region; -1 for a hint. */
  offset: number;
}

export interface StageDecision {
  rule_set_version: string;
  stage: StageOrUnstaged;
  cell_key: string;
  /** null when no candidate (D1). */
  confidence: Confidence | null;
  /** candidates.length >= 2. */
  ambiguous: boolean;
  /** Ordered best-first, never truncated, never collapsed. */
  candidates: StageCandidate[];
  asset_type: string | null;
  scope_basis: "own_scope" | "taxonomy_reference";
  text_chars_scanned: number;
  truncated: boolean;
  source: DecisionSource;
  body_available: boolean;
}

const CANONICAL_STAGES: CanonicalStage[] = [
  "FEASIBILITY_CONCEPT",
  "PRELIMINARY_DESIGN",
  "DETAILED_DESIGN",
  "PRE_OPENING",
  "EXISTING",
  "CONSTRUCTION",
];

const SCOPES: RuleScope[] = ["text", "title", "any"];
const CONFIDENCE_FORMS: ConfidenceForm[] = ["named", "derived"];

/**
 * D1's own interpreted example: a bare stage ordinal ("Stage 2") names a stage
 * number, not a stage phrase, so it never reads as `named`.
 */
const BARE_STAGE_ORDINAL = /^\s*stage\s*(?:\d+|one|two|three)\s*$/i;

/** The document's own subject line, else its first 600 characters (the harvester's rule). */
const SUBJECT_LINE = /\b(?:SUBJECT|TITLE|RE)\s*:\s*([^\n]{0,200})/i;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function cellOf(cells: Record<string, string>, stage: string): string {
  return cells[stage] ?? "";
}

/**
 * The loader is a pure validator: it takes the already-parsed JSON value and
 * returns a rule set, or throws. It never reads the file itself.
 */
export function loadRuleSet(json: unknown): RuleSet {
  if (!isObject(json)) throw new Error("stage-rules: rule set must be an object");
  const version = json.rule_set_version;
  if (typeof version !== "string" || version === "") {
    throw new Error("stage-rules: rule_set_version must be a non-empty string");
  }
  if (!isObject(json.cells)) throw new Error("stage-rules: cells must be an object");
  const cells: Record<string, string> = {};
  for (const [key, value] of Object.entries(json.cells)) {
    if (typeof value !== "string") throw new Error(`stage-rules: cell ${key} must be a string`);
    cells[key] = value;
  }
  if (!isObject(json.scan) || typeof json.scan.chars !== "number" || json.scan.chars <= 0) {
    throw new Error("stage-rules: scan.chars must be a positive number");
  }
  const scan = {
    mode: typeof json.scan.mode === "string" ? json.scan.mode : "whole",
    chars: json.scan.chars,
    ...(typeof json.scan.normalize === "string" ? { normalize: json.scan.normalize } : {}),
  };
  if (!Array.isArray(json.rules) || json.rules.length === 0) {
    throw new Error("stage-rules: rules must be a non-empty array");
  }
  // v1 is the frozen historical baseline: its rules carry no evidence by design.
  const requiresEvidence = version !== "v1";
  const seen = new Set<string>();
  const rules = json.rules.map((raw, index) => {
    if (!isObject(raw)) throw new Error(`stage-rules: rule ${index} must be an object`);
    const id = raw.id;
    if (typeof id !== "string" || id === "") {
      throw new Error(`stage-rules: rule ${index} needs a non-empty id`);
    }
    if (seen.has(id)) throw new Error(`stage-rules: duplicate rule id ${id}`);
    seen.add(id);
    const pattern = raw.pattern;
    if (typeof pattern !== "string" || pattern === "") {
      throw new Error(`stage-rules: rule ${id} needs a pattern`);
    }
    const flags = raw.flags;
    if (typeof flags !== "string") throw new Error(`stage-rules: rule ${id} needs flags`);
    try {
      new RegExp(pattern, flags.replace(/[gy]/g, ""));
    } catch (error) {
      throw new Error(`stage-rules: rule ${id} has an invalid pattern: ${String(error)}`);
    }
    if (!SCOPES.includes(raw.scope as RuleScope)) {
      throw new Error(`stage-rules: rule ${id} has an invalid scope`);
    }
    if (raw.tier !== 1 && raw.tier !== 2) throw new Error(`stage-rules: rule ${id} has an invalid tier`);
    if (!CONFIDENCE_FORMS.includes(raw.confidence_form as ConfidenceForm)) {
      throw new Error(`stage-rules: rule ${id} has an invalid confidence_form`);
    }
    if (raw.stage !== undefined && !CANONICAL_STAGES.includes(raw.stage as CanonicalStage)) {
      throw new Error(`stage-rules: rule ${id} has an unknown stage`);
    }
    const evidence: RuleEvidence[] = [];
    if (raw.evidence !== undefined) {
      if (!Array.isArray(raw.evidence)) throw new Error(`stage-rules: rule ${id} has invalid evidence`);
      for (const entry of raw.evidence) {
        if (!isObject(entry) || typeof entry.phrase !== "string" || typeof entry.attested !== "boolean") {
          throw new Error(`stage-rules: rule ${id} has an invalid evidence entry`);
        }
        evidence.push({
          phrase: entry.phrase,
          kind: entry.kind as EvidenceKind,
          attested: entry.attested,
          ...(typeof entry.reference_doc === "string" ? { reference_doc: entry.reference_doc } : {}),
          ...(typeof entry.corpus_sha256 === "string" ? { corpus_sha256: entry.corpus_sha256 } : {}),
          ...(typeof entry.note === "string" ? { note: entry.note } : {}),
        });
      }
    }
    if (requiresEvidence && evidence.length === 0) {
      throw new Error(`stage-rules: rule ${id} has no evidence`);
    }
    const candidates: CanonicalStage[] = [];
    if (raw.candidates !== undefined) {
      if (!Array.isArray(raw.candidates)) throw new Error(`stage-rules: rule ${id} has invalid candidates`);
      if (raw.candidates.length === 0) throw new Error(`stage-rules: rule ${id} has empty candidates`);
      for (const stage of raw.candidates) {
        if (!CANONICAL_STAGES.includes(stage as CanonicalStage)) {
          throw new Error(`stage-rules: rule ${id} has an unknown candidate ${String(stage)}`);
        }
        candidates.push(stage as CanonicalStage);
      }
    }
    const assetType = raw.asset_type;
    if (assetType !== undefined && typeof assetType !== "string") {
      throw new Error(`stage-rules: rule ${id} has an invalid asset_type`);
    }
    // An asset rule records metadata only: it may never carry a stage (D10).
    if (assetType !== undefined && raw.stage !== undefined) {
      throw new Error(`stage-rules: asset rule ${id} must not carry a stage`);
    }
    if (raw.tier === 2) {
      if (candidates.length !== 2) {
        throw new Error(`stage-rules: tier-2 rule ${id} must carry exactly two candidates`);
      }
      if (raw.stage !== undefined) throw new Error(`stage-rules: tier-2 rule ${id} must not carry a stage`);
    } else if (raw.stage === undefined && assetType === undefined) {
      throw new Error(`stage-rules: rule ${id} carries neither a stage nor an asset_type`);
    }
    return {
      id,
      pattern,
      flags,
      scope: raw.scope as RuleScope,
      tier: raw.tier as RuleTier,
      language: raw.language as RuleLanguage,
      ...(raw.stage !== undefined ? { stage: raw.stage as CanonicalStage } : {}),
      ...(candidates.length > 0 ? { candidates } : {}),
      ...(typeof assetType === "string" ? { asset_type: assetType } : {}),
      confidence_form: raw.confidence_form as ConfidenceForm,
      evidence,
      ...(typeof raw.source_line === "string" ? { source_line: raw.source_line } : {}),
    };
  });
  let sections: SectionConfig | undefined;
  if (json.sections !== undefined) {
    if (!isObject(json.sections)) throw new Error("stage-rules: sections must be an object");
    const sec = json.sections;
    if (typeof sec.enabled !== "boolean") throw new Error("stage-rules: sections.enabled must be boolean");
    for (const key of ["min_section_chars", "max_heading_chars"] as const) {
      if (typeof sec[key] !== "number" || !Number.isInteger(sec[key]) || sec[key] <= 0)
        throw new Error(`stage-rules: sections.${key} must be a positive integer`);
    }
    sections = {
      enabled: sec.enabled,
      min_section_chars: sec.min_section_chars as number,
      max_heading_chars: sec.max_heading_chars as number,
    };
  }
  return {
    rule_set_version: version,
    frozen: json.frozen === true,
    scan,
    cells,
    rules,
    ...(sections ? { sections } : {}),
  };
}

interface Hit {
  rule: StageRule;
  order: number;
  stage: CanonicalStage;
  scope: "body" | "title";
  offset: number;
  matched: string;
}

/** Title evidence beats body evidence: the title is the document's own name. */
function compareHits(a: Hit, b: Hit): number {
  if (a.scope !== b.scope) return a.scope === "title" ? -1 : 1;
  if (a.rule.tier !== b.rule.tier) return a.rule.tier - b.rule.tier;
  return a.order - b.order;
}

function matchedPhrase(rule: StageRule, matched: string): string {
  const text = collapse(matched).toLowerCase();
  for (const entry of rule.evidence) {
    const phrase = collapse(entry.phrase).toLowerCase();
    if (phrase && text.includes(phrase)) return collapse(entry.phrase);
  }
  return collapse(matched);
}

/** The subject region of the body: its subject line, else its first 600 characters. */
function subjectRegion(body: string): { start: number; end: number } {
  const head = body.slice(0, 600);
  const match = SUBJECT_LINE.exec(head);
  if (!match) return { start: 0, end: head.length };
  const captured = match[1];
  const start = match.index + match[0].lastIndexOf(captured);
  return { start, end: start + captured.length };
}

const CONFIDENCE_RANK: Record<Confidence, number> = {
  inferred: 1,
  interpreted: 2,
  authoritative: 3,
};

/**
 * Classify a document against a rule set. Total and deterministic: every input
 * yields a decision, and the same input always yields the same decision.
 */
export function classify(
  text: string,
  ctx: { title: string; hint: string },
  ruleSet: RuleSet,
): StageDecision {
  const cap = ruleSet.scan.chars;
  // v1 has no normalisation declared: it must stay byte-faithful to the live
  // harvester. v2 declares NFC.
  const normalize = typeof ruleSet.scan.normalize === "string" ? ruleSet.scan.normalize : null;
  const body = normalize ? text.normalize(normalize) : text;
  const regionB = body.slice(0, cap);
  const truncated = body.length > cap;
  const regionT = normalize ? ctx.title.normalize(normalize) : ctx.title;
  const compiled = ruleSet.rules.map((rule, order) => ({
    rule,
    order,
    re: new RegExp(rule.pattern, rule.flags.replace(/[gy]/g, "")),
  }));

  const scan = (rule: StageRule, re: RegExp, order: number): Hit | null => {
    const regions: Array<{ scope: "body" | "title"; text: string }> =
      rule.scope === "text"
        ? [{ scope: "body", text: regionB }]
        : rule.scope === "title"
          ? [{ scope: "title", text: regionT }]
          : [
              { scope: "body", text: regionB },
              { scope: "title", text: regionT },
            ];
    let best: Hit | null = null;
    for (const region of regions) {
      if (!region.text) continue;
      const match = re.exec(region.text);
      if (!match) continue;
      const hit: Hit = {
        rule,
        order,
        stage: rule.stage as CanonicalStage,
        scope: region.scope,
        offset: match.index,
        matched: collapse(match[0]),
      };
      if (!best || compareHits(hit, best) < 0) best = hit;
    }
    return best;
  };

  // Tier-1 rules decide; tier-2 (ambiguity) rules fire only when tier 1 is
  // empty (D11). An asset rule is metadata only and never yields a stage.
  const hits: Hit[] = [];
  for (const entry of compiled) {
    if (entry.rule.tier !== 1 || !entry.rule.stage) continue;
    const hit = scan(entry.rule, entry.re, entry.order);
    if (hit) hits.push(hit);
  }
  if (hits.length === 0) {
    for (const entry of compiled) {
      if (entry.rule.tier !== 2 || !entry.rule.candidates) continue;
      const hit = scan(entry.rule, entry.re, entry.order);
      if (!hit) continue;
      for (const stage of entry.rule.candidates) hits.push({ ...hit, stage });
    }
  }

  let assetType: string | null = null;
  for (const entry of compiled) {
    if (!entry.rule.asset_type || entry.rule.tier !== 1) continue;
    if (assetType !== null) continue;
    if (scan(entry.rule, entry.re, entry.order)) assetType = entry.rule.asset_type;
  }

  const byStage = new Map<CanonicalStage, Hit[]>();
  for (const hit of hits) {
    const bucket = byStage.get(hit.stage);
    if (bucket) bucket.push(hit);
    else byStage.set(hit.stage, [hit]);
  }

  const candidateCount = byStage.size;
  const candidates: StageCandidate[] = [];
  for (const [stage, stageHits] of byStage) {
    const ordered = [...stageHits].sort(compareHits);
    const representative = ordered[0];
    const cellKey = cellOf(ruleSet.cells, stage);
    candidates.push({
      stage,
      cell_key: cellKey,
      confidence: candidateConfidence(representative, cellKey, candidateCount),
      rule_ids: [...new Set(ordered.map((hit) => hit.rule.id))],
      evidence_scope: representative.scope,
      matched_phrase: matchedPhrase(representative.rule, representative.matched),
      offset: representative.offset,
    });
  }
  candidates.sort((a, b) => {
    const aHits = byStage.get(a.stage as CanonicalStage) ?? [];
    const bHits = byStage.get(b.stage as CanonicalStage) ?? [];
    const aTier = Math.min(...aHits.map((hit) => hit.rule.tier));
    const bTier = Math.min(...bHits.map((hit) => hit.rule.tier));
    if (aTier !== bTier) return aTier - bTier;
    const aOrder = Math.min(...aHits.map((hit) => hit.order));
    const bOrder = Math.min(...bHits.map((hit) => hit.order));
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.stage < b.stage ? -1 : a.stage > b.stage ? 1 : 0;
  });

  const ambiguous = candidates.length >= 2;
  const hint = ctx.hint === "" ? "UNSTAGED" : ctx.hint;
  const stage: StageOrUnstaged =
    candidates.length === 0
      ? (hint as StageOrUnstaged)
      : ambiguous
        ? "MULTI_STAGE"
        : (candidates[0].stage as StageOrUnstaged);
  const cellKey = ambiguous ? "" : (candidates[0]?.cell_key ?? "");
  const confidence =
    candidates.length === 0
      ? null
      : candidates.reduce<Confidence>(
          (weakest, candidate) =>
            CONFIDENCE_RANK[candidate.confidence] < CONFIDENCE_RANK[weakest]
              ? candidate.confidence
              : weakest,
          candidates[0].confidence,
        );
  const source: DecisionSource =
    candidates.length === 0 ? "hint" : candidates[0].evidence_scope === "title" ? "title" : "text";

  const subject = subjectRegion(regionB);
  const ownScopeHits = hits.filter(
    (hit) => hit.scope === "title" || (hit.offset >= subject.start && hit.offset < subject.end),
  );
  const scopeBasis: "own_scope" | "taxonomy_reference" =
    candidates.length >= 3 && ownScopeHits.length === 0 ? "taxonomy_reference" : "own_scope";

  return {
    rule_set_version: ruleSet.rule_set_version,
    stage,
    cell_key: cellKey,
    confidence,
    ambiguous,
    candidates,
    asset_type: assetType,
    scope_basis: scopeBasis,
    text_chars_scanned: regionB.length,
    truncated,
    source,
    body_available: regionB.length > 0,
  };
}

/**
 * D1: one candidate and a named rule with a canonical cell is `authoritative`;
 * a derived signal is `interpreted`; two or more candidates, a no-cell bucket
 * (D12) or an asset-only record are `inferred`.
 */
function candidateConfidence(representative: Hit, cellKey: string, candidateCount: number): Confidence {
  if (candidateCount >= 2) return "inferred";
  if (cellKey === "") return "inferred";
  if (representative.rule.confidence_form === "derived") return "interpreted";
  if (BARE_STAGE_ORDINAL.test(representative.matched)) return "interpreted";
  return "authoritative";
}

// ---------- v3 sectioning (additive; classify above is untouched) ----------

const SECTION_CONNECTORS = new Set([
  "a", "an", "the", "of", "and", "or", "in", "to", "for", "by", "on", "at", "as", "vs",
  "de", "la", "le", "les", "des", "du", "et", "en", "au", "aux",
]);

interface LineInfo { start: number; end: number; text: string; }

function splitLines(region: string): LineInfo[] {
  const out: LineInfo[] = [];
  let start = 0;
  for (let i = 0; i <= region.length; i++) {
    if (i === region.length || region[i] === "\n") {
      let end = i;
      if (end > start && region[end - 1] === "\r") end -= 1;
      out.push({ start, end, text: region.slice(start, end) });
      start = i + 1;
    }
  }
  return out;
}

function namedTier1Map(ruleSet: RuleSet): Map<string, CanonicalStage> {
  const m = new Map<string, CanonicalStage>();
  for (const rule of ruleSet.rules) {
    if (rule.tier === 1 && rule.confidence_form === "named" && rule.stage) {
      m.set(rule.id, rule.stage);
    }
  }
  return m;
}

function namedStagesOf(text: string, ruleSet: RuleSet): Set<CanonicalStage> {
  const nt1 = namedTier1Map(ruleSet);
  const d = classify(text, { title: "", hint: "UNSTAGED" }, ruleSet);
  const set = new Set<CanonicalStage>();
  for (const cand of d.candidates) {
    if (cand.rule_ids.some((id) => nt1.get(id) === cand.stage)) {
      set.add(cand.stage as CanonicalStage);
    }
  }
  return set;
}

function isReferenceList(t: string): boolean {
  if (/\b(?:19|20)\d{2}\b/.test(t) && /[,"]/.test(t)) return true;
  if (/^\p{Lu}[\p{L}'’.-]+(?:\s+\p{Lu}{1,3})?,\s/u.test(t)) return true;
  return false;
}

function stripTrailingNumber(t: string): string {
  const m = t.match(/\s+\d{1,4}\s*$/);
  if (!m || m.index === undefined) return t.trim();
  return t.slice(0, m.index).replace(/[.\s]+$/, "").trim();
}

function rawShape(t: string, ruleSet: RuleSet, cfg: SectionConfig): "numbered" | "allcaps" | "titlecase" | null {
  const c = collapse(t);
  if (c.length === 0 || c.length > cfg.max_heading_chars) return null;
  if (isReferenceList(c)) return null;
  const nm = c.match(/^(\d{1,3}(?:\.\d{1,3}){0,3})\.?\s+(\S.*)$/);
  const rm = c.match(/^([IVXLC]{1,6})\.?\s+(\S.*)$/);
  if (nm || rm) {
    const rest = (nm || rm)![2];
    const toks = rest.split(/\s+/);
    if (toks.length < 1 || toks.length > 10) return null;
    if (/[.!?]\s+\p{Ll}/u.test(rest) || /[.!?]$/.test(rest)) return null;
    if (/(?:\.{2,}|…)\s*\d{1,4}$/.test(c)) return null;
    return "numbered";
  }
  if (c.length <= 80 && /\p{L}/u.test(c) && !/\p{Ll}/u.test(c)) {
    if (/(?:\.{2,}|…)\s*\d{1,4}$/.test(c)) return null;
    return "allcaps";
  }
  const toks = c.split(/\s+/);
  if (toks.length >= 1 && toks.length <= 16) {
    let relevant = 0;
    let title = 0;
    for (const w of toks) {
      const stripped = w.replace(/^[^\p{L}]+/u, "");
      if (!stripped || !/\p{L}/u.test(stripped)) continue;
      if (SECTION_CONNECTORS.has(stripped.toLowerCase())) continue;
      relevant++;
      if (/^\p{Lu}/u.test(stripped)) title++;
    }
    if (relevant > 0 && 5 * title >= 3 * relevant) {
      if (!/[.!?]/.test(c)) {
        if (/(?:\.{2,}|…)\s*\d{1,4}$/.test(c)) return null;
        return "titlecase";
      }
    }
  }
  return null;
}

interface SegmentedHeading {
  heading: string;
  lineEnd: number;
  span: SectionSpan;
}

function segmentSections(region: string, ruleSet: RuleSet, cfg: SectionConfig): SegmentedHeading[] {
  const lines = splitLines(region);
  const collapsedLines = lines.map((l) => collapse(l.text));

  const tocReject = new Array<boolean>(lines.length).fill(false);
  for (let i = 0; i < lines.length; i++) {
    const c = collapsedLines[i];
    if (!/(?:\s)\d{1,4}\s*$/.test(c)) continue;
    if (/(?:\.{2,}|…)\s*\d{1,4}$/.test(c)) continue;
    const prefix = stripTrailingNumber(c);
    if (!prefix || prefix === c) continue;
    if (rawShape(prefix, ruleSet, cfg) === null) continue;
    if (!/\p{L}$/u.test(prefix)) continue;
    const prefixTokens = prefix.split(/\s+/).slice(0, 4).join(" ").toLowerCase();
    for (let j = i + 1; j < lines.length; j++) {
      const other = collapsedLines[j];
      const otherPrefix = stripTrailingNumber(other);
      if (otherPrefix === prefix && rawShape(otherPrefix, ruleSet, cfg) !== null) {
        tocReject[i] = true;
        break;
      }
      const otherIsHeading = rawShape(other, ruleSet, cfg) !== null || rawShape(otherPrefix, ruleSet, cfg) !== null;
      if (otherIsHeading) {
        const otherTokens = other.split(/\s+/).slice(0, 4).join(" ").toLowerCase();
        if (prefixTokens && otherTokens.startsWith(prefixTokens)) {
          tocReject[i] = true;
          break;
        }
      }
    }
  }

  const counts = new Map<string, number>();
  for (const c of collapsedLines) {
    if (c.length === 0) continue;
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }

  const accepted: { index: number; text: string }[] = [];
  const acceptedTexts = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const c = collapsedLines[i];
    if (c.length === 0) continue;
    if (c.length > cfg.max_heading_chars) continue;
    if (tocReject[i]) continue;
    if (/(?:\.{2,}|…)\s*\d{1,4}$/.test(c)) continue;

    const shape = rawShape(c, ruleSet, cfg);
    if (shape === null) continue;

    if (shape === "titlecase") {
      if (namedStagesOf(c, ruleSet).size < 1) continue;
      const repeated = (counts.get(c) ?? 0) >= 3;
      const prevBlank = i === 0 || collapsedLines[i - 1] === "";
      const nextBlank = i === lines.length - 1 || collapsedLines[i + 1] === "";
      const isolated = prevBlank || nextBlank;
      const headerWindow = lines[i].start < 600;
      if (!repeated && !isolated && !headerWindow) continue;
    }

    if (acceptedTexts.has(c)) continue;
    acceptedTexts.add(c);
    accepted.push({ index: i, text: c });
  }

  const headings: SegmentedHeading[] = [];
  for (let k = 0; k < accepted.length; k++) {
    const line = lines[accepted[k].index];
    const start = line.start;
    const end = k + 1 < accepted.length ? lines[accepted[k + 1].index].start : region.length;
    headings.push({ heading: accepted[k].text, lineEnd: line.end, span: { start, end } });
  }
  return headings;
}

function clearSections(region: string, ruleSet: RuleSet, cfg: SectionConfig): SectionDecision[] {
  const nt1 = namedTier1Map(ruleSet);
  const headings = segmentSections(region, ruleSet, cfg);
  const out: SectionDecision[] = [];
  for (const h of headings) {
    const span = h.span;
    if (span.start >= 600 && span.end - span.start < cfg.min_section_chars) continue;
    const headStages = namedStagesOf(region.slice(span.start, h.lineEnd), ruleSet);
    if (headStages.size !== 1) continue;
    const stage = [...headStages][0];
    const headingText = region.slice(span.start, h.lineEnd);
    const hd = classify(headingText, { title: "", hint: "UNSTAGED" }, ruleSet);
    const c = hd.candidates.find(
      (cand) => cand.stage === stage && cand.rule_ids.some((id) => nt1.get(id) === stage),
    );
    if (!c) continue;
    const absolute = span.start + c.offset;
    if (!(span.start <= absolute && absolute < span.end)) continue;
    out.push({
      heading: collapse(h.heading),
      span: { start: span.start, end: span.end },
      candidate: { ...c, offset: absolute },
      evidence_region: "heading",
    });
  }
  return out;
}

export function classifyDocument(
  text: string,
  ctx: { title: string; hint: string },
  ruleSet: RuleSet,
): DocumentDecision {
  const base = classify(text, ctx, ruleSet);
  const cfg = ruleSet.sections;
  if (!cfg?.enabled) return { decision: base, sections: [] };

  const normalize = typeof ruleSet.scan.normalize === "string" ? ruleSet.scan.normalize : null;
  const region = (normalize ? text.normalize(normalize) : text).slice(0, ruleSet.scan.chars);
  const sections = clearSections(region, ruleSet, cfg);
  if (sections.length === 0) return { decision: base, sections: [] };

  const byStage = new Map<CanonicalStage, SectionDecision[]>();
  for (const s of sections) {
    const stage = s.candidate.stage as CanonicalStage;
    const bucket = byStage.get(stage);
    if (bucket) bucket.push(s);
    else byStage.set(stage, [s]);
  }

  const candidates: StageCandidate[] = [];
  for (const [stage, list] of byStage) {
    const best = list.reduce((a, b) =>
      CONFIDENCE_RANK[b.candidate.confidence] > CONFIDENCE_RANK[a.candidate.confidence] ||
      (CONFIDENCE_RANK[b.candidate.confidence] === CONFIDENCE_RANK[a.candidate.confidence] &&
        b.span.start < a.span.start)
        ? b
        : a,
    );
    candidates.push({
      stage,
      cell_key: cellOf(ruleSet.cells, stage),
      confidence: list.reduce<Confidence>((w, s) =>
        CONFIDENCE_RANK[s.candidate.confidence] < CONFIDENCE_RANK[w]
          ? s.candidate.confidence
          : w,
        list[0].candidate.confidence,
      ),
      rule_ids: [...new Set(list.flatMap((s) => s.candidate.rule_ids))],
      evidence_scope: "body",
      matched_phrase: best.candidate.matched_phrase,
      offset: best.candidate.offset,
    });
  }
  if (candidates.length === 0) return { decision: base, sections: [] };

  const ambiguous = candidates.length >= 2;
  const decision: StageDecision = {
    ...base,
    stage: ambiguous ? "MULTI_STAGE" : (candidates[0].stage as StageOrUnstaged),
    cell_key: ambiguous ? "" : candidates[0].cell_key,
    confidence: ambiguous ? "inferred" : candidates[0].confidence,
    ambiguous,
    candidates,
    source: "text",
    scope_basis: "own_scope",
  };
  return { decision, sections };
}
