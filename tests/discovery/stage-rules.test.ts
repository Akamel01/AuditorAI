import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { extractText, getDocumentProxy } from "unpdf";
import { classify, loadRuleSet, type RuleSet, type StageRule } from "../../scripts/stage-rules";
import { detectStage } from "../../scripts/harvest-track-a";
import { MANIFEST_STAGE_TO_CELL } from "../../scripts/harvest-track-a-report";

/**
 * Ticket #62, module M2 — the pure stage classifier and its rules.
 *
 * The per-rule tests are NOT tautologies: a rule's evidence phrase must be
 * found in a REAL document — the committed open-licence reference PDF under
 * `docs/references/CA/` (extracted here at test time with `unpdf`) or the
 * committed corpus manifest row. The three ticket-declared rules assert their
 * honesty flag (`kind:"ticket-declared"`, `attested:false`), never an
 * attestation. No test touches the network.
 */

const REPO = process.cwd();
const RULE_DIR = path.join(REPO, "docs/research/stage-rules");
const REFERENCES = path.join(REPO, "docs/references/CA");
const MANIFEST = path.join(REPO, "docs/RSA-Documents/canada-intake-manifest.jsonl");
const HARVESTER = path.join(REPO, "scripts/harvest-track-a.ts");

const v1 = loadRuleSet(JSON.parse(readFileSync(path.join(RULE_DIR, "stage-rules.v1.json"), "utf8")));
const v2 = loadRuleSet(JSON.parse(readFileSync(path.join(RULE_DIR, "stage-rules.v2.json"), "utf8")));

interface ManifestRow {
  sha256: string;
  stage: string;
  title: string;
  cell_key: string;
}

const manifestRows: ManifestRow[] = readFileSync(MANIFEST, "utf8")
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line) as ManifestRow);

function corpusRow(sha256: string): ManifestRow {
  const row = manifestRows.find((candidate) => candidate.sha256 === sha256);
  if (!row) throw new Error(`manifest row ${sha256} is not committed`);
  return row;
}

function ruleOf(set: RuleSet, id: string): StageRule {
  const rule = set.rules.find((candidate) => candidate.id === id);
  if (!rule) throw new Error(`rule ${id} is missing`);
  return rule;
}

/** The extracted text of a committed reference PDF, memoised per test file. */
const pdfCache = new Map<string, Promise<string>>();

function pdfText(file: string): Promise<string> {
  const cached = pdfCache.get(file);
  if (cached) return cached;
  const promise = (async () => {
    const bytes = readFileSync(path.join(REFERENCES, file));
    const u8 = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const pdf = await getDocumentProxy(new Uint8Array(u8));
    const out = await extractText(pdf, { mergePages: true });
    return out.text.normalize("NFC").replace(/\s+/g, " ");
  })();
  pdfCache.set(file, promise);
  return promise;
}

/** The evidence phrase must occur in the real document it cites. */
async function expectPhraseInPdf(file: string, phrase: string): Promise<void> {
  const text = await pdfText(file);
  expect(text.toLowerCase(), `"${phrase}" must occur in ${file}`).toContain(phrase.toLowerCase());
}

describe("stage rules — one test per v2 rule id (ticket #62 M2.3, group 1)", () => {
  it("CA-FEAS — the corpus title row 1 and the AB guidelines attest 'planning stage'", async () => {
    const row = corpusRow("0af7ea584ae04908b0f650f4d12ed9cc766c748ab56ef86faa417158e0bdcb95");
    expect(row.title.toLowerCase()).toContain("planning stage");
    await expectPhraseInPdf("alberta-transportation-rsa-guidelines-2004.pdf", "planning stage");

    const decision = classify("", { title: row.title, hint: "UNSTAGED" }, v2);
    expect(decision.stage).toBe("FEASIBILITY_CONCEPT");
    expect(decision.confidence).toBe("authoritative");
    expect(decision.cell_key).toBe("canada:FEASIBILITY_CONCEPT");
    expect(decision.candidates[0].rule_ids).toEqual(["CA-FEAS"]);
    expect(decision.candidates[0].evidence_scope).toBe("title");
    expect(decision.source).toBe("title");
    expect(decision.body_available).toBe(false);
  });

  it("CA-FEAS — the corpus title row 19 'Stage 1 Road Safety Audit' is an interpreted stage", () => {
    const row = corpusRow("ed2c0d69446169b221217c97861c335e7d675e1bb68dc9c8cbf4b201163030d2");
    expect(row.title).toContain("Stage 1 Road Safety Audit");
    const attested = ruleOf(v2, "CA-FEAS").evidence.find(
      (entry) => entry.corpus_sha256 === row.sha256,
    );
    expect(attested?.attested).toBe(true);

    const decision = classify("", { title: row.title, hint: "UNSTAGED" }, v2);
    expect(decision.stage).toBe("FEASIBILITY_CONCEPT");
    expect(decision.cell_key).toBe("canada:FEASIBILITY_CONCEPT");
    // A bare stage ordinal names a stage number, not a stage phrase: D1's own
    // interpreted example.
    expect(decision.confidence).toBe("interpreted");
    expect(decision.candidates[0].evidence_scope).toBe("title");
  });

  it("CA-PRELIM — 'preliminary design' occurs in the AB guidelines", async () => {
    await expectPhraseInPdf("alberta-transportation-rsa-guidelines-2004.pdf", "preliminary design");

    const decision = classify("preliminary design", { title: "", hint: "UNSTAGED" }, v2);
    expect(decision.stage).toBe("PRELIMINARY_DESIGN");
    expect(decision.cell_key).toBe("canada:PRELIMINARY_DESIGN");
    expect(decision.confidence).toBe("authoritative");
    expect(decision.candidates[0].rule_ids).toEqual(["CA-PRELIM"]);
    expect(decision.candidates[0].evidence_scope).toBe("body");
    expect(decision.source).toBe("text");
  });

  it("CA-DETAIL — 'detailed design' occurs in the AB guidelines", async () => {
    await expectPhraseInPdf("alberta-transportation-rsa-guidelines-2004.pdf", "detailed design");

    const decision = classify("detailed design", { title: "", hint: "UNSTAGED" }, v2);
    expect(decision.stage).toBe("DETAILED_DESIGN");
    expect(decision.cell_key).toBe("canada:DETAILED_DESIGN");
    expect(decision.confidence).toBe("authoritative");
    expect(decision.candidates[0].rule_ids).toEqual(["CA-DETAIL"]);
  });

  it("CA-DETAIL — the corpus title row 13 'Stage 3 Road Safety Audit' is an interpreted stage", () => {
    const row = corpusRow("2b3115c3438b11fe5a25f270d8f855e502d4969a71d76dc1a4ab6d23a9280860");
    expect(row.title).toContain("Stage 3 Road Safety Audit");

    const decision = classify("", { title: row.title, hint: "UNSTAGED" }, v2);
    expect(decision.stage).toBe("DETAILED_DESIGN");
    expect(decision.cell_key).toBe("canada:DETAILED_DESIGN");
    expect(decision.confidence).toBe("interpreted");
    expect(decision.candidates[0].rule_ids).toEqual(["CA-DETAIL"]);
  });

  it("CA-PREOPEN — the corpus title row 9 'WAITEMATA GREENWAYS PRE-OPENING' has no cell", async () => {
    const row = corpusRow("babe092a5473ed64e211f7a86dc76b700db5196cc4324ac613049b73f69894bc");
    expect(row.title.toLowerCase()).toContain("pre-opening");
    await expectPhraseInPdf("alberta-transportation-rsa-guidelines-2004.pdf", "pre-opening");

    const decision = classify("", { title: row.title, hint: "UNSTAGED" }, v2);
    expect(decision.stage).toBe("PRE_OPENING");
    expect(decision.cell_key).toBe("");
    expect(decision.confidence).toBe("inferred");
    expect(decision.candidates[0].rule_ids).toEqual(["CA-PREOPEN"]);
  });

  it("CA-EXISTING — 'existing road' occurs in the AB guidelines and has no cell", async () => {
    await expectPhraseInPdf("alberta-transportation-rsa-guidelines-2004.pdf", "existing road");

    const decision = classify("existing road", { title: "", hint: "UNSTAGED" }, v2);
    expect(decision.stage).toBe("EXISTING");
    expect(decision.cell_key).toBe("");
    expect(decision.confidence).toBe("inferred");
    expect(decision.candidates[0].rule_ids).toEqual(["CA-EXISTING"]);

    // The SPACED spelling is the attested one ("in service" in the AB
    // implementation plan, the ON guideline and the UNB guidelines). Both
    // separators are accepted; the audit noun is still required, which is
    // what keeps the negative trap ("... in-service") pinned below.
    const spaced = classify("in service road safety audit", { title: "", hint: "UNSTAGED" }, v2);
    expect(spaced.stage).toBe("EXISTING");
    expect(spaced.candidates[0].rule_ids).toEqual(["CA-EXISTING"]);
    const postOpening = classify("post opening", { title: "", hint: "UNSTAGED" }, v2);
    expect(postOpening.stage).toBe("EXISTING");
    expect(postOpening.candidates[0].rule_ids).toEqual(["CA-EXISTING"]);
  });

  it("CA-CONSTR — 'construction stage' (AB) and 'during construction' (BCT) have no cell", async () => {
    await expectPhraseInPdf("alberta-transportation-rsa-guidelines-2004.pdf", "construction stage");
    await expectPhraseInPdf("bct-moti-rsa-guidelines-tc-t02-04c-2004.pdf", "during construction");

    for (const text of ["construction stage", "during construction"]) {
      const decision = classify(text, { title: "", hint: "UNSTAGED" }, v2);
      expect(decision.stage).toBe("CONSTRUCTION");
      expect(decision.cell_key).toBe("");
      expect(decision.confidence).toBe("inferred");
      expect(decision.candidates[0].rule_ids).toEqual(["CA-CONSTR"]);
    }
  });

  it("CA-PCT-DETAIL — '90% to 95% stage of the design' wins over the tier-2 percentage rule", async () => {
    await expectPhraseInPdf("alberta-transportation-rsa-guidelines-2004.pdf", "90% to 95% stage of the design");

    const decision = classify("90% to 95% stage of the design", { title: "", hint: "UNSTAGED" }, v2);
    expect(decision.stage).toBe("DETAILED_DESIGN");
    expect(decision.cell_key).toBe("canada:DETAILED_DESIGN");
    expect(decision.confidence).toBe("interpreted");
    expect(decision.candidates).toHaveLength(1);
    expect(decision.candidates[0].rule_ids).toEqual(["CA-PCT-DETAIL"]);
  });

  it("CA-AMBIG-FUNCPLAN — 'functional plan' yields the contested pair, tier 1 wins over it", async () => {
    await expectPhraseInPdf("alberta-transportation-rsa-guidelines-2004.pdf", "functional plan");

    const decision = classify("functional plan", { title: "", hint: "UNSTAGED" }, v2);
    expect(decision.ambiguous).toBe(true);
    expect(decision.candidates.map((candidate) => candidate.stage).sort()).toEqual([
      "FEASIBILITY_CONCEPT",
      "PRELIMINARY_DESIGN",
    ]);
    expect(decision.candidates[0].rule_ids).toEqual(["CA-AMBIG-FUNCPLAN"]);
    expect(decision.confidence).toBe("inferred");
    expect(decision.cell_key).toBe("");

    const tier1 = classify("functional plan and detailed design", { title: "", hint: "UNSTAGED" }, v2);
    expect(tier1.stage).toBe("DETAILED_DESIGN");
    expect(tier1.candidates).toHaveLength(1);
    expect(tier1.candidates[0].rule_ids).toEqual(["CA-DETAIL"]);
  });

  it("CA-PRELIM-TICKET — the ticket's own term is declared and unattested", () => {
    const rule = ruleOf(v2, "CA-PRELIM-TICKET");
    const declared = rule.evidence.find((entry) => entry.kind === "ticket-declared");
    expect(declared?.phrase).toBe("conception préliminaire");
    expect(declared?.attested).toBe(false);

    const decision = classify("conception préliminaire", { title: "", hint: "UNSTAGED" }, v2);
    expect(decision.stage).toBe("PRELIMINARY_DESIGN");
    expect(decision.cell_key).toBe("canada:PRELIMINARY_DESIGN");
    expect(decision.candidates[0].rule_ids).toContain("CA-PRELIM-TICKET");
  });

  it("CA-DETAIL-TICKET, CA-EXISTING-TICKET and CA-ASSET — unattested declarations and an asset-only rule", () => {
    const detail = ruleOf(v2, "CA-DETAIL-TICKET");
    expect(detail.evidence.find((entry) => entry.kind === "ticket-declared")?.attested).toBe(false);
    const detailDecision = classify("conception détaillée", { title: "", hint: "UNSTAGED" }, v2);
    expect(detailDecision.stage).toBe("DETAILED_DESIGN");
    expect(detailDecision.cell_key).toBe("canada:DETAILED_DESIGN");
    expect(detailDecision.candidates[0].rule_ids).toContain("CA-DETAIL-TICKET");

    const existing = ruleOf(v2, "CA-EXISTING-TICKET");
    expect(existing.evidence.find((entry) => entry.kind === "ticket-declared")?.attested).toBe(false);
    const existingDecision = classify("audit de sécurité routière en exploitation", {
      title: "",
      hint: "UNSTAGED",
    }, v2);
    expect(existingDecision.stage).toBe("EXISTING");
    expect(existingDecision.cell_key).toBe("");
    expect(existingDecision.confidence).toBe("inferred");

    const asset = ruleOf(v2, "CA-ASSET");
    expect(asset.stage).toBeUndefined();
    expect(asset.asset_type).toBe("station");
    const assetRow = corpusRow("0d9a76ff4e71e2b48ff2a5d96081dd7ee5419ec58275ed8587d246d0a0b2793c");
    expect(assetRow.title).toBe("Transitway Station Design");
    const assetDecision = classify("", { title: assetRow.title, hint: "UNSTAGED" }, v2);
    expect(assetDecision.stage).toBe("UNSTAGED");
    expect(assetDecision.asset_type).toBe("station");
    expect(assetDecision.candidates).toEqual([]);
    expect(assetDecision.cell_key).toBe("");
  });
});

describe("reference-PDF attestation (slow)", () => {
  beforeAll(async () => {
    // Extracted once per test file, memoised for every slow test below.
    await pdfText("ontario-good-roads-rsa-guideline-2023.pdf");
    await pdfText("qc-mtq-guide-audits-securite-routiere-2012.pdf");
    await pdfText("unb-transportation-group-rsa-guidelines.pdf");
  }, 120000);

  it("CA-PRELIM-FR — 'avant-projet préliminaire' and 'plans et devis préliminaires' occur in the QC guide", async () => {
    await expectPhraseInPdf("qc-mtq-guide-audits-securite-routiere-2012.pdf", "avant-projet préliminaire");
    await expectPhraseInPdf("qc-mtq-guide-audits-securite-routiere-2012.pdf", "plans et devis préliminaires");

    const decision = classify("plans et devis préliminaires", { title: "", hint: "UNSTAGED" }, v2);
    expect(decision.stage).toBe("PRELIMINARY_DESIGN");
    expect(decision.cell_key).toBe("canada:PRELIMINARY_DESIGN");
    expect(decision.candidates[0].rule_ids).toContain("CA-PRELIM-FR");

    const body = classify("avant-projet préliminaire", { title: "", hint: "UNSTAGED" }, v2);
    expect(body.stage).toBe("PRELIMINARY_DESIGN");
    expect(body.candidates[0].rule_ids).toContain("CA-PRELIM-FR");

    // The bare v1-parity French form is retained on purpose (plan Amendment
    // A): v1's PRELIMINARY_DESIGN rule carried `pr[ée]liminaire`, so dropping
    // it would push a French document OUT of the canada:PRELIMINARY_DESIGN
    // cell. Measured in the QC guide (8 occurrences of the standalone word).
    const bare = classify("rapport préliminaire de l'audit", { title: "", hint: "UNSTAGED" }, v2);
    expect(bare.stage).toBe("PRELIMINARY_DESIGN");
    expect(bare.cell_key).toBe("canada:PRELIMINARY_DESIGN");
    expect(bare.candidates[0].rule_ids).toContain("CA-PRELIM-FR");
  });

  it("CA-DETAIL-FR — 'plans et devis définitifs' and 'avant-projet définitif' occur in the QC guide", async () => {
    await expectPhraseInPdf("qc-mtq-guide-audits-securite-routiere-2012.pdf", "plans et devis définitifs");
    await expectPhraseInPdf("qc-mtq-guide-audits-securite-routiere-2012.pdf", "avant-projet définitif");

    const decision = classify("plans et devis définitifs", { title: "", hint: "UNSTAGED" }, v2);
    expect(decision.stage).toBe("DETAILED_DESIGN");
    expect(decision.cell_key).toBe("canada:DETAILED_DESIGN");
    expect(decision.candidates[0].rule_ids).toContain("CA-DETAIL-FR");

    const body = classify("avant-projet définitif", { title: "", hint: "UNSTAGED" }, v2);
    expect(body.stage).toBe("DETAILED_DESIGN");
    expect(body.candidates[0].rule_ids).toContain("CA-DETAIL-FR");

    // The bare v1-parity French form is retained on purpose (plan Amendment
    // A): v1's DETAILED_DESIGN rule carried `d[ée]taill[ée]e?\b`, so dropping
    // it would push a French document OUT of the canada:DETAILED_DESIGN cell.
    // Measured in the QC guide (the only occurrence of 'détaillée' in the 7
    // committed reference PDFs).
    const bare = classify("analyse détaillée d'accidents", { title: "", hint: "UNSTAGED" }, v2);
    expect(bare.stage).toBe("DETAILED_DESIGN");
    expect(bare.cell_key).toBe("canada:DETAILED_DESIGN");
    expect(bare.candidates[0].rule_ids).toContain("CA-DETAIL-FR");
  });

  it("CA-AMBIG-CONCEPT — 'concept design' occurs in the ON guideline and yields the contested pair", async () => {
    await expectPhraseInPdf("ontario-good-roads-rsa-guideline-2023.pdf", "concept design");

    const decision = classify("concept design", { title: "", hint: "UNSTAGED" }, v2);
    expect(decision.ambiguous).toBe(true);
    expect(decision.candidates.map((candidate) => candidate.stage).sort()).toEqual([
      "FEASIBILITY_CONCEPT",
      "PRELIMINARY_DESIGN",
    ]);
    expect(decision.candidates[0].rule_ids).toEqual(["CA-AMBIG-CONCEPT"]);
    expect(decision.confidence).toBe("inferred");
    expect(decision.cell_key).toBe("");
  });

  it("CA-AMBIG-AVP — the bare 'avant-projet' yields the contested pair; the qualified forms are tier 1", async () => {
    await expectPhraseInPdf("qc-mtq-guide-audits-securite-routiere-2012.pdf", "avant-projet préliminaire");

    // The tier-2 rule owns the BARE (unqualified) French phrase. That form
    // is unattested in the committed reference set (0 occurrences in all 7
    // PDFs, measured 2026-10-22) — the test asserts the honesty flag, never
    // an attestation.
    const entry = ruleOf(v2, "CA-AMBIG-AVP").evidence.find((item) => item.phrase === "avant-projet");
    expect(entry?.attested).toBe(false);

    const decision = classify("avant-projet", { title: "", hint: "UNSTAGED" }, v2);
    expect(decision.ambiguous).toBe(true);
    expect(decision.candidates.map((candidate) => candidate.stage).sort()).toEqual([
      "FEASIBILITY_CONCEPT",
      "PRELIMINARY_DESIGN",
    ]);
    expect(decision.candidates[0].rule_ids).toEqual(["CA-AMBIG-AVP"]);
    expect(decision.confidence).toBe("inferred");
    expect(decision.cell_key).toBe("");
    expect(decision.source).toBe("text");

    // Disjointness: the qualified forms are named tier-1 stages, so they
    // never reach the tier-2 rule (D11) and the ambiguity stays reachable.
    const prelim = classify("avant-projet préliminaire", { title: "", hint: "UNSTAGED" }, v2);
    expect(prelim.ambiguous).toBe(false);
    expect(prelim.stage).toBe("PRELIMINARY_DESIGN");
    expect(prelim.candidates[0].rule_ids).toContain("CA-PRELIM-FR");
    expect(prelim.candidates[0].rule_ids).not.toContain("CA-AMBIG-AVP");

    const detail = classify("avant-projet définitif", { title: "", hint: "UNSTAGED" }, v2);
    expect(detail.ambiguous).toBe(false);
    expect(detail.stage).toBe("DETAILED_DESIGN");
    expect(detail.candidates[0].rule_ids).toContain("CA-DETAIL-FR");
    expect(detail.candidates[0].rule_ids).not.toContain("CA-AMBIG-AVP");
  });

  it("CA-AMBIG-PCT — the 75 % marker yields the contested pair, tier 1 wins on 90 %", async () => {
    await expectPhraseInPdf("unb-transportation-group-rsa-guidelines.pdf", "75% design");
    await expectPhraseInPdf(
      "alberta-transportation-rsa-guidelines-2004.pdf",
      "before 75% completion of the project and is the equivalent of the 90% to 95% stage of the design",
    );

    const decision = classify("75% design", { title: "", hint: "UNSTAGED" }, v2);
    expect(decision.ambiguous).toBe(true);
    expect(decision.candidates.map((candidate) => candidate.stage).sort()).toEqual([
      "DETAILED_DESIGN",
      "PRELIMINARY_DESIGN",
    ]);
    expect(decision.candidates[0].rule_ids).toEqual(["CA-AMBIG-PCT"]);
    expect(decision.confidence).toBe("inferred");
    expect(decision.cell_key).toBe("");

    const tier1 = classify(
      "before 75% completion of the project and is the equivalent of the 90% to 95% stage of the design",
      { title: "", hint: "UNSTAGED" },
      v2,
    );
    expect(tier1.stage).toBe("DETAILED_DESIGN");
    expect(tier1.candidates).toHaveLength(1);
    expect(tier1.candidates[0].rule_ids).toEqual(["CA-PCT-DETAIL"]);
  });
});

describe("stage rules — the frozen v1 baseline (ticket #62 M2.3, group 2)", () => {
  it("v1 freeze — the four regex literals in scripts/harvest-track-a.ts are the v1 rule set", () => {
    const source = readFileSync(HARVESTER, "utf8");
    const literals = [...source.matchAll(/\[(\/(?:[^\\\/\n]|\\.)+\/[a-z]*),\s*"([A-Z_]+)"\]/g)].map(
      (match) => {
        const literal = match[1];
        const cut = literal.lastIndexOf("/");
        return { source: literal.slice(1, cut), flags: literal.slice(cut + 1), stage: match[2] };
      },
    );

    expect(literals).toHaveLength(4);
    expect(v1.rules).toHaveLength(4);
    expect(v1.rules.map((rule) => rule.tier)).toEqual([1, 1, 1, 1]);
    expect(literals.map((literal) => literal.source)).toEqual(v1.rules.map((rule) => rule.pattern));
    expect(literals.map((literal) => literal.flags)).toEqual(v1.rules.map((rule) => rule.flags));
    expect(literals.map((literal) => literal.stage)).toEqual(v1.rules.map((rule) => rule.stage));
  });

  it("v1 freeze — the v1 cells are byte-equal to CANONICAL_STAGE", () => {
    const source = readFileSync(HARVESTER, "utf8");
    const block = /const CANONICAL_STAGE[^=]*= \{([\s\S]*?)\n\};/.exec(source);
    expect(block).not.toBeNull();
    const canonical: Record<string, string> = {};
    for (const match of block![1].matchAll(/([A-Z_]+):\s*"([^"]*)"/g)) canonical[match[1]] = match[2];

    expect(Object.keys(canonical)).toEqual([
      "FEASIBILITY_CONCEPT",
      "PRELIMINARY_DESIGN",
      "DETAILED_DESIGN",
    ]);
    expect(JSON.stringify(canonical)).toBe(JSON.stringify(v1.cells));

    const mapped = Object.fromEntries(
      Object.entries(MANIFEST_STAGE_TO_CELL).filter(([key]) => key in v1.cells),
    );
    expect(mapped).toEqual(v1.cells);
  });
});

describe("stage rules — v1 behavioural equality (ticket #62 M2.3, group 3)", () => {
  it("the frozen v1 classification equals the live detectStage on 33 manifest titles and the committed literals", () => {
    const cases: Array<[string, string]> = manifestRows.map((row) => [row.title, row.stage]);
    for (const file of [
      "tests/discovery/harvest-track-a.test.ts",
      "tests/discovery/harvest-track-a-round2-report.test.ts",
    ]) {
      cases.push(...detectStageLiterals(file));
    }
    // The same rule firing twice is one stage, not MULTI_STAGE: the live code
    // collapses distinct stages, not distinct rules.
    cases.push(["planning stage and planning stage", ""]);
    cases.push(["preliminary design and stage 2", ""]);

    expect(cases.length).toBeGreaterThanOrEqual(33);
    for (const [text, hint] of cases) {
      expect(classify(text, { title: text, hint }, v1).stage, `text: ${text}`).toBe(
        detectStage(text, hint),
      );
    }
  });
});

describe("stage rules — classifier units (ticket #62 M2.3, group 4)", () => {
  it("no candidate falls back to the hint", () => {
    const decision = classify("", { title: "", hint: "UNSTAGED" }, v2);
    expect(decision.stage).toBe("UNSTAGED");
    expect(decision.confidence).toBeNull();
    expect(decision.candidates).toEqual([]);
    expect(decision.cell_key).toBe("");
    expect(decision.source).toBe("hint");
    expect(decision.body_available).toBe(false);
  });

  it("two stages in one document are ambiguous and carry no cell", () => {
    const decision = classify("planning stage and detailed design", { title: "", hint: "UNSTAGED" }, v2);
    expect(decision.ambiguous).toBe(true);
    expect(decision.candidates.length).toBeGreaterThanOrEqual(2);
    expect(decision.confidence).toBe("inferred");
    expect(decision.cell_key).toBe("");
    // Determinism: the same input yields the same decision, every time.
    expect(classify("planning stage and detailed design", { title: "", hint: "UNSTAGED" }, v2)).toEqual(
      decision,
    );
  });

  it("the no-cell buckets EXISTING and CONSTRUCTION carry no cell and are inferred", () => {
    for (const text of ["existing road", "construction stage"]) {
      const decision = classify(text, { title: "", hint: "UNSTAGED" }, v2);
      expect(decision.cell_key).toBe("");
      expect(decision.confidence).toBe("inferred");
      expect(decision.candidates[0].stage).toBe(text.startsWith("existing") ? "EXISTING" : "CONSTRUCTION");
    }
  });

  it("an asset cue is metadata only and never changes a stage", () => {
    const assetOnly = classify("", { title: "Transitway Station Design", hint: "UNSTAGED" }, v2);
    expect(assetOnly.stage).toBe("UNSTAGED");
    expect(assetOnly.asset_type).toBe("station");
    expect(assetOnly.candidates).toEqual([]);
    expect(assetOnly.cell_key).toBe("");

    const withStage = classify("detailed design", { title: "Station Design Report", hint: "UNSTAGED" }, v2);
    expect(withStage.stage).toBe("DETAILED_DESIGN");
    expect(withStage.cell_key).toBe("canada:DETAILED_DESIGN");
    expect(withStage.asset_type).toBe("station");
  });
});

describe("stage rules — negative prose traps (ticket #62 M2.3, group 5)", () => {
  it("'the responsibility for the final design rests with the Owner' is no detailed design", () => {
    const decision = classify("the responsibility for the final design rests with the Owner", {
      title: "",
      hint: "UNSTAGED",
    }, v2);
    expect(decision.stage).not.toBe("DETAILED_DESIGN");
    expect(decision.candidates.map((candidate) => candidate.stage)).not.toContain("DETAILED_DESIGN");
  });

  it("'leave the current end treatment in-service' is no existing audit", () => {
    const decision = classify("leave the current end treatment in-service", {
      title: "",
      hint: "UNSTAGED",
    }, v2);
    expect(decision.stage).not.toBe("EXISTING");
    expect(decision.candidates.map((candidate) => candidate.stage)).not.toContain("EXISTING");
  });

  it("'mise en service' is no pre-opening stage (the v1 false positive)", () => {
    const decision = classify("mise en service", { title: "", hint: "UNSTAGED" }, v2);
    expect(decision.stage).not.toBe("PRE_OPENING");
    expect(decision.candidates.map((candidate) => candidate.stage)).not.toContain("PRE_OPENING");
    // The frozen v1 does mis-read it: that is the defect v2 fixes.
    expect(detectStage("mise en service", "UNSTAGED")).toBe("PRE_OPENING");
  });

  it("'50 %' bus volume and '60 km/h' are no percentage stage", () => {
    const decision = classify("The route carries 50 % of the daily bus volume at 60 km/h.", {
      title: "",
      hint: "UNSTAGED",
    }, v2);
    expect(decision.candidates).toEqual([]);
    const ruleIds = decision.candidates.flatMap((candidate) => candidate.rule_ids);
    expect(ruleIds).not.toContain("CA-PCT-DETAIL");
    expect(ruleIds).not.toContain("CA-AMBIG-PCT");
  });
});

/** The `detectStage` literals committed in the two existing harvest test files. */
function detectStageLiterals(file: string): Array<[string, string]> {
  const source = readFileSync(path.join(REPO, file), "utf8");
  const found: Array<[string, string]> = [];
  const pairs = /detectStage(?:WithSource)?\(\s*"((?:[^"\\]|\\.)*)"\s*,\s*"((?:[^"\\]|\\.)*)"/g;
  const singles = /detectStage(?:WithSource)?\(\s*"((?:[^"\\]|\\.)*)"\s*\)/g;
  for (const match of source.matchAll(pairs)) found.push([match[1], match[2]]);
  for (const match of source.matchAll(singles)) found.push([match[1], ""]);
  return found;
}
