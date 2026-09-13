#!/usr/bin/env python3
"""C5: exact sha256 pass + filename-stem near-dup candidates + sample-corpus overlap.
Content-shingle pass deferred to post-C6-full-run (documented). Stdlib only."""
import hashlib, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP = {"corpus-inventory.json", "corpus-catalog.json", "dedupe-report.md", "dedupe-index.json",
        "corpus-schema.md", "corpus-schema.json", "QUARANTINE.md",
        "LICENSE-REGISTER.md", "MOVE_MANIFEST.md", "extraction-matrix.md",
        "gf-quote-pack.md", "pairs.json", "finetune-train.jsonl", "finetune-holdout.jsonl",
        "ingestion-manifest.md"}
ED = re.compile(r"\b(19|20)\d{2}\b|_alt$|^alt_|\bv\d+\b|\brev\d*\b|\bfinal\b|\bdraft\b|\bupdate[d]?\b", re.I)

def sha(p):
    h = hashlib.sha256()
    with open(p, "rb") as fh:
        for b in iter(lambda: fh.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()

def stem(name):
    s = os.path.splitext(name)[0].lower()
    s = re.sub(r"[^a-z0-9]+", " ", s)
    toks = [t for t in s.split() if not ED.fullmatch(t)]
    return toks

def jacc(a, b):
    A, B = set(a), set(b)
    return len(A & B) / len(A | B) if A | B else 1.0

files = []
for dp, dn, fn in os.walk(ROOT):
    dn.sort()
    for f in sorted(fn):
        p = os.path.join(dp, f)
        rel = os.path.relpath(p, ROOT)
        if (rel in SKIP or rel.startswith("scripts/") or rel.startswith(".autoforge/")
                or os.path.basename(rel).startswith(".")):
            continue
        try:
            files.append((rel, sha(p), os.path.getsize(p)))
        except OSError:
            pass

by_hash = {}
for rel, h, s in files:
    by_hash.setdefault(h, []).append((rel, s))
exact = {h: v for h, v in by_hash.items() if len(v) > 1}

stems = {rel: stem(os.path.basename(rel)) for rel, _, _ in files}
rels = sorted(stems)
near = []
for i in range(len(rels)):
    for j in range(i + 1, len(rels)):
        a, b = rels[i], rels[j]
        if a.split("/")[0] != b.split("/")[0]:
            continue  # same top dir only (cross-dir deferred with moves)
        jx = jacc(stems[a], stems[b])
        if jx >= 0.9 and stems[a] != stems[b]:
            near.append((a, b, round(jx, 3)))

sc = json.load(open(os.path.join(ROOT, "..", "..", "state", "sample-corpus.json")))
raw = sc.get("samples", [])
samples = raw if isinstance(raw, list) else list(raw.values())
GENERIC = {"manual", "guidelines", "guideline", "report", "review", "safety", "audit", "audits", "road", "roads", "rsa", "highway", "traffic", "program", "policy", "final"}
overlap = []
for v in samples:
    if not isinstance(v, dict):
        continue
    k = v.get("id", "?")
    toks = [t for t in re.findall(r"[a-z0-9]{6,}", (k + " " + json.dumps(v)).lower())
            if t not in GENERIC]
STOP = {"int", "us", "ca", "ae", "rsa", "stage1", "stage2", "stage3", "stage12", "response",
        "report", "reports", "full", "package", "batch", "compilation", "corridor", "review",
        "manual", "project", "batch", "cat", "post", "exec", "summary", "group"}
overlap = []
for v in samples:
    if not isinstance(v, dict):
        continue
    k = v.get("id", "?")
    idtoks = [t for t in k.lower().split("-") if len(t) >= 4 and t not in STOP]
    hits = sorted({r for r, _, _ in files
                   if any(t in os.path.basename(r).lower().replace("%20", " ") for t in idtoks)})
    if hits:
        overlap.append((k, hits[:5]))
sids = [v.get("id", "?") for v in samples if isinstance(v, dict)]
sids = [v.get("id", "?") for v in samples if isinstance(v, dict)]

canon, n = {}, 0
for rel, h, s in sorted(files):
    key = h if h in exact else rel
    if key not in canon:
        n += 1
        canon[key] = f"C-{n:04d}"
index = [{"path": rel, "sha256": h, "bytes": s,
          "canonical_id": canon[h if h in exact else rel],
          "exact_dup_group": h[:12] if h in exact else None} for rel, h, s in sorted(files)]
json.dump(index, open(os.path.join(ROOT, "dedupe-index.json"), "w"), indent=0)

L = ["# Dedupe report (C5) — 2026-09-12",
     f"Scanned {len(files)} content files (sha256 full pass).",
     "", "## Exact duplicates (sha256)",
     "Rule: keep copy in non-quarantine dir; tie → keep larger. Loser = DROP-CANDIDATE (owner sign-off required, none deleted)."]
if exact:
    for h, v in sorted(exact.items()):
        v = sorted(v, key=lambda x: ("quarantine" in x[0], -x[1]))
        L.append(f"- `{h[:12]}` KEEP `{v[0][0]}` " + " ".join(f"DROP-CANDIDATE `{r}`" for r, _ in v[1:]))
else:
    L.append("- none (zero exact-duplicate groups)")
L += ["", "## Near-duplicate candidates (filename-stem token Jaccard ≥ 0.9, same top dir)",
      "Method note: filename proxy only; content-shingle pass deferred to post-C6 full extraction run. Verdict: KEEP both + note, unless exact."]
known = ["FHWA-SA-06-006", "Bicycle"]
for a, b, j in near:
    L.append(f"- J={j} `{a}` ↔ `{b}` KEEP-both (edition/variant suspected)")
if not near:
    L.append("- none at ≥0.9")
L += ["", "## Known-pair check (must catch, zero false negatives)"]
for k in known:
    hit = [x for x in near + [(a, b, 1.0) for h, v in exact.items() for a in [v[0][0]] for b in [x[0] for x in v[1:]]] if k.lower() in (x[0] + x[1]).lower()]
    L.append(f"- {k}: {'CAUGHT (' + str(len(hit)) + ' cluster(s))' if hit else 'NOT FOUND — INVESTIGATE'}")
L += ["", "## Sample-corpus overlap (`state/sample-corpus.json`, E3 lineage)"]
L.append(f"- {len(sids)} sample ids; filename-evidence matches: {len(overlap)}")
for k, h in overlap:
    L.append(f"  - {k} ↔ {h}")
missing = [k for k in sids if k not in {k for k, _ in overlap}]
L.append(f"- No direct counterpart ({len(missing)}): {missing}")
L.append("  Reading: pre-harvest/UK/MassDOT project samples absent from corpus → C9 stratification gaps, not corpus defects.")
L.append("- Lineage: vault/journal/2026-08-23-phase2-sample-corpus.md (linked, not copied)")
open(os.path.join(ROOT, "dedupe-report.md"), "w").write("\n".join(L) + "\n")
print(f"files={len(files)} exact_groups={len(exact)} near={len(near)} overlap={len(overlap)}")
for h, v in exact.items():
    print("EXACT:", [r for r, _ in v])
