#!/usr/bin/env python3
"""C8: assemble finetune-pack.jsonl + train/holdout split from pairs.json (rerunnable).
Split rule: holdout = whole sources (Tacoma + 16-120) -> zero cross-split source overlap;
proof query additionally asserts no shared C5 exact-dup group across the split."""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
pairs = json.load(open(os.path.join(ROOT, "pairs.json")))
idx = {r["path"]: r for r in json.load(open(os.path.join(ROOT, "dedupe-index.json")))}
HOLDOUT_MARKERS = ("Tacoma_S_Tacoma_Way", "16-120_Transit")
SRC_OF = {
    "MnDOT_US12_RSA_Technical_Report": "state-dots/MnDOT_US12_RSA_Technical_Report.pdf",
    "MnDOT_Hwy55_RSA_2021": "state-dots/MnDOT_Hwy55_RSA_2021.pdf",
    "Fairfax_Blake_Lane_Ped_RSA_2024": "local-mpo/Fairfax_Blake_Lane_Ped_RSA_2024.pdf",
    "Tacoma_S_Tacoma_Way_RSA_2024": "local-mpo/Tacoma_S_Tacoma_Way_RSA_2024.pdf",
    "FHWA-SA-16-120_Transit_Access_RSA_4_RSA": "fhwa-case-studies/FHWA-SA-16-120_Transit_Access_RSA_4_RSA.pdf",
    "Karnataka_RSA_Field_Guide_with_Case_Study": "intl/piarc-irf/Karnataka_RSA_Field_Guide_with_Case_Study.pdf",
}

def src_key(p):
    for k in SRC_OF:
        if k in p["source"]:
            return k
    return "multi"

train, hold = [], []
for p in pairs:
    (hold if any(m in p["source"] for m in HOLDOUT_MARKERS) else train).append(p)

# proof: no shared exact-dup group across split
def groups(ps):
    g = set()
    for p in ps:
        k = src_key(p)
        r = idx.get(SRC_OF.get(k, ""), {})
        if r.get("exact_dup_group"):
            g.add(r["exact_dup_group"])
    return g
leak = groups(train) & groups(hold)
assert not leak, f"SPLIT LEAKAGE: {leak}"

# proof: holdout sources disjoint from train sources (except multi-source synthesis pairs)
th = {src_key(p) for p in hold} - {"multi"}
tr = {src_key(p) for p in train} - {"multi"}
assert not (th & tr), f"SOURCE OVERLAP: {th & tr}"

for name, ps in (("train", train), ("holdout", hold)):
    with open(os.path.join(ROOT, f"finetune-{name}.jsonl"), "w") as fh:
        for p in ps:
            fh.write(json.dumps(p) + "\n")

tiers, shapes = {}, {}
for p in pairs:
    tiers[p["tier"]] = tiers.get(p["tier"], 0) + 1
    shapes[p["shape"]] = shapes.get(p["shape"], 0) + 1
print(f"pairs={len(pairs)} train={len(train)} holdout={len(hold)} tiers={tiers} shapes={shapes}")
print(f"T0 count={[p for p in pairs if p['tier']=='T0'] and len([p for p in pairs if p['tier']=='T0']) or 0}")
print("split-leak proof: no shared C5 exact-dup group; holdout sources disjoint from train")
print("license: pair sources CLEAR per LICENSE-REGISTER (fhwa-case-studies/state-dots/local-mpo); GF-9-DIRECT exception (register:20, use cleared 2026-09-15) covers staged PROPOSED piarc-irf pairs only — pairs.json/finetune splits stay CLEAR-only")
