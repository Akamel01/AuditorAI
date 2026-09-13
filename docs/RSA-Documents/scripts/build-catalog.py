#!/usr/bin/env python3
"""C4: build docs/RSA-Documents/corpus-catalog.json (stdlib, rerunnable, never hand-edit).
Universe = C5 dedupe-index rows 1:1 (content documents only; tooling/registers/dotfiles
excluded — their home is scripts/ and root entry files, not the catalog).
Joins inventory bytes/hints + license batches + quarantine verdicts + mechanical labels."""
import json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INV = {e["path"]: e for e in json.load(open(os.path.join(ROOT, "corpus-inventory.json")))["files"]}
IDX = json.load(open(os.path.join(ROOT, "dedupe-index.json")))
OUT = os.path.join(ROOT, "corpus-catalog.json")

LICENSE_CLEAR = {"usa"}
LICENSE_BLOCKED = {("quarantine", "canadian-not-audit")}
# canada/*, intl/*, quarantine/* (else) default RESTRICTED; root entry files CLEAR.
QUAR = {"canadian-html-quarantine", "canadian-quarantine-v2", "canadian-not-audit"}
TIER_ANCHOR = {"UNB_Canadian_RSA_Guidelines_with_Case_Studies.pdf": "T3",
               "TAC_RSA_Pre_Opening_Lessons_Learned.pdf": "T1"}
DTYPE = [("prompt", "prompt-list"), ("toolkit", "toolkit"), ("case", "case-study"),
         ("policy", "policy"), ("present", "presentation"), ("thesis", "complete-RSA"),
         ("guideline", "guide"), ("guide", "guide"), ("manual", "guide")]

def shelf(top, sub, jur):
    if top == "quarantine":
        return f"quarantine/{sub}"
    if "." in top or top in ("_archive",) or jur == "sys":
        return "_system/entry"
    return {"USA": "usa", "CA": "canada", "INT": "intl"}[jur] + "/incoming"

def license_of(top, sub):
    if top in LICENSE_CLEAR:
        return "CLEAR"
    if (top, sub) in LICENSE_BLOCKED:
        return "BLOCKED"
    if "." in top:
        return "CLEAR"  # root entry files
    return "RESTRICTED"

cat, missing = [], []
for r in IDX:
    rel = r["path"]
    e = INV.get(rel)
    if e is None:
        missing.append(rel)
        continue
    top = rel.split("/")[0]
    sub = rel.split("/")[1] if "/" in rel else ""
    base = os.path.basename(rel).lower()
    dt, conf = None, "needs_review"
    for tok, v in DTYPE:
        if tok in base:
            dt, conf = v, "mechanical"
            break
    tier = TIER_ANCHOR.get(os.path.basename(rel))
    rec = {"canonical_id": r["canonical_id"], "path": rel, "bytes": e["bytes"],
           "sha256": r["sha256"], "jurisdiction": e["jurisdiction_hint"],
           "license": license_of(top, sub), "quarantine": "QUARANTINE" if sub in QUAR else None,
           "tier": tier, "doc_type": dt, "stage": None,
           "label_confidence": "anchor" if tier else conf,
           "needs_review": tier is None or dt is None,
           "shelf": shelf(top, sub, e["jurisdiction_hint"])}
    cat.append(rec)
assert not missing, f"index/inventory drift: {missing}"

json.dump({"generated_by": "scripts/build-catalog.py (C4)", "schema": "corpus-schema.md v1.0.0",
           "records": cat}, open(OUT, "w"), indent=0)
import collections
dist = dict(collections.Counter(x["shelf"].split("/")[0] for x in cat))
print(f"wrote {OUT}: {len(cat)} records (index 1:1), shelves={dist}, "
      f"needs_review={sum(1 for x in cat if x['needs_review'])}")
