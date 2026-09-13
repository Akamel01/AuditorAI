#!/usr/bin/env python3
"""C7 proof: every fenced quote in gf-quote-pack.md is a word-sequence-exact substring
of its source txt UNDER WHITESPACE FOLDING (pdftotext wraps lines mid-sentence, so raw
newlines are folded on both sides before comparison). Punctuation and case must match
exactly; folding rule is stated here and in the pack. Single source of truth = pack file."""
import os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEXT = "/tmp/c7c8-text"
pack = open(os.path.join(ROOT, "gf-quote-pack.md")).read()
blocks = re.findall(r"```quote src=(\S+)\n(.*?)```", pack, re.S)
assert blocks, "no quote blocks parsed"
fails, per_gf = [], {}
current = None
for line in pack.splitlines():
    m = re.match(r"## (GF-\d+)", line)
    if m:
        current = m.group(1)
    m = re.match(r"- \[ \] (APPROVE|STRIKE).*— (\S+)", line)
    if m and current:
        per_gf.setdefault(current, []).append(m.group(2))
ok = 0
fold = lambda s: " ".join(s.split())
for src, q in blocks:
    q = fold(q.strip())
    p = os.path.join(TEXT, src)
    try:
        t = fold(open(p, errors="replace").read())
    except OSError:
        fails.append((src, "SOURCE MISSING")); continue
    if q and q in t:
        ok += 1
    else:
        fails.append((src, q[:80]))
print(f"quotes: {len(blocks)} checked, {ok} byte-exact, {len(fails)} FAIL")
for gf, ids in sorted(per_gf.items()):
    print(f"  {gf}: {len(ids)} candidates")
for src, q in fails:
    print(f"FAIL {src}: {q}")
sys.exit(1 if fails else 0)
