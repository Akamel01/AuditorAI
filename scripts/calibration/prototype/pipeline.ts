/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { loadDocument, windowFor } from "./document";
import { checkVerbatim } from "./verbatim";
import { MODEL_TABLE, assertFamilyDisjoint, chatCompletion, type ModelSpec, type ModelCallOutcome } from "./model";
import { readFileSync } from "node:fs";

export class ConfigError extends Error { exitCode = 1; }
export class LoadError extends Error { exitCode = 2; }
export class TransportAbortError extends Error { exitCode = 3; }
export class ExtractionInvalidError extends Error { exitCode = 4; }
export class RecordValidationError extends Error { exitCode = 5; }

export function classifyExit(err: unknown): number {
  if (err && typeof err === "object" && "exitCode" in err) return (err as any).exitCode ?? 1;
  return 1;
}

export interface RunOptions {
  docIds: string[];
  extractor: string;
  verifier: string;
  out: string;
  date?: string;
  dryRun?: boolean;
  seed?: number;
  temperature?: number;
  timeout_ms?: number;
  keys: { openrouter?: string; go?: string };
  baseUrls?: { openrouter?: string; go?: string };
  runId?: string;
}

export interface RunDeps {
  loadDocument?: (path: string) => Promise<any>;
  transport?: (opts: any) => Promise<ModelCallOutcome>;
  now?: () => string;
  writeJson?: (path: string, obj: any) => Promise<void>;
  mkdirp?: (path: string) => Promise<void>;
}

export interface DocReg {
  doc_id: string;
  cell_key: string;
  path: string;
  sha256: string;
  source_url: string;
  source_note: string | null;
  licence: string;
  scope_pages: [number, number];
  scope_note: string | null;
}

export const DOC_REGISTRY: DocReg[] = [
  { doc_id: "CA-001", cell_key: "canada:FEASIBILITY_CONCEPT", path: "tests/fixtures/samples/CA/ab-neahd-planning-stage-rsa-2009.pdf", sha256: "0af7ea584ae04908b0f650f4d12ed9cc766c748ab56ef86faa417158e0bdcb95", source_url: "https://open.alberta.ca/dataset/4f6fb605-f342-46ea-b531-d018fd81d70f/resource/2f0b905f-2c5c-4257-a91b-8272cb605242/download/neahdappendixc.pdf", source_note: null, licence: "CLEAR", scope_pages: [1, 10], scope_note: null },
  { doc_id: "CA-002", cell_key: "canada:PRELIMINARY_DESIGN", path: "tests/fixtures/samples/CA/ab-calgary-glenmore-functional-plan-rsa-2017.pdf", sha256: "bb9850fe4780789ffe20b17c0a3d3182906b3e4010942d768abab4e920af343d", source_url: "https://www.calgary.ca/content/dam/www/transportation/tp/documents/projects/current-planning-projects/glenmore-trail-100st/glenmore-tr-e-functional-study-appendix-h-1-road-safety-audit-report.pdf", source_note: null, licence: "not recorded", scope_pages: [1, 33], scope_note: null },
  { doc_id: "CA-007", cell_key: "canada:DETAILED_DESIGN", path: "tests/fixtures/samples/CA/nb-unb-exemplary-audits-appendix-c-1999.pdf", sha256: "6c38a1a99caaa666611eb6397d1672926b2b270cf793fc9fff9f448caeba5a9d", source_url: "https://www.unb.ca/research/transportation-group/_assets/documents/rsa-guidelines.pdf", source_note: "fixture = original pp. 102-162 of the 168-page UNB guidelines; scoped pages 40-51 = printed 141-152", licence: "not recorded", scope_pages: [40, 51], scope_note: "Detailed Design example (75% design stage audit, pages 40-51); the fixture also contains existing-road, municipal and pre-opening audits" },
];

function loadPack(): { issue: string[]; road: string[] } {
  try {
    const raw = readFileSync("policies/canada/pack.json", "utf8");
    const j = JSON.parse(raw);
    return { issue: j.issue_categories ?? [], road: j.road_user_categories ?? [] };
  } catch {
    return { issue: ["alignment_visibility","cross_sections_roadside","junctions_interchanges","vulnerable_users","signage_markings_lighting","access_management","human_factors_expectancy","network_continuity","drainage_structures","public_transport"], road: ["drivers","passengers","motorcyclists","cyclists","pedestrians","horse_riders"] };
  }
}

const PACK = loadPack();
const ISSUE_CATS = PACK.issue.length ? PACK.issue : ["alignment_visibility","cross_sections_roadside","junctions_interchanges","vulnerable_users","signage_markings_lighting","access_management","human_factors_expectancy","network_continuity","drainage_structures","public_transport"];
const ROAD_USERS = PACK.road.length ? PACK.road : ["drivers","passengers","motorcyclists","cyclists","pedestrians","horse_riders"];

const EXTRACTION_PROMPT = `You extract road-safety findings from a Road Safety Audit report. Return ONLY JSON. Never invent; quote exactly; no ellipsis.

Issue categories: ${ISSUE_CATS.join(", ")}.
Road users: ${ROAD_USERS.join(", ")}.

Schema: {"scheme_description":{"text":string,"span":{"quote":string,"page":number}}|null,"findings":[{"category":string|null,"location":string|null,"road_users":string[],"description":string,"span":{"quote":string,"page":number},"taxonomy_gap":boolean}]}

Rules:
- one item per discrete safety issue; do not merge or split
- quote 3-14 words copied exactly, no ellipsis, no paraphrase
- page is 1-based [PAGE n] marker
- category one of the list or null iff taxonomy_gap true
- road_users unique subset of the 6 (empty allowed)
- location null if not stated
- scheme_description one concise summary with one supporting quote; the quote must identify the scheme (road, stage, limits or design concept), not merely the audit scope
- do not output a bare location label, table header, or table row as a finding; the quote must state the safety issue or its evidence
- if several rows repeat one issue, return one finding with one representative quote
- return only one JSON object, no markdown fences`;

const VERIFIER_PROMPT = `You verify an extracted item against a window of the report. Return ONLY JSON {"verified":boolean,"reason":string}.
The quote must be an exact substring of the window after the documented normalization, and the quote plus the window must support the description and safety concern. The quote need not contain every field; null location or an empty road_users list means "not stated" and is not a rejection reason. Do not judge the page number; the deterministic check already verified it. Reject only if the quote contradicts the description, is a bare location label or table header without a safety claim, or the window shows the concern is not supported. If the item has kind "scheme_description", a project/stage/location label is acceptable as the quote; verify only that the text is a faithful summary of the quote/window. Do not repair, rewrite, or add quotes.`;

export function promptHash(p: string): string {
  return createHash("sha256").update(p).digest("hex");
}

export const EXTRACT_HASH = promptHash(EXTRACTION_PROMPT);
export const VERIFY_HASH = promptHash(VERIFIER_PROMPT);

function sha256(s: string): string { return createHash("sha256").update(s).digest("hex"); }

function verdictText(v: { content?: string; reasoning_content?: string | null }): string {
  return v.content && v.content.trim() ? v.content : (v.reasoning_content ?? "");
}

export interface RunOutcome {
  exitCode: number;
  runId: string;
  summary: any;
  summaryPath: string;
  records: { doc_id: string; path: string | null }[];
}

export async function runPrototype(opts: RunOptions, deps: RunDeps = {}): Promise<RunOutcome> {
  const now = deps.now ?? (() => new Date().toISOString());
  const loadDoc = deps.loadDocument ?? loadDocument;
  const transport = deps.transport ?? (async (o: any) => chatCompletion(o));
  const writeJson = deps.writeJson ?? (async (p: string, obj: any) => {
    const { writeFile, mkdir } = await import("node:fs/promises");
    const { dirname } = await import("node:path");
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, JSON.stringify(obj, null, 2));
  });
  const mkdirp = deps.mkdirp ?? (async (p: string) => { await mkdir(p, { recursive: true }); });

  try { assertFamilyDisjoint(opts.extractor, opts.verifier); } catch (e) { throw new ConfigError(String(e)); }
  const eSpec = MODEL_TABLE[opts.extractor];
  const vSpec = MODEL_TABLE[opts.verifier];
  if (!eSpec || !vSpec) throw new ConfigError("unknown model");

  const startedAt = now();
  const startMs = Date.now();
  const runId = opts.runId ?? now().replace(/[:.]/g, "-");
  const date = opts.date ?? now().slice(0, 10);
  const stamp = (s: any) => {
    s.run.started_at = startedAt;
    s.run.finished_at = now();
    s.run.duration_ms = Math.max(0, Date.now() - startMs);
    return s;
  };

  let ids = opts.docIds && opts.docIds.length ? opts.docIds : ["all"];
  if (ids.includes("all")) ids = DOC_REGISTRY.map((d) => d.doc_id);
  const unique: string[] = [];
  for (const id of ids) if (!unique.includes(id)) unique.push(id);
  const docs = unique.map((id) => DOC_REGISTRY.find((d) => d.doc_id === id)).filter(Boolean) as DocReg[];
  if (docs.length !== unique.length) throw new ConfigError("unknown doc id");

  await mkdirp(opts.out);

  const eBase = opts.baseUrls?.openrouter && eSpec.provider === "openrouter" ? opts.baseUrls.openrouter : (opts.baseUrls?.go && eSpec.provider === "opencode-go" ? opts.baseUrls.go : eSpec.base_url);
  const vBase = opts.baseUrls?.go && vSpec.provider === "opencode-go" ? opts.baseUrls.go : (opts.baseUrls?.openrouter && vSpec.provider === "openrouter" ? opts.baseUrls.openrouter : vSpec.base_url);

  const eKey = eSpec.provider === "openrouter" ? opts.keys.openrouter : opts.keys.go;
  const vKey = vSpec.provider === "openrouter" ? opts.keys.openrouter : opts.keys.go;

  const loaded: { reg: DocReg; doc: any }[] = [];
  for (const reg of docs) {
    try {
      const doc = await loadDoc(reg.path);
      if (doc.doc_sha256 !== reg.sha256) throw new LoadError("sha_mismatch");
      loaded.push({ reg, doc });
    } catch (e) {
      if (e instanceof LoadError) throw e;
      throw new LoadError(String(e));
    }
  }

  // dry run
  if (opts.dryRun) {
    const summary = {
      summary_version: "1.0.0", schema_version: "extraction-record-v1", run_id: runId, generated_at: now(),
      check_version: "verbatim-v1", prompt_version: "extraction-v1", verifier_prompt_version: "verifier-v1",
      prompt_hash: EXTRACT_HASH, verifier_prompt_hash: VERIFY_HASH,
      models: { extractor: { id: eSpec.id, family: eSpec.family, provider: eSpec.provider, base_url: eBase }, verifier: { id: vSpec.id, family: vSpec.family, provider: vSpec.provider, base_url: vBase }, family_disjoint: true },
      run: { status: "dry_run", started_at: now(), finished_at: now(), duration_ms: 0, aborted_at: null },
      docs: docs.map((r) => ({ doc_id: r.doc_id, cell_key: r.cell_key, status: "skipped", counts: null, rates: null, record_path: null, reason: "dry_run" })),
      cells: [], totals: { docs_requested: docs.length, docs_complete: 0, raw: 0, deterministic_passed: 0, verified: 0, established: 0, discarded: 0, rates: null, gate: { min_established: 20, min_docs: 3, met: false } },
      excluded_docs: ["CA-010"], unavailable: [], fallback_hint: null, preflight: [],
    };
    stamp(summary);
    const summaryPath = join(opts.out, `extraction-summary-${date}-dryrun.json`);
    await writeJson(summaryPath, summary);
    return { exitCode: 0, runId, summary, summaryPath, records: docs.map((d) => ({ doc_id: d.doc_id, path: null })) };
  }

  // preflight
  const preflight: any[] = [];
  const calls: any[] = [];
  for (const spec of [eSpec, vSpec]) {
    const key = spec.provider === "openrouter" ? opts.keys.openrouter : opts.keys.go;
    const base = spec === eSpec ? eBase : vBase;
    const r = await transport({ spec, base_url: base, apiKey: key ?? "", messages: [{ role: "user", content: "Reply with the single word OK." }], max_tokens: 8, runId, timeout_ms: opts.timeout_ms ?? 120000 });
    const at = now();
    if (r.ok) {
      preflight.push({ model: spec.id, http_status: r.value.http_status, request_id: r.value.request_id, at });
      calls.push({ stage: "preflight", model: spec.id, http_status: r.value.http_status, request_id: r.value.request_id, usage: r.value.usage, finish_reason: r.value.finish_reason, duration_ms: r.value.duration_ms, at });
    } else {
      preflight.push({ model: spec.id, http_status: r.failure.http_status ?? null, request_id: null, at });
      calls.push({ stage: "preflight", model: spec.id, http_status: r.failure.http_status ?? null, request_id: null, usage: null, finish_reason: null, duration_ms: 0, at });
      const skipped = docs.map((r) => ({ doc_id: r.doc_id, cell_key: r.cell_key, status: "skipped", counts: null, rates: null, record_path: null, reason: `preflight_failed_${spec.id}` }));
      const summary = stamp(buildSummary(runId, now, date, docs, skipped, [], eSpec, vSpec, eBase, vBase, "aborted", preflight, calls, []));
      const summaryPath = join(opts.out, `extraction-summary-${date}.json`);
      await writeJson(summaryPath, summary);
      throw new TransportAbortError("preflight failed");
    }
  }

  const records: { doc_id: string; path: string | null }[] = [];
  const docSummaries: any[] = [];
  const unavailable: string[] = [];
  let aborted = false;
  let hasExtractionInvalid = false;
  let failureCounter = 0;

  for (const { reg, doc } of loaded) {
    const docCalls: any[] = calls.filter((c) => c.stage === "preflight");
    let lastVerifierFailure: any = null;
    if (aborted) {
      // skipped
      records.push({ doc_id: reg.doc_id, path: null });
      docSummaries.push({ doc_id: reg.doc_id, cell_key: reg.cell_key, status: "skipped", counts: null, rates: null, record_path: null, reason: `aborted_after_${loaded[loaded.findIndex((l) => l.reg.doc_id === reg.doc_id) - 1]?.reg?.doc_id ?? ""}` });
      continue;
    }

    // no text layer
    if (!doc.normalized_text || doc.normalized_text.trim() === "" || doc.page_count === 0) {
      const rpath = recordPath(opts.out, reg);
      const rec = baseRecord(reg, runId, now, eSpec, vSpec, eBase, vBase, doc, "no_text_layer", null, [], [], docCalls, preflight);
      await writeJson(rpath, rec);
      records.push({ doc_id: reg.doc_id, path: rpath });
      docSummaries.push({ doc_id: reg.doc_id, cell_key: reg.cell_key, status: "no_text_layer", counts: null, rates: null, record_path: rpath });
      continue;
    }
    if (doc.normalized_text.length > 300000) {
      const rpath = recordPath(opts.out, reg);
      const rec = baseRecord(reg, runId, now, eSpec, vSpec, eBase, vBase, doc, "doc_too_large", null, [], [], docCalls, preflight);
      await writeJson(rpath, rec);
      records.push({ doc_id: reg.doc_id, path: rpath });
      docSummaries.push({ doc_id: reg.doc_id, cell_key: reg.cell_key, status: "doc_too_large", counts: null, rates: null, record_path: rpath });
      continue;
    }

    // extraction call
    const scopeFrom = reg.scope_pages[0];
    const scopeTo = reg.scope_pages[1];
    const pageMarked = doc.pages
      .filter((p: any) => p.page >= scopeFrom && p.page <= scopeTo)
      .map((p: any) => `[PAGE ${p.page}]\n${doc.normalized_text.slice(p.norm_start, p.norm_end).trim()}`)
      .join("\n\n");
    const userMsg = `Metadata: ${reg.doc_id}; scope pages ${scopeFrom}-${scopeTo} of ${doc.page_count}${reg.scope_note ? `; ${reg.scope_note}` : ""}.\n\n${pageMarked}`;
    const extRes = await transport({ spec: eSpec, base_url: eBase, apiKey: eKey ?? "", messages: [{ role: "system", content: EXTRACTION_PROMPT }, { role: "user", content: userMsg }], max_tokens: 32768, runId, timeout_ms: opts.timeout_ms ?? 600000 });
    const atExt = now();
    if (!extRes.ok) {
      unavailable.push(reg.doc_id);
      docCalls.push({ stage: "extractor", model: eSpec.id, http_status: extRes.failure.http_status ?? null, request_id: null, usage: null, finish_reason: null, duration_ms: 0, at: atExt });
      const rpath = recordPath(opts.out, reg);
      const rec = baseRecord(reg, runId, now, eSpec, vSpec, eBase, vBase, doc, "model_unavailable", { stage: "extractor", kind: extRes.failure.reason, http_status: extRes.failure.http_status ?? null, detail: extRes.failure.detail, at: atExt }, [], [], docCalls, preflight);
      await writeJson(rpath, rec);
      records.push({ doc_id: reg.doc_id, path: rpath });
      docSummaries.push({ doc_id: reg.doc_id, cell_key: reg.cell_key, status: "model_unavailable", counts: null, rates: null, record_path: rpath });
      aborted = true;
      continue;
    }
    docCalls.push({ stage: "extractor", model: eSpec.id, http_status: extRes.value.http_status, request_id: extRes.value.request_id, usage: extRes.value.usage, finish_reason: extRes.value.finish_reason, duration_ms: extRes.value.duration_ms, at: atExt });

    if (extRes.value.finish_reason === "length") {
      hasExtractionInvalid = true;
      const rpath = recordPath(opts.out, reg);
      const rec = baseRecord(reg, runId, now, eSpec, vSpec, eBase, vBase, doc, "extraction_invalid", { stage: "extractor", kind: "truncated", http_status: extRes.value.http_status, detail: "truncated", at: atExt }, [], [], docCalls, preflight);
      await writeJson(rpath, rec);
      records.push({ doc_id: reg.doc_id, path: rpath });
      docSummaries.push({ doc_id: reg.doc_id, cell_key: reg.cell_key, status: "extraction_invalid", counts: null, rates: null, record_path: rpath });
      continue;
    }

    // parse JSON
    const content = extRes.value.content;
    const first = content.indexOf("{");
    const last = content.lastIndexOf("}");
    let parsed: any = null;
    let invalidJson = false;
    try {
      if (first === -1 || last === -1) throw new Error("no braces");
      parsed = JSON.parse(content.slice(first, last + 1));
    } catch {
      invalidJson = true;
    }

    const failures: any[] = [];
    const envelopeExtraKeys: string[] = [];
    let schemeEstablished: any = null;
    const establishedFindings: any[] = [];

    // envelope validation
    let schemeRaw: any = null;
    let findingsRaw: any[] = [];
    let envelopeInvalid = false;
    if (invalidJson || !parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      envelopeInvalid = true;
    } else {
      const allowedTop = new Set(["scheme_description", "findings"]);
      for (const k of Object.keys(parsed)) if (!allowedTop.has(k)) envelopeExtraKeys.push(k);
      if (!("findings" in parsed) || !Array.isArray(parsed.findings)) envelopeInvalid = true;
      if (parsed.findings && parsed.findings.length > 100) envelopeInvalid = true;
      if ("scheme_description" in parsed) schemeRaw = parsed.scheme_description;
      findingsRaw = Array.isArray(parsed.findings) ? parsed.findings : [];
    }

    if (invalidJson) {
      // doc-level invalid_json failure
      const fid = `${reg.doc_id}-X${++failureCounter}`;
      failures.push(makeFailure(fid, "document", null, "invalid_json", "parse", "invalid json", content.slice(0, 500), content, null, null, null, null, now));
      // write record with status? spec: invalid_json doc-level; treat as extraction_invalid? Use extraction_invalid
      hasExtractionInvalid = true;
      const rpath = recordPath(opts.out, reg);
      const rec = baseRecord(reg, runId, now, eSpec, vSpec, eBase, vBase, doc, "extraction_invalid", null, [], failures, docCalls, preflight, envelopeExtraKeys);
      await writeJson(rpath, rec);
      records.push({ doc_id: reg.doc_id, path: rpath });
      docSummaries.push({ doc_id: reg.doc_id, cell_key: reg.cell_key, status: "extraction_invalid", counts: null, rates: null, record_path: rpath });
      continue;
    }

    if (envelopeInvalid) {
      const fid = `${reg.doc_id}-X${++failureCounter}`;
      failures.push(makeFailure(fid, "document", null, "envelope_invalid", "parse", "envelope invalid", content.slice(0, 500), content, null, null, null, null, now));
      hasExtractionInvalid = true;
      const rpath = recordPath(opts.out, reg);
      const rec = baseRecord(reg, runId, now, eSpec, vSpec, eBase, vBase, doc, "extraction_invalid", null, [], failures, docCalls, preflight, envelopeExtraKeys);
      await writeJson(rpath, rec);
      records.push({ doc_id: reg.doc_id, path: rpath });
      docSummaries.push({ doc_id: reg.doc_id, cell_key: reg.cell_key, status: "extraction_invalid", counts: null, rates: null, record_path: rpath });
      continue;
    }

    // process scheme description first
    let schemeDetPassed = 0;
    let schemeVerified = 0;
    let schemeEstablishedCount = 0;
    let schemeDiscarded = 0;
    if (schemeRaw === null) {
      const fid = `${reg.doc_id}-X${++failureCounter}`;
      failures.push(makeFailure(fid, "scheme", null, "scheme_description_missing", "parse", "scheme missing", JSON.stringify(schemeRaw).slice(0,500), JSON.stringify(schemeRaw), null, null, null, null, now));
    } else {
      // validate scheme
      const valid = validateScheme(schemeRaw, doc.page_count);
      if (!valid.ok) {
        const fid = `${reg.doc_id}-X${++failureCounter}`;
        failures.push(makeFailure(fid, "scheme", null, "scheme_description_invalid", "parse", valid.detail, JSON.stringify(schemeRaw).slice(0,500), JSON.stringify(schemeRaw), null, null, null, null, now));
        schemeDiscarded++;
      } else {
        // deterministic
        const vres = checkVerbatim(doc, { quote: schemeRaw.span.quote, page: schemeRaw.span.page });
        if (!vres.ok) {
          const fid = `${reg.doc_id}-X${++failureCounter}`;
          failures.push(makeFailure(fid, "scheme", null, vres.reason, "deterministic", vres.detail, JSON.stringify(schemeRaw).slice(0,500), JSON.stringify(schemeRaw), vres.quote_normalized, schemeRaw.span.page, vres.found_page, null, now));
          schemeDiscarded++;
        } else {
          schemeDetPassed++;
          // verifier
          const window = windowFor(doc, { start_offset: vres.start_offset, end_offset: vres.end_offset, page: vres.page, end_page: vres.end_page }, 1, 20000);
          const windowText = doc.normalized_text.slice(window.start_offset, window.end_offset);
          const verdictRes = await transport({ spec: vSpec, base_url: vBase, apiKey: vKey ?? "", messages: [{ role: "system", content: VERIFIER_PROMPT }, { role: "user", content: JSON.stringify({ item: { ...schemeRaw, kind: "scheme_description" }, window: windowText }) }], max_tokens: 4096, runId, timeout_ms: opts.timeout_ms ?? 120000 });
          const atV = now();
          if (!verdictRes.ok) {
            unavailable.push(reg.doc_id);
            lastVerifierFailure = verdictRes.failure;
            aborted = true;
            // handle abort after
          }
          docCalls.push({ stage: "verifier", model: vSpec.id, http_status: verdictRes.ok ? (verdictRes as any).value.http_status : (verdictRes as any).failure.http_status ?? null, request_id: verdictRes.ok ? (verdictRes as any).value.request_id : null, usage: verdictRes.ok ? (verdictRes as any).value.usage : null, finish_reason: verdictRes.ok ? (verdictRes as any).value.finish_reason : null, duration_ms: verdictRes.ok ? (verdictRes as any).value.duration_ms : 0, at: atV });
          if (aborted) {
            // break out via flag; handle below
          } else {
            let verdict: any = null;
            let unparseable = false;
            try {
              const c = verdictText((verdictRes as any).value);
              const f = c.indexOf("{"); const l = c.lastIndexOf("}");
              verdict = JSON.parse(c.slice(f, l + 1));
              if (typeof verdict?.verified !== "boolean") unparseable = true;
            } catch { unparseable = true; }
            if (unparseable) {
              const fid = `${reg.doc_id}-X${++failureCounter}`;
              failures.push(makeFailure(fid, "scheme", null, "verifier_unparseable", "verifier", "unparseable", JSON.stringify(schemeRaw).slice(0,500), JSON.stringify(schemeRaw), vres.quote_normalized, schemeRaw.span.page, null, null, now, verdictRes.ok ? verdictText((verdictRes as any).value) : null));
              schemeDiscarded++;
            } else if (verdict.verified !== true) {
              const fid = `${reg.doc_id}-X${++failureCounter}`;
              failures.push(makeFailure(fid, "scheme", null, "verifier_rejected", "verifier", verdict.reason ?? "rejected", JSON.stringify(schemeRaw).slice(0,500), JSON.stringify(schemeRaw), vres.quote_normalized, schemeRaw.span.page, null, null, now, verdictRes.ok ? verdictText((verdictRes as any).value) : null));
              schemeDiscarded++;
            } else {
              schemeVerified++;
              schemeEstablishedCount++;
              schemeEstablished = {
                kind: "scheme_description", item_id: null, text: schemeRaw.text,
                span: buildSpan(vres, schemeRaw.span.section ?? null),
                verification: { verified: true, reason: verdict.reason ?? "", model_id: vSpec.id, family: vSpec.family, prompt_hash: VERIFY_HASH, window },
              };
            }
          }
        }
      }
    }

    if (aborted) {
      // write record and break
      const rpath = recordPath(opts.out, reg);
      const vf = lastVerifierFailure ?? { reason: "transport", http_status: null, detail: "verifier transport" };
      const rec = baseRecord(reg, runId, now, eSpec, vSpec, eBase, vBase, doc, "model_unavailable", { stage: "verifier", kind: vf.reason, http_status: vf.http_status ?? null, detail: vf.detail, at: now() }, [], [], docCalls, preflight, failures, envelopeExtraKeys);
      await writeJson(rpath, rec);
      records.push({ doc_id: reg.doc_id, path: rpath });
      docSummaries.push({ doc_id: reg.doc_id, cell_key: reg.cell_key, status: "model_unavailable", counts: null, rates: null, record_path: rpath });
      unavailable.push(reg.doc_id);
      continue;
    }

    // process findings
    let rawCount = 0;
    let detPassed = 0;
    let verifiedCount = 0;
    let establishedCount = 0;
    let taxonomyGap = 0;
    let sectionUnknown = 0;
    let crossPage = 0;

    for (let i = 0; i < findingsRaw.length; i++) {
      const item = findingsRaw[i];
      rawCount++;
      // item validation
      const vItem = validateItem(item, doc.page_count);
      if (!vItem.ok) {
        const fid = `${reg.doc_id}-X${++failureCounter}`;
        failures.push(makeFailure(fid, "finding", i, vItem.reason, "parse", vItem.detail, JSON.stringify(item).slice(0,500), JSON.stringify(item), null, item?.span?.page ?? null, null, null, now));
        continue;
      }
      // taxonomy conflict
      if ((item.category === null) !== (item.taxonomy_gap === true)) {
        const fid = `${reg.doc_id}-X${++failureCounter}`;
        failures.push(makeFailure(fid, "finding", i, "taxonomy_gap_conflict", "parse", "contradiction", JSON.stringify(item).slice(0,500), JSON.stringify(item), null, item.span.page, null, null, now));
        continue;
      }

      const vres = checkVerbatim(doc, { quote: item.span.quote, page: item.span.page });
      if (!vres.ok) {
        const fid = `${reg.doc_id}-X${++failureCounter}`;
        failures.push(makeFailure(fid, "finding", i, vres.reason, "deterministic", vres.detail, JSON.stringify(item).slice(0,500), JSON.stringify(item), vres.quote_normalized, item.span.page, vres.found_page, vres.start_offset !== null ? doc.normalized_text.slice(Math.max(0, (vres.start_offset ?? 0) - 120), (vres.start_offset ?? 0) + 120) : null, now));
        if (vres.section === null) sectionUnknown++;
        continue;
      }
      detPassed++;
      if (vres.section === null) sectionUnknown++;
      // verifier
      const window = windowFor(doc, { start_offset: vres.start_offset, end_offset: vres.end_offset, page: vres.page, end_page: vres.end_page }, 1, 20000);
      const windowText = doc.normalized_text.slice(window.start_offset, window.end_offset);
      const verdictRes = await transport({ spec: vSpec, base_url: vBase, apiKey: vKey ?? "", messages: [{ role: "system", content: VERIFIER_PROMPT }, { role: "user", content: JSON.stringify({ item, window: windowText }) }], max_tokens: 4096, runId, timeout_ms: opts.timeout_ms ?? 120000 });
      const atV = now();
      docCalls.push({ stage: "verifier", model: vSpec.id, http_status: verdictRes.ok ? verdictRes.value.http_status : verdictRes.failure.http_status ?? null, request_id: verdictRes.ok ? verdictRes.value.request_id : null, usage: verdictRes.ok ? verdictRes.value.usage : null, finish_reason: verdictRes.ok ? verdictRes.value.finish_reason : null, duration_ms: verdictRes.ok ? verdictRes.value.duration_ms : 0, at: atV });

      let verdict: any = null;
      let unparseable = false;
      if (!verdictRes.ok) {
        unavailable.push(reg.doc_id);
        lastVerifierFailure = verdictRes.failure;
        aborted = true;
        // mark and break
        const fid = `${reg.doc_id}-X${++failureCounter}`;
        failures.push(makeFailure(fid, "finding", i, "verifier_unparseable", "verifier", "transport", JSON.stringify(item).slice(0,500), JSON.stringify(item), vres.quote_normalized, item.span.page, null, null, now, null));
        break;
      }
      try {
        const c = verdictText((verdictRes as any).value);
        const f = c.indexOf("{"); const l = c.lastIndexOf("}");
        verdict = JSON.parse(c.slice(f, l + 1));
        if (typeof verdict?.verified !== "boolean") unparseable = true;
      } catch { unparseable = true; }

      if (unparseable) {
        const fid = `${reg.doc_id}-X${++failureCounter}`;
        failures.push(makeFailure(fid, "finding", i, "verifier_unparseable", "verifier", "unparseable", JSON.stringify(item).slice(0,500), JSON.stringify(item), vres.quote_normalized, item.span.page, null, null, now, verdictText(verdictRes.value)));
        continue;
      }
      if (verdict.verified !== true) {
        const fid = `${reg.doc_id}-X${++failureCounter}`;
        failures.push(makeFailure(fid, "finding", i, "verifier_rejected", "verifier", verdict.reason ?? "rejected", JSON.stringify(item).slice(0,500), JSON.stringify(item), vres.quote_normalized, item.span.page, null, null, now, verdictText(verdictRes.value)));
        continue;
      }
      verifiedCount++;
      establishedCount++;
      if (item.taxonomy_gap === true) taxonomyGap++;
      if (vres.cross_page) crossPage++;
      if (vres.section === null) sectionUnknown++;
      establishedFindings.push({
        kind: "finding", item_id: `${reg.doc_id}-F${String(i + 1).padStart(2, "0")}`,
        category: item.category, location: item.location ?? null, road_users: item.road_users ?? [],
        description: item.description, taxonomy_gap: !!item.taxonomy_gap,
        span: buildSpan(vres, item.span.section ?? null, item.span.quote),
        verification: { verified: true, reason: verdict.reason ?? "", model_id: vSpec.id, family: vSpec.family, prompt_hash: VERIFY_HASH, window },
      });
    }

    if (aborted) {
      const rpath = recordPath(opts.out, reg);
      const vf = lastVerifierFailure ?? { reason: "transport", http_status: null, detail: "verifier transport" };
      const rec = baseRecord(reg, runId, now, eSpec, vSpec, eBase, vBase, doc, "model_unavailable", { stage: "verifier", kind: vf.reason, http_status: vf.http_status ?? null, detail: vf.detail, at: now() }, [], [], docCalls, preflight, failures, envelopeExtraKeys);
      await writeJson(rpath, rec);
      records.push({ doc_id: reg.doc_id, path: rpath });
      docSummaries.push({ doc_id: reg.doc_id, cell_key: reg.cell_key, status: "model_unavailable", counts: null, rates: null, record_path: rpath });
      unavailable.push(reg.doc_id);
      continue;
    }

    // counts
    const counts = {
      raw: rawCount,
      deterministic_passed: detPassed,
      verified: verifiedCount,
      established: establishedCount,
      discarded: rawCount - establishedCount,
      taxonomy_gap: taxonomyGap,
      section_unknown: sectionUnknown,
      cross_page: crossPage,
      scheme: { raw: schemeRaw !== null ? 1 : 0, deterministic_passed: schemeDetPassed, verified: schemeVerified, established: schemeEstablishedCount, discarded: schemeDiscarded },
    };
    const ratio = (n: number, d: number) => (d === 0 ? null : Number((n / d).toFixed(6)));
    const rates = {
      pass: ratio(verifiedCount, rawCount),
      discard: ratio(rawCount - establishedCount, rawCount),
      verify: ratio(verifiedCount, detPassed),
      established: ratio(establishedCount, rawCount),
    };

    const rpath = recordPath(opts.out, reg);
    const rec = {
      record_version: "1.0.0", schema_version: "extraction-record-v1", run_id: runId, doc_id: reg.doc_id,
      sha256: reg.sha256, source_url: reg.source_url, source_path: reg.path, source_note: reg.source_note,
      scope_pages: reg.scope_pages, scope_note: reg.scope_note,
      cell_key: reg.cell_key, stage: reg.cell_key.split(":")[1], licence: reg.licence,
      page_count: doc.page_count, document_chars: doc.normalized_text.length, section_count: doc.sections.length,
      heading_rule: "numbered-or-allcaps-v2", extracted_at: now(), status: "complete",
      models: { extractor: { id: eSpec.id, family: eSpec.family, provider: eSpec.provider, base_url: eBase }, verifier: { id: vSpec.id, family: vSpec.family, provider: vSpec.provider, base_url: vBase }, family_disjoint: true },
      prompt_version: "extraction-v1", verifier_prompt_version: "verifier-v1",
      prompt_hash: EXTRACT_HASH, verifier_prompt_hash: VERIFY_HASH, check_version: "verbatim-v1",
      config: { temperature: opts.temperature ?? 0, seed: opts.seed ?? 42, extractor_max_tokens: 32768, verifier_max_tokens: 4096, extractor_timeout_ms: 600000, verifier_timeout_ms: 120000, one_shot_char_cap: 300000, verifier_window_page_pad: 1, verifier_window_char_cap: 20000 },
      envelope_extra_keys: envelopeExtraKeys,
      scheme_description: schemeEstablished,
      findings: establishedFindings,
      counts, rates, failures, error: null,
      calls: docCalls, preflight,
    };
    await writeJson(rpath, rec);
    records.push({ doc_id: reg.doc_id, path: rpath });
    docSummaries.push({ doc_id: reg.doc_id, cell_key: reg.cell_key, status: "complete", counts, rates, record_path: rpath });
  }

  // skipped remaining handled above (aborted path sets skipped already? no—need convert null-path entries)
  // Ensure skipped docs with null path are in docSummaries
  for (const reg of docs) {
    if (!docSummaries.find((d) => d.doc_id === reg.doc_id)) {
      records.push({ doc_id: reg.doc_id, path: null });
      docSummaries.push({ doc_id: reg.doc_id, cell_key: reg.cell_key, status: "skipped", counts: null, rates: null, record_path: null, reason: "aborted" });
    }
  }

  if (aborted) {
    const anyComplete = docSummaries.some((d) => d.status === "complete");
    const summary = stamp(buildSummary(runId, now, date, docs, docSummaries, records, eSpec, vSpec, eBase, vBase, anyComplete ? "partial" : "aborted", preflight, calls, unavailable));
    const summaryPath = join(opts.out, `extraction-summary-${date}.json`);
    await writeJson(summaryPath, summary);
    throw new TransportAbortError("transport aborted");
  }
  const allComplete = docSummaries.length === docs.length && docSummaries.every((d) => d.status === "complete");
  const anyComplete = docSummaries.some((d) => d.status === "complete");
  const status = aborted ? (anyComplete ? "partial" : "aborted") : (hasExtractionInvalid ? "partial" : (allComplete ? "complete" : "partial"));

  const summary = stamp(buildSummary(runId, now, date, docs, docSummaries, records, eSpec, vSpec, eBase, vBase, status, preflight, calls, unavailable));
  const summaryPath = join(opts.out, `extraction-summary-${date}.json`);
  await writeJson(summaryPath, summary);

  let exitCode = 0;
  if (aborted) exitCode = 3;
  else if (hasExtractionInvalid) exitCode = 4;
  return { exitCode, runId, summary, summaryPath, records };
}

function recordPath(out: string, reg: DocReg): string {
  const stage = reg.cell_key.split(":")[1];
  return join(out, "extractions", "canada", stage, `${reg.doc_id}.json`);
}

function baseRecord(reg: DocReg, runId: string, now: () => string, eSpec: ModelSpec, vSpec: ModelSpec, eBase: string, vBase: string, doc: any, status: string, error: any, findings: any[], failures: any[], calls: any[], preflight: any[], envExtra: string[] = [], _allFailures?: any[]): any {
  return {
    record_version: "1.0.0", schema_version: "extraction-record-v1", run_id: runId, doc_id: reg.doc_id,
    sha256: reg.sha256, source_url: reg.source_url, source_path: reg.path, source_note: reg.source_note,
    scope_pages: reg.scope_pages, scope_note: reg.scope_note,
    cell_key: reg.cell_key, stage: reg.cell_key.split(":")[1], licence: reg.licence,
    page_count: doc.page_count ?? 0, document_chars: doc.normalized_text?.length ?? 0, section_count: doc.sections?.length ?? 0,
    heading_rule: "numbered-or-allcaps-v2", extracted_at: now(), status,
    models: { extractor: { id: eSpec.id, family: eSpec.family, provider: eSpec.provider, base_url: eBase }, verifier: { id: vSpec.id, family: vSpec.family, provider: vSpec.provider, base_url: vBase }, family_disjoint: true },
    prompt_version: "extraction-v1", verifier_prompt_version: "verifier-v1",
    prompt_hash: EXTRACT_HASH, verifier_prompt_hash: VERIFY_HASH, check_version: "verbatim-v1",
    config: { temperature: 0, seed: 42, extractor_max_tokens: 32768, verifier_max_tokens: 4096, extractor_timeout_ms: 600000, verifier_timeout_ms: 120000, one_shot_char_cap: 300000, verifier_window_page_pad: 1, verifier_window_char_cap: 20000 },
    envelope_extra_keys: envExtra,
    scheme_description: null, findings, counts: null, rates: null, failures: failures ?? [], error,
    calls, preflight,
  };
}

function makeFailure(failure_id: string, scope: string, item_index: number | null, kind: string, stage: string, detail: string, raw_excerpt: string, raw_full: string, normalized_quote: string | null, claimed_page: number | null, found_page: number | null, source_excerpt: string | null, now: () => string, raw_verdict_excerpt: string | null = null): any {
  return {
    failure_id, scope, item_index, kind, stage, detail,
    raw_item_excerpt: (raw_excerpt ?? "").slice(0, 500),
    raw_item_sha256: sha256(raw_full ?? ""),
    raw_verdict_excerpt: raw_verdict_excerpt === null ? null : raw_verdict_excerpt.slice(0, 500),
    raw_verdict_sha256: raw_verdict_excerpt === null ? null : sha256(raw_verdict_excerpt),
    normalized_quote, claimed_page, found_page,
    source_excerpt: source_excerpt ? source_excerpt.slice(0, 240) : null,
    at: now(),
  };
}

function validateItem(item: any, pageCount: number): { ok: boolean; reason: string; detail: string } {
  if (!item || typeof item !== "object" || Array.isArray(item)) return { ok: false, reason: "item_invalid", detail: "not object" };
  const allowed = new Set(["category", "location", "road_users", "description", "span", "taxonomy_gap"]);
  for (const k of Object.keys(item)) if (!allowed.has(k)) return { ok: false, reason: "item_invalid", detail: "unknown key " + k };
  if (!("category" in item) || !("location" in item) || !("road_users" in item) || !("description" in item) || !("span" in item) || !("taxonomy_gap" in item)) return { ok: false, reason: "item_invalid", detail: "missing field" };
  if (!(item.category === null || (typeof item.category === "string" && ISSUE_CATS.includes(item.category)))) return { ok: false, reason: "item_invalid", detail: "category" };
  if (!(item.location === null || typeof item.location === "string")) return { ok: false, reason: "item_invalid", detail: "location" };
  if (!Array.isArray(item.road_users) || !item.road_users.every((r: any) => typeof r === "string" && ROAD_USERS.includes(r))) return { ok: false, reason: "item_invalid", detail: "road_users" };
  // unique
  if (new Set(item.road_users).size !== item.road_users.length) return { ok: false, reason: "item_invalid", detail: "dup road_users" };
  if (typeof item.description !== "string" || item.description.length < 1 || item.description.length > 2000) return { ok: false, reason: "item_invalid", detail: "description" };
  if (typeof item.taxonomy_gap !== "boolean") return { ok: false, reason: "item_invalid", detail: "taxonomy_gap" };
  const span = item.span;
  if (!span || typeof span !== "object") return { ok: false, reason: "item_invalid", detail: "span" };
  if (typeof span.quote !== "string" || span.quote.length < 1) return { ok: false, reason: "item_invalid", detail: "quote" };
  if (!Number.isInteger(span.page) || span.page < 1 || span.page > pageCount) return { ok: false, reason: "item_invalid", detail: "page" };
  return { ok: true, reason: "", detail: "" };
}

function validateScheme(s: any, pageCount: number): { ok: boolean; detail: string } {
  if (!s || typeof s !== "object" || Array.isArray(s)) return { ok: false, detail: "not object" };
  if (typeof s.text !== "string" || s.text.length < 1 || s.text.length > 2000) return { ok: false, detail: "text" };
  const span = s.span;
  if (!span || typeof span !== "object") return { ok: false, detail: "span" };
  if (typeof span.quote !== "string" || span.quote.length < 1) return { ok: false, detail: "quote" };
  if (!Number.isInteger(span.page) || span.page < 1 || span.page > pageCount) return { ok: false, detail: "page" };
  return { ok: true, detail: "" };
}

function buildSpan(vres: any, modelSection: string | null, quote?: string): any {
  return {
    quote: quote ?? vres.quote,
    quote_normalized: vres.quote_normalized,
    word_count: vres.word_count,
    page: vres.page,
    end_page: vres.end_page,
    section: vres.section,
    section_start: vres.section_start,
    model_section: modelSection,
    start_offset: vres.start_offset,
    end_offset: vres.end_offset,
    raw_start: vres.raw_start,
    raw_end: vres.raw_end,
    cross_page: vres.cross_page,
    occurrence_count: vres.occurrence_count,
    occurrence_capped: vres.occurrence_capped,
  };
}

function buildSummary(runId: string, now: () => string, date: string, docs: DocReg[], docSummaries: any[], records: any[], eSpec: ModelSpec, vSpec: ModelSpec, eBase: string, vBase: string, status: string, preflight: any[], calls: any[], unavailable: string[]): any {
  const cellMap = new Map<string, any[]>();
  for (const d of docSummaries) {
    if (!cellMap.has(d.cell_key)) cellMap.set(d.cell_key, []);
    cellMap.get(d.cell_key)!.push(d);
  }
  const cells = [...cellMap.entries()].map(([cell, ds]) => {
    const requested = docs.filter((r) => r.cell_key === cell).length;
    const complete = ds.filter((d) => d.status === "complete");
    const anyIncomplete = requested !== complete.length || ds.length < requested;
    const totals = complete.reduce((acc: any, d: any) => {
      acc.raw += d.counts?.raw ?? 0;
      acc.det += d.counts?.deterministic_passed ?? 0;
      acc.ver += d.counts?.verified ?? 0;
      acc.est += d.counts?.established ?? 0;
      acc.disc += d.counts?.discarded ?? 0;
      return acc;
    }, { raw: 0, det: 0, ver: 0, est: 0, disc: 0 });
    const rates = anyIncomplete ? null : (totals.raw === 0 ? null : { pass: Number((totals.ver / totals.raw).toFixed(6)), discard: Number((totals.disc / totals.raw).toFixed(6)), verify: totals.det === 0 ? null : Number((totals.ver / totals.det).toFixed(6)), established: Number((totals.est / totals.raw).toFixed(6)) });
    const met = totals.est >= 20 && complete.length >= 3;
    return {
      cell_key: cell, docs_requested: requested, docs_complete: complete.length, docs_excluded: requested - complete.length,
      raw: totals.raw, deterministic_passed: totals.det, verified: totals.ver, established: totals.est,
      rates, gate: { min_established: 20, min_docs: 3, met },
    };
  });
  const completeDocs = docSummaries.filter((d) => d.status === "complete");
  const totalsAgg = completeDocs.reduce((acc: any, d: any) => {
    acc.raw += d.counts?.raw ?? 0;
    acc.det += d.counts?.deterministic_passed ?? 0;
    acc.ver += d.counts?.verified ?? 0;
    acc.est += d.counts?.established ?? 0;
    acc.disc += d.counts?.discarded ?? 0;
    return acc;
  }, { raw: 0, det: 0, ver: 0, est: 0, disc: 0 });
  const allComplete = docSummaries.length === docs.length && docSummaries.every((d) => d.status === "complete");
  const totalsRates = (!allComplete) ? null : (totalsAgg.raw === 0 ? null : { pass: Number((totalsAgg.ver / totalsAgg.raw).toFixed(6)), discard: Number((totalsAgg.disc / totalsAgg.raw).toFixed(6)), verify: totalsAgg.det === 0 ? null : Number((totalsAgg.ver / totalsAgg.det).toFixed(6)), established: Number((totalsAgg.est / totalsAgg.raw).toFixed(6)) });
  return {
    summary_version: "1.0.0", schema_version: "extraction-record-v1", run_id: runId, generated_at: now(),
    check_version: "verbatim-v1", prompt_version: "extraction-v1", verifier_prompt_version: "verifier-v1",
    prompt_hash: EXTRACT_HASH, verifier_prompt_hash: VERIFY_HASH,
    models: { extractor: { id: eSpec.id, family: eSpec.family, provider: eSpec.provider, base_url: eBase }, verifier: { id: vSpec.id, family: vSpec.family, provider: vSpec.provider, base_url: vBase }, family_disjoint: true },
    run: { status, started_at: now(), finished_at: now(), duration_ms: 0, aborted_at: null },
    docs: docSummaries.map((d) => ({ doc_id: d.doc_id, cell_key: d.cell_key, status: d.status, counts: d.counts, rates: d.rates, record_path: d.record_path, reason: d.reason })),
    cells, totals: { docs_requested: docs.length, docs_complete: completeDocs.length, raw: totalsAgg.raw, deterministic_passed: totalsAgg.det, verified: totalsAgg.ver, established: totalsAgg.est, discarded: totalsAgg.disc, rates: totalsRates, gate: { min_established: 20, min_docs: 3, met: totalsAgg.est >= 20 && completeDocs.length >= 3 } },
    excluded_docs: ["CA-010"], unavailable, fallback_hint: null, preflight,
  };
}
