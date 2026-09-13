#!/usr/bin/env python3
"""C1: build docs/RSA-Documents/corpus-inventory.json (stdlib only, rerunnable).
Self-excludes its own output. Heuristic hints only; C2/C6 refine."""
import json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "corpus-inventory.json")
INDEX_CLAIM = {"docs": 73, "mb": 331}  # COLLECTION_INDEX.md header claims

def jurisdiction(rel):
    parts = rel.split("/")
    top = parts[0]
    if top == "usa":
        return "USA"
    if top == "canada":
        return "CA"
    if top == "intl":
        return "INT"
    if top == "quarantine":
        return "CA"  # all quarantine dirs are canadian-origin
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
non_us = sum(1 for e in files if not e["path"].startswith("usa/fhwa-case-studies/"))
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
    {"refs": ["docs/RSA-Documents/MOVE_MANIFEST.md"],
     "note": "RESOLVED 2026-09-13: fha-case-studies/ (empty) removed per signed manifest; fhwa-case-studies/ lives at usa/fhwa-case-studies/"},
    {"refs": [f"docs/RSA-Documents/{e['path']}" for e in big],
     "note": f"Size outliers (top5): {[(e['path'], round(e['bytes']/1e6,1)) for e in big]} MB"},
]

with open(OUT, "w") as fh:
    json.dump({"generated_by": "scripts/build-inventory.py (C1)",
               "files": files, "drifts": drifts}, fh, indent=1)
print(f"wrote {OUT}: {len(files)} files, {mb}MB, {len(drifts)} drifts")
