import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  TSV_COLUMNS,
  serializeDedupeIndex,
  isRsaDocument,
  TEST_PROVINCES,
  detectLang,
  detectProvince,
  detectStage,
  detectTier,
  hashSkipReason,
  knownHashes,
  missingSideNote,
  projectKeyFor,
  splitFor,
  HASH_SKIP_REASON,
  type Source,
} from "../../scripts/harvest-track-a";

const bcSource = {
  id: "bc-moti",
  strategy: "sitemap-keyword",
} as Source;

describe("splitFor (ticket #40 §7: geography first, licence gate second)", () => {
  it("puts held-out provinces in test", () => {
    expect(splitFor("QC", "CLEAR")).toBe("test");
    expect(splitFor("AB", "CLEAR")).toBe("test");
  });

  it("puts every other province in train", () => {
    expect(splitFor("BC", "CLEAR")).toBe("train");
    expect(splitFor("ON", "CLEAR")).toBe("train");
    expect(splitFor("NB", "CLEAR")).toBe("train");
  });

  it("never puts a non-CLEAR document in train or test", () => {
    for (const verdict of ["RESTRICTED", "BLOCKED"]) {
      for (const province of ["QC", "AB", "BC", "ON"]) {
        const split = splitFor(province, verdict);
        expect(split === "train" || split === "test").toBe(false);
      }
    }
    expect(splitFor("BC", "RESTRICTED")).toBe("restricted");
    expect(splitFor("BC", "BLOCKED")).toBe("quarantine");
  });

  it("holds no province in both train and test across every verdict", () => {
    for (const province of ["QC", "AB", "BC", "ON", "NB", "MB", "SK"]) {
      const splits = new Set(["CLEAR", "RESTRICTED", "BLOCKED"].map((v) => splitFor(province, v)));
      expect(splits.has("train") && splits.has("test")).toBe(false);
    }
  });

  it("pins the held-out provinces", () => {
    expect(TEST_PROVINCES).toEqual(["QC", "AB"]);
  });
});

describe("detectStage", () => {
  it("reads the explicit stage from the document text", () => {
    expect(detectStage("Stage 1 Road Safety Audit of the functional plan", "")).toBe(
      "FEASIBILITY_CONCEPT",
    );
    expect(detectStage("Stage 2 Road Safety Audit", "")).toBe("PRELIMINARY_DESIGN");
    expect(detectStage("Stage 3 Road Safety Audit", "")).toBe("DETAILED_DESIGN");
    expect(detectStage("Pre-opening Road Safety Audit", "")).toBe("PRE_OPENING");
  });

  it("marks a document that names several stages as multi-stage", () => {
    expect(detectStage("covers planning stage and detailed design", "")).toBe("MULTI_STAGE");
  });

  it("keeps a single-stage document in its own cell", () => {
    expect(detectStage("Stage 2 Road Safety Audit only", "")).toBe("PRELIMINARY_DESIGN");
  });

  it("falls back to the source hint when no stage appears", () => {
    expect(detectStage("no stage keyword here", "PRELIMINARY_DESIGN")).toBe("PRELIMINARY_DESIGN");
  });
});

describe("detectProvince", () => {
  it("reads the province from the text before the hint", () => {
    expect(detectProvince("Prepared for Alberta Transportation", "BC")).toBe("AB");
    expect(detectProvince("British Columbia Ministry of Transportation", "AB")).toBe("BC");
    expect(detectProvince("Ville de Montréal", "BC")).toBe("QC");
  });

  it("falls back to the hint when the province is not named", () => {
    expect(detectProvince("a road safety audit with no jurisdiction", "NB")).toBe("NB");
  });
});

describe("detectLang", () => {
  it("separates English and French text", () => {
    expect(detectLang("Road Safety Audit report for the City of Toronto")).toBe("en");
    expect(detectLang("Rapport d'audit de sécurité routière de la Ville de Montréal")).toBe("fr");
  });
});

describe("detectTier (ladder is extend-only; T2 is never minted)", () => {
  const rsa = "REPORT ON PLANNING STAGE ROAD SAFETY AUDIT North East Edmonton Ring Road. We are pleased to submit our planning stage safety audit report.";
  const policy =
    "Technical Circular T-02/04 SUBJECT: ROAD SAFETY AUDIT (RSA) POLICY PURPOSE To present policy and procedure with respect to the application of the road safety audit (RSA) process to Ministry projects.";
  const guidelines =
    "ROAD SAFETY AUDIT GUIDELINES 1.0 Road Safety Audit Policy 2.0 The Purpose of the Guidelines 3.0 Roles and Responsibilities";

  it("never returns T2 for any input", () => {
    const inputs = [rsa, policy, guidelines, "", "audit only", "outcome of the audit", "post-implementation audit"];
    for (const text of inputs) {
      expect(detectTier(text, "complete-RSA")).not.toBe("T2");
      expect(detectTier(text, "guide")).not.toBe("T2");
    }
  });

  it("maps a document that reports an RSA audit to T3", () => {
    expect(detectTier(rsa, "complete-RSA")).toBe("T3");
  });

  it("maps an RSA policy circular to T1", () => {
    expect(detectTier(policy, "guide")).toBe("T1");
  });

  it("maps RSA guidelines to T1", () => {
    expect(detectTier(guidelines, "guide")).toBe("T1");
  });

  it("maps a document that is not about RSA to T0", () => {
    expect(detectTier("Technical Circular T-02/23 SUBJECT: Median Barrier Placement on New and Existing Multi-Lane Highways", "guide")).toBe("T0");
  });

  it("maps a guideline with case studies to T3", () => {
    expect(detectTier("Canadian Road Safety Audit Guidelines with Case Studies", "case-study")).toBe("T3");
  });

  it("maps an outcome-bearing audit to T4", () => {
    expect(detectTier(`${rsa} with the post-implementation outcome`, "complete-RSA")).toBe("T4");
  });
});

describe("missingSideNote", () => {
  it("names the missing side of a one-sided document", () => {
    expect(missingSideNote("Road Safety Audit report only")).toContain("missing");
  });

  it("marks a document with a response side as complete", () => {
    expect(missingSideNote("... designer response follows")).toContain("complete");
  });
});

describe("projectKeyFor (multi-document projects share one id)", () => {
  it("groups documents that sit in one project directory", () => {
    const a = projectKeyFor(
      "https://www2.gov.bc.ca/assets/gov/transportation/project-x/rsa-stage-1.pdf",
      bcSource,
    );
    const b = projectKeyFor(
      "https://www2.gov.bc.ca/assets/gov/transportation/project-x/rsa-stage-3.pdf",
      bcSource,
    );
    expect(a).toBe(b);
  });

  it("groups a CKAN dataset's staging pages by dataset id", () => {
    const ckan = { id: "ab-open", strategy: "known-document-url" } as Source;
    const a = projectKeyFor(
      "https://open.alberta.ca/dataset/4f6fb605-f342-46ea-b531-d018fd81d70f/resource/2f0b/download/neahdappendixc.pdf",
      ckan,
    );
    const b = projectKeyFor(
      "https://open.alberta.ca/dataset/4f6fb605-f342-46ea-b531-d018fd81d70f/resource/9f9a/download/other.pdf",
      ckan,
    );
    expect(a).toBe(b);
    expect(a).toContain("4f6fb605");
  });

  it("separates different projects", () => {
    const a = projectKeyFor("https://www2.gov.bc.ca/assets/gov/x.pdf", bcSource);
    const b = projectKeyFor("https://www2.gov.bc.ca/assets/gov/y/z.pdf", bcSource);
    expect(a).not.toBe(b);
  });
});

describe("TSV_COLUMNS", () => {
  it("carries every protocol field the ticket names", () => {
    expect(TSV_COLUMNS).toEqual([
      "project_id",
      "sha256",
      "tier",
      "stage",
      "cell_key",
      "ca_province",
      "lang",
      "split",
      "doc_type",
      "source_url",
      "licence_verdict",
      "fetched_at",
      "bytes",
      "local_path",
    ]);
  });

  it("has no duplicate column", () => {
    expect(new Set(TSV_COLUMNS).size).toBe(TSV_COLUMNS.length);
  });
});

describe("isRsaDocument (subject, not citation)", () => {
  it("accepts a document whose subject is an RSA", () => {
    expect(isRsaDocument("REPORT ON PLANNING STAGE ROAD SAFETY AUDIT North East Edmonton Ring Road")).toBe(true);
  });

  it("accepts an RSA policy circular", () => {
    expect(isRsaDocument("SUBJECT: ROAD SAFETY AUDIT (RSA) POLICY PURPOSE To present policy")).toBe(true);
  });

  it("rejects a technical circular that is about something else", () => {
    expect(
      isRsaDocument("Technical Circular T-02/23 SUBJECT: Median Barrier Placement on Multi-Lane Highways"),
    ).toBe(false);
  });

  it("rejects a document that only cites RSA in passing", () => {
    expect(
      isRsaDocument("Horse and Rider Guidelines. See Technical Circular T-02/04 for road safety audit policy."),
    ).toBe(false);
  });
});

describe("known-hash rule (never re-download a document the corpus already holds)", () => {
  const known = knownHashes();

  it("names the skip reason", () => {
    expect(HASH_SKIP_REASON).toBe("hash-already-present");
  });

  it("holds every sha256 of the on-disk inventory", () => {
    const raw = readFileSync(
      path.join(process.cwd(), "docs/RSA-Documents/track-a-ondisk-inventory.jsonl"),
      "utf8",
    );
    const shas = raw
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => (JSON.parse(l) as { sha256: string }).sha256);
    expect(shas.length).toBeGreaterThan(0);
    for (const sha of shas) expect(known.has(sha)).toBe(true);
  });

  it("holds the sha256 of the corpus catalog and the corpus dedupe index", () => {
    const catalog = JSON.parse(
      readFileSync(path.join(process.cwd(), "docs/RSA-Documents/corpus-catalog.json"), "utf8"),
    ) as { records: Array<{ sha256: string }> };
    const dedupe = JSON.parse(
      readFileSync(path.join(process.cwd(), "docs/RSA-Documents/dedupe-index.json"), "utf8"),
    ) as Array<{ sha256: string }>;
    expect(catalog.records.length).toBeGreaterThan(0);
    expect(dedupe.length).toBeGreaterThan(0);
    for (const row of catalog.records) expect(known.has(row.sha256)).toBe(true);
    for (const row of dedupe) expect(known.has(row.sha256)).toBe(true);
  });

  it("skips a document whose sha256 is already known", () => {
    const sha = [...known][0];
    expect(hashSkipReason(sha, known)).toBe("hash-already-present");
  });

  it("does not skip a document the corpus does not hold", () => {
    expect(hashSkipReason("f".repeat(64), known)).toBe(null);
  });
});

describe("serializeDedupeIndex (the corpus index format must not drift)", () => {
  it("keeps the file format the corpus python scripts write", () => {
    const out = serializeDedupeIndex([{ path: "a.pdf", sha256: "x", bytes: 3 }]);
    expect(out).toBe(
      ['[', '{', '"path": "a.pdf",', '"sha256": "x",', '"bytes": 3', "}", "]"].join("\n"),
    );
  });

  it("round-trips the committed corpus index byte for byte", () => {
    const raw = readFileSync(
      path.join(process.cwd(), "docs/RSA-Documents/dedupe-index.json"),
      "utf8",
    );
    expect(serializeDedupeIndex(JSON.parse(raw) as Array<Record<string, unknown>>)).toBe(raw);
  });
});
