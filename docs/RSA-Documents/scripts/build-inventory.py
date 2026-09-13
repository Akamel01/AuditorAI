#!/usr/bin/env python3
"""C1: build docs/RSA-Documents/corpus-inventory.json (stdlib only, rerunnable).
Self-excludes its own output. Heuristic hints only; C2/C6 refine."""
import json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "corpus-inventory.json")
INDEX_CLAIM = {"docs": 73, "mb": 331}  # COLLECTION_INDEX.md header claims

def jurisdiction(rel):
    top = rel.split("/")[0]
    if top in ("canadian", "canadian-methodology", "canadian-not-audit",
               "canadian-html-quarantine", "canadian-quarantine-v2",
               "canadian-staging", "atip-package"):
        return "CA"
    if top in ("fhwa-case-studies", "fha-case-studies", "state-dots", "local-mpo"):
        return "USA"
    if top == "piarc-irf":
        return "INT"
    return "sys"

FR = re.compile(r"quebec|francais|francophone|_fr[._-]", re.I)

files, total = [], 0
for dp, dn, fn in os.walk(ROOT):
    dn.sort()
    for f in sorted(fn):
        p = os.path.join(dp, f)
        rel = os.path.relpath(p, ROOT)
        if rel == "corpus-inventory.json":
            continue
        try:
            s = os.path.getsize(p)
        except OSError:
            files.append({"path": rel, "bytes": -1,
                          "ext": os.path.splitext(f)[1].lower(),
                          "jurisdiction_hint": jurisdiction(rel),
                          "lang_hint": "fr" if FR.search(f) else "en",
                          "status": "suspect"})
            continue
        total += s
        files.append({"path": rel, "bytes": s,
                      "ext": os.path.splitext(f)[1].lower() or "(none)",
                      "jurisdiction_hint": jurisdiction(rel),
                      "lang_hint": "fr" if FR.search(f) else "en",
                      "status": "ok" if s > 0 else "suspect"})

mb = round(total / 1e6, 1)
big = sorted(files, key=lambda e: e["bytes"], reverse=True)[:5]
by_top = {}
for e in files:
    t = e["path"].split("/")[0]
    a = by_top.setdefault(t, [0, 0]); a[0] += 1; a[1] += e["bytes"]
non_us = sum(c for d, (c, _) in by_top.items()
             if d.startswith("canadian") or d in ("state-dots", "local-mpo", "piarc-irf", "fhwa-case-studies"))
empties = sorted(d for d in os.listdir(ROOT)
                 if os.path.isdir(os.path.join(ROOT, d)) and not os.listdir(os.path.join(ROOT, d)))

drifts = [
    {"refs": ["docs/RSA-Documents/COLLECTION_INDEX.md"],
     "note": f"Count stale: index claims {INDEX_CLAIM['docs']} documents, tree holds {len(files)} files (~{len(files)/INDEX_CLAIM['docs']:.1f}x)"},
    {"refs": ["docs/RSA-Documents/COLLECTION_INDEX.md"],
     "note": f"Size stale: index claims {INDEX_CLAIM['mb']}MB, measured {mb}MB"},
    {"refs": ["docs/RSA-Documents/COLLECTION_INDEX.md"] + sorted(
        d for d in by_top if d.startswith("canadian") or d in ("state-dots", "local-mpo", "piarc-irf", "fhwa-case-studies"))[:4],
     "note": f"Coverage stale: index covers US baseline only; omits ~{non_us} files across canadian*/state-dots/local-mpo/piarc-irf/fhwa-case-studies"},
    {"refs": [f"docs/RSA-Documents/{d}" for d in empties] or ["docs/RSA-Documents/"],
     "note": f"Empty dirs with unknown purpose, unindexed: {empties or 'none'}"},
    {"refs": ["docs/RSA-Documents/fha-case-studies", "docs/RSA-Documents/fhwa-case-studies"],
     "note": "Naming near-collision: fha-case-studies (empty) vs fhwa-case-studies (35 files) — C4 must disambiguate"},
    {"refs": [f"docs/RSA-Documents/{e['path']}" for e in big],
     "note": f"Size outliers (top5): {[(e['path'], round(e['bytes']/1e6,1)) for e in big]} MB"},
]

with open(OUT, "w") as fh:
    json.dump({"generated_by": "scripts/build-inventory.py (C1)",
               "files": files, "drifts": drifts}, fh, indent=1)
print(f"wrote {OUT}: {len(files)} files, {mb}MB, {len(drifts)} drifts")
