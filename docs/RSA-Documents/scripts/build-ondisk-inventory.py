#!/usr/bin/env python3
"""M5: inventory every PDF/DOC/DOCX/XLS/XLSX in the operator checkout (read-only) and
reconcile against the tracked corpus metadata.

stdlib only, deterministic, rerunnable, no network. The checkout is NEVER written to.

Outputs (written next to this script's parent directory = docs/RSA-Documents):
  track-a-ondisk-inventory.jsonl  one JSON object per document
  track-a-ondisk-summary.json     counts per class/tier/stage/jurisdiction/language + totals
  track-a-reconciliation.md       drift report (generated, never hand-written)

Labels follow docs/RSA-Documents/HARVESTING_PLAN.md section 1 (tier ladder) and
section 3 (stage / jurisdiction / language vocabularies).  T2 is never emitted.
"""
from __future__ import print_function

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import zipfile
from collections import Counter
from urllib.parse import unquote_plus

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.dirname(SCRIPT_DIR)
DEFAULT_ROOT = "/Users/akamel/Documents/AuditorAI"
CORPUS_PREFIX = "docs/RSA-Documents"
DOC_EXTS = (".pdf", ".doc", ".docx", ".xls", ".xlsx")
SKIP_DIRS = frozenset([".git", "node_modules"])
PDF_TIMEOUT = 20
TEXT_LIMIT = 20000
MAX_EVIDENCE = 200

# ---------------------------------------------------------------- anchors ----
# Ground-truth anchors from HARVESTING_PLAN.md section 1.
ANCHORS = {
    "BC_MoT_RSA_Guidelines_T02-04.pdf": {
        "class": "methodology", "tier": "T0", "stage": "unknown", "jurisdiction": "BC"},
    "TAC_RSA_Pre_Opening_Lessons_Learned.pdf": {
        "class": "rsa-sample", "tier": "T1", "stage": "pre-opening", "jurisdiction": "CAN-GOV"},
    "UNB_Canadian_RSA_Guidelines_with_Case_Studies.pdf": {
        "class": "rsa-sample", "tier": "T3", "stage": "existing", "jurisdiction": "NB"},
    "OC_Transpo_Transitway_RSA.pdf": {
        "class": "rsa-sample", "tier": "T3", "stage": "detailed", "jurisdiction": "ON"},
}

# ------------------------------------------------------------- vocabularies --
PROV_PHRASES = {
    "ON": ["ontario", "ottawa", "otranspo", "oc transpo", "ministry of transportation ontario",
           "mto", "highway 401", "highway 407"],
    "BC": ["british columbia", "moti", "vancouver", "translink", "highway 99", "bc transit"],
    "AB": ["alberta", "calgary", "edmonton", "neahd", "spray valley", "red deer", "lethbridge"],
    "QC": ["quebec", "montreal", "montreal", "mtq", "ville de montreal", "drsp"],
    "MB": ["manitoba", "winnipeg"],
    "SK": ["saskatchewan", "saskatoon", "regina"],
    "NS": ["nova scotia", "halifax"],
    "NB": ["new brunswick", "fredericton", "moncton", "unb"],
    "PE": ["prince edward island", "charlottetown"],
    "NL": ["newfoundland", "avalon", "labrador"],
    "YT": ["yukon", "whitehorse"],
    "NT": ["northwest territories", "yellowknife"],
    "NU": ["nunavut", "iqaluit"],
}
PROV_TOKENS = {
    "ON": ["ontario", "ottawa", "otranspo", "mto", "mississauga"],
    "BC": ["bc", "bct", "moti", "cmfs"],
    "AB": ["ab", "alberta", "ahep"],
    "QC": ["qc", "mtq"],
    "MB": ["mb", "manitoba"],
    "SK": ["sk", "saskatchewan"],
    "NS": ["ns", "novascotia"],
    "NB": ["nb", "unb"],
    "PE": ["pe", "princeedwardisland"],
    "NL": ["nl", "newfoundland", "avalon"],
    "YT": ["yt", "yukon"],
    "NT": ["nt", "northwestterritories"],
    "NU": ["nu", "nunavut"],
}
PROV_ORDER = ["ON", "BC", "AB", "QC", "MB", "SK", "NS", "NB", "PE", "NL", "YT", "NT", "NU"]

# foreign (non-Canadian) agency / country signals -> USA or INT
USA_TOKENS = ["fhwa", "nhtsa", "scdot", "idaho", "usdot", "txdot", "mndot", "ctdot",
              "ncdot", "vdot", "udot", "odot", "caltrans", "modot", "indot", "wydot"]
INT_TOKENS = ["worldbank", "afdb", "india", "karnataka", "kiribati", "ireland",
              "nzta", "tanzania", "australia", "trinidad", "new zealand"]

CANADIAN_HINTS = ["canada", "canadian", "canada/canadian", "quarantine", "canada/"]
FOREIGN_BODY_TOKENS = ["piarc", "tac", "nrc", "statcan", "nrcan"]

METH_TOKENS = ["guideline", "guidelines", "guide", "manual", "methodology",
               "toolkit", "policy", "piarc", "atip", "handbook", "framework",
               "template", "circular", "procedure", "procedures", "terms", "rfp",
               "memorandum"]
METH_PHRASES = ["terms of use", "request for proposal", "request for proposals",
                "audit guidelines", "rsa guidelines", "road safety guidelines",
                "safety audit guidance", "safety audit manual", "road safety plan",
                "safety plan", "best practice", "user guide", "guidelines with case studies"]
RSA_TOKENS = ["rsa"]
RSA_PHRASES = ["road safety audit", "road safety review", "road safety study",
               "traffic safety audit", "safety audit", "safety review", "safety study",
               "safety assessment", "rsa"]
RSA_SQUASH = ["rsareport", "rsareview", "rsastudy", "rsaplan", "safetyaudit",
              "safetyreview", "safetystudy", "roadsaferyaudit", "roadsafetyreview",
              "roadsafetystudy", "roadsafetyassessment"]

STAGE_RULES = [
    ("pre-opening", ["pre-opening", "pre opening", "preopening", "pre opening",
                     "commissioning", "before opening"]),
    ("existing", ["existing", "in-service", "in service", "post-construction",
                  "post construction"]),
    ("detailed", ["detailed", "final design", "design stage", "stage 2", "stage 3",
                  "stage2", "stage3", "construction drawing", "detailed design"]),
    ("preliminary", ["preliminary", "prelim", "prelim design", "preliminary design",
                     "conceptual"]),
    ("planning", ["planning", "feasibility", "concept", "scoping", "strategic",
                  "screening"]),
]
# text cues are deliberately specific - a bare "existing" in prose is not a stage.
STAGE_TEXT_PATTERNS = [
    ("pre-opening", r"pre[- ]opening (stage|road safety)"),
    ("existing", r"(existing|in[- ]service) (road safety|highway|facilities|road)"),
    ("existing", r"post[- ]construction (evaluation|review)"),
    ("detailed", r"detailed design( stage)?"),
    ("preliminary", r"preliminary (design|stage|review)"),
    ("planning", r"(planning|feasibility|concept) (stage|phase)"),
]

# ------------------------------------------------------------ deep (M5b) ----
# Literal reading of HARVESTING_PLAN.md section 1 applied to FULL document text.
#   T3 = crash data AND traffic volumes AND design geometry (drawings/photos)
#        AND outputs (risk-ranked issues + specific recommendations)
#   T4 = T3 plus outcome;  T1 = outputs only;  T0 = neither side.
CANONICAL_JURIS = set(PROV_ORDER) | set(["CAN-GOV"])
DEEP_CLASSES = ("rsa-sample", "unusable", "methodology")
DEEP_INPUTS = [
    ("crash", ["crash", "collision", "accident", "collision history"]),
    ("vol", ["aadt", "traffic volume", "vehicles per day", "traffic count"]),
    ("geom", ["geometry", "drawing", "plan view", "cross-section", "cross section",
              "photo", "field photo", "site photo"]),
]
DEEP_OUT_ISSUES = ["finding", "risk rating", "risk score", "prioritis"]
DEEP_OUT_RECS = ["recommendation", "mitigation", "countermeasure"]
DEEP_OUTCOME = ["client response", "before and after", "before-after", "what was done",
                "post-implementation", "post implementation", "was implemented",
                "were implemented", "has been implemented", "have been implemented",
                "implementation of the recommendations", "implementation status",
                "measures implemented", "actions implemented"]
DEEP_RSA_SIGNALS = ["road safety audit", "road safety review", "road safety study",
                    "traffic safety audit", "safety audit", "safety review",
                    "safety study", "safety assessment"]
DEEP_STAGE_PATTERNS = [
    ("pre-opening", [r"pre[- ]opening"]),
    ("detailed", [r"detailed design", r"stage 3", r"stage three", r"final design"]),
    ("preliminary", [r"preliminary design", r"preliminary stage", r"preliminary review"]),
    ("planning", [r"planning stage", r"planning phase", r"concept stage",
                  r"feasibility stage"]),
    ("existing", [r"existing highway", r"existing road", r"existing facility",
                  r"existing corridor", r"existing street", r"in[- ]service",
                  r"post[- ]construction"]),
]
DEEP_TEXT_MAX = 4000000
DEEP_TIMEOUT = 60

KW = {
    "crash": ["crash", "collision", "accident"],
    "volume": ["traffic volume", "aadt", "vehicles per day", "traffic count",
               "volume count", "hourly volume"],
    "geometry": ["drawing", "geometry", "design drawing", "plan view",
                 "cross section", "cross-section", "field photo", "photograph"],
    "outputs": ["recommendation", "risk rating", "hazard rating", "priorit",
                "finding", "issues identified", "risk-ranked", "risk ranked",
                "identified risks"],
    "outcome": ["before and after", "before-after", "post-implementation",
                "client response", "lessons learned", "implemented",
                "monitoring report", "follow-up"],
    "rsa": ["road safety audit", "safety review", "safety audit", "safety study",
            "road safety study", "rsa"],
    "meth": ["guideline", "methodology", "framework", "policy", "manual",
             "toolkit"],
    "fr": ["sécurité", "routière", "sécurité routière", "québec", "gouvernement",
           "rapport d'audit", "recommandations", "voirie", "avis de projet"],
    "en": ["road safety audit", "the ", "highway", "recommendation", "traffic"],
}


# ------------------------------------------------------------------ helpers --
def find_pdftotext():
    for cand in ("/opt/homebrew/bin/pdftotext", "/usr/local/bin/pdftotext"):
        if os.path.exists(cand):
            return cand
    for d in os.environ.get("PATH", "").split(os.pathsep):
        p = os.path.join(d, "pdftotext")
        if os.path.exists(p):
            return p
    return None


PDFTOTEXT = find_pdftotext()


def iter_docs(root):
    """Deterministic walk; skips .git and node_modules."""
    out = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = sorted(d for d in dirnames if d not in SKIP_DIRS)
        for fn in sorted(filenames):
            if fn.lower().endswith(DOC_EXTS):
                out.append(os.path.join(dirpath, fn))
    out.sort()
    return out


def digest(path):
    """sha256 + size, streamed (never loads the whole file)."""
    h = hashlib.sha256()
    n = 0
    with open(path, "rb") as fh:
        while True:
            chunk = fh.read(1 << 20)
            if not chunk:
                break
            h.update(chunk)
            n += len(chunk)
    return h.hexdigest(), n


def pdf_text(path):
    if not PDFTOTEXT:
        return ""
    try:
        proc = subprocess.run(
            [PDFTOTEXT, "-f", "1", "-l", "4", path, "-"],
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=PDF_TIMEOUT)
    except Exception:
        return ""
    if proc.returncode != 0:
        return ""
    return proc.stdout.decode("utf-8", "replace")[:TEXT_LIMIT]


def zip_text(path, ext):
    """Best-effort text from OOXML containers (stdlib zipfile only)."""
    try:
        with zipfile.ZipFile(path) as zf:
            names = zf.namelist()
            wanted = []
            if ext == ".docx":
                wanted = [n for n in names if n.startswith("word/") and n.endswith(".xml")
                          and ("document" in n or "header" in n or "footer" in n)]
            else:
                wanted = [n for n in names if "sharedStrings" in n or
                          ("worksheets/sheet" in n and n.endswith(".xml"))]
            buf = []
            for n in sorted(wanted)[:6]:
                try:
                    raw = zf.read(n).decode("utf-8", "replace")
                except Exception:
                    continue
                buf.append(re.sub(r"<[^>]+>", " ", raw))
            return re.sub(r"\s+", " ", " ".join(buf))[:TEXT_LIMIT]
    except Exception:
        return ""


def extract_text(path, ext):
    if ext == ".pdf":
        return pdf_text(path)
    if ext in (".docx", ".xlsx"):
        return zip_text(path, ext)
    return ""


def tokens_of(name):
    s = unquote_plus(os.path.splitext(name)[0])
    return [t for t in re.split(r"[^0-9a-z]+", s.lower()) if t]


def flat(name):
    """Lowercased decoded name with separators collapsed to single spaces."""
    return re.sub(r"\s+", " ", unquote_plus(os.path.splitext(name)[0]).lower())


def norm_words(name):
    """Lowercased decoded name with every non-alphanumeric run turned into a space."""
    s = unquote_plus(os.path.splitext(name)[0]).lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def squash(name):
    """Lowercased decoded name with every separator removed."""
    s = unquote_plus(os.path.splitext(name)[0]).lower()
    return re.sub(r"[^a-z0-9]+", "", s)


def title_from(name):
    s = unquote_plus(os.path.splitext(name)[0])
    s = re.sub(r"[_\.]+", " ", s)
    s = re.sub(r"[^0-9A-Za-z\-&()/,' ]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip(" -_")
    return s if s else os.path.splitext(name)[0]


def source_group(rel):
    parts = rel.split("/")
    if len(parts) >= 3 and parts[0] == "docs" and parts[1] == "RSA-Documents":
        return "/".join(parts[:3])
    return "/".join(parts[:2]) if len(parts) >= 2 else parts[0]


def corpus_rel(rel):
    """Path relative to the corpus root (docs/RSA-Documents) or None if outside."""
    if rel == CORPUS_PREFIX:
        return None
    if rel.startswith(CORPUS_PREFIX + "/"):
        return rel[len(CORPUS_PREFIX) + 1:]
    return None


def has_any(text, needles):
    return [n for n in needles if n in text]


def detect_jurisdiction(rel, name, text):
    """-> (jurisdiction, basis, canadian_bool)"""
    toks = set(tokens_of(name))
    norm = norm_words(name)
    low = rel.lower()

    usa_sig = has_any(norm, USA_TOKENS)
    int_sig = has_any(norm, INT_TOKENS)

    # country from path segment (strongest signal for the fixed corpus layout)
    path_country = None
    if re.search(r"(^|/)usa(/|$)", low):
        path_country = "USA"
    elif re.search(r"(^|/)us(/|$)", low):
        path_country = "USA"
    elif re.search(r"(^|/)intl(/|$)", low):
        path_country = "INT"
    elif re.search(r"(^|/)int(/|$)", low):
        path_country = "INT"
    elif re.search(r"(^|/)ae(/|$)", low):
        path_country = "INT"

    canadian = False
    if path_country is None:
        if usa_sig:
            canadian = False
        elif re.search(r"(^|/)(canada|canadian)(/|$)", low) or "quarantine" in low:
            canadian = True
        elif re.search(r"(^|/)ca(/|$)", low):
            canadian = True
        else:
            canadian = False

    # province from filename
    if path_country is None:
        for prov in PROV_ORDER:
            for ph in PROV_PHRASES[prov]:
                if ph in norm:
                    return prov, "filename:" + ph, canadian
        for prov in PROV_ORDER:
            for tk in PROV_TOKENS[prov]:
                if tk in toks:
                    return prov, "filename:" + tk, canadian

    if path_country:
        return path_country, "path:" + path_country.lower(), False
    if not canadian:
        if usa_sig:
            return "USA", "filename:us-agency", False
        if int_sig:
            return "INT", "filename:intl", False
        return "INT", "path:non-canadian", False

    # province from text
    counts = Counter()
    tlow = text.lower()
    for prov in PROV_ORDER:
        for ph in PROV_PHRASES[prov]:
            n = tlow.count(ph)
            if n:
                counts[prov] += n
    if counts:
        best, n = counts.most_common(1)[0]
        if len(counts) == 1 or n >= 2:
            return best, "text:province", True
        return "CAN-GOV", "text:ambiguous-province", True
    return "CAN-GOV", "default:canadian-federal", True


def detect_stage(norm, text):
    for stage, cues in STAGE_RULES:
        for cue in cues:
            if cue in norm:
                return stage, "filename:" + cue
    tlow = text.lower()
    for stage, pat in STAGE_TEXT_PATTERNS:
        if re.search(pat, tlow):
            return stage, "text:pattern"
    return "unknown", "none"


def detect_lang(flatn, text):
    tlow = text.lower()
    fr_hit = has_any(flatn, ["francais", "francophone", "français", "french",
                             "montreal", "quebec", "qc-"]) + has_any(tlow, KW["fr"])
    en_hit = has_any(tlow, KW["en"])
    if fr_hit and len(fr_hit) >= 3 and len(fr_hit) > len(en_hit):
        return "fr", "fr-markers=%d" % len(fr_hit)
    if en_hit:
        return "en", "en-markers=%d" % len(en_hit)
    if fr_hit:
        return "fr", "fr-markers=%d" % len(fr_hit)
    return "unk", "no-text"


def detect_tier(text):
    tlow = text.lower()
    crash = has_any(tlow, KW["crash"])
    volume = has_any(tlow, KW["volume"])
    geom = has_any(tlow, KW["geometry"])
    outs = has_any(tlow, KW["outputs"])
    outcome = has_any(tlow, KW["outcome"])
    inputs = bool(crash) and bool(volume) and bool(geom)
    if outs and inputs and outcome:
        return "T4", "in+out+outcome"
    if outs and inputs:
        return "T3", "in+out"
    if outs:
        return "T1", "out-only"
    return "T0", "no-outputs"


def detect_class(rel, norm, squashed, toks, text, jur, canadian):
    pathlow = rel.lower()
    path_toks = set(re.split(r"[^a-z0-9]+", pathlow))
    federal = bool(path_toks & set(FOREIGN_BODY_TOKENS)) or bool(toks & set(FOREIGN_BODY_TOKENS))
    meth_tok = [t for t in METH_TOKENS if t in toks]
    meth_ph = has_any(norm, METH_PHRASES)
    meth = bool(meth_tok or meth_ph)
    rsa_tok = [t for t in RSA_TOKENS if t in toks]
    rsa_ph = has_any(norm, RSA_PHRASES)
    rsa_sq = has_any(squashed, RSA_SQUASH)
    rsa = bool(rsa_tok or rsa_ph or rsa_sq)

    if meth and (canadian or federal):
        return "methodology", ("meth:" + ",".join((meth_tok + meth_ph)[:4]))
    if not canadian and not federal:
        return "out-of-scope", "jurisdiction=%s" % jur
    if meth:
        return "methodology", ("meth:" + ",".join((meth_tok + meth_ph)[:4]))
    if "methodology" in pathlow:
        return "methodology", "path:methodology-dir"
    if rsa:
        return "rsa-sample", ("rsa:" + ",".join((rsa_tok + rsa_ph + rsa_sq)[:4]))
    return "unusable", "no-rsa-signal"


def deep_pdf_text(path, args, timeout):
    """pdftotext with a hard timeout.

    -> (text, timed_out). Partial output of a timed-out run is DISCARDED: it
    depends on machine load and would make the labels non-deterministic.
    """
    cmd = [PDFTOTEXT] + list(args) + [path, "-"]
    try:
        proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                              timeout=timeout)
        return proc.stdout.decode("utf-8", "replace"), False
    except subprocess.TimeoutExpired:
        return "", True
    except Exception:
        return "", True


def deep_text(path, ext):
    """Full document text (60 s timeout); fallback to the first 12 pages.

    -> (text, ok). ok is False when neither attempt yields any text (e.g. an
    image-only PDF with no text layer): the caller then keeps the existing label.
    """
    if ext != ".pdf" or not PDFTOTEXT:
        return "", False
    text, timed_out = deep_pdf_text(path, [], DEEP_TIMEOUT)
    if not timed_out and text.strip():
        return text[:DEEP_TEXT_MAX], True
    text, timed_out = deep_pdf_text(path, ["-f", "1", "-l", "12"], DEEP_TIMEOUT)
    if not timed_out and text.strip():
        return text[:DEEP_TEXT_MAX], True
    return "", False


def deep_tier(text):
    """Plan section 1 applied literally. -> (tier, groups, issues, recs, outcome)"""
    tlow = text.lower()
    groups = []
    for name, cues in DEEP_INPUTS:
        groups.append((name, [c for c in cues if c in tlow]))
    inputs = all(hits for _, hits in groups)
    issues = [c for c in DEEP_OUT_ISSUES if c in tlow]
    recs = [c for c in DEEP_OUT_RECS if c in tlow]
    outputs = bool(issues) and bool(recs)
    any_out = bool(issues) or bool(recs)
    outcome = [c for c in DEEP_OUTCOME if c in tlow]
    if inputs and outputs and outcome:
        tier = "T4"
    elif inputs and outputs:
        tier = "T3"
    elif any_out:
        tier = "T1"
    else:
        tier = "T0"
    return tier, groups, issues, recs, outcome


def deep_stage(text):
    """Stage from explicit wording in the full text. -> (stage, basis) or (None, None)"""
    tlow = text.lower()
    best = None
    best_n = 0
    best_pat = None
    for stage, pats in DEEP_STAGE_PATTERNS:
        for pat in pats:
            n = len(re.findall(pat, tlow))
            if n > best_n:
                best, best_n, best_pat = stage, n, pat
    if best:
        return best, "text:" + best_pat.replace("\\", "").replace("[", "").replace("]", "")
    return None, None


def deep_rsa_signals(text):
    tlow = text.lower()
    hits = [s for s in DEEP_RSA_SIGNALS if s in tlow]
    if re.search(r"\brsa\b", tlow):
        hits.append("rsa")
    return hits


def build_evidence(fn_tokens, text_kw, jur_basis, stage_basis, tier_basis, extra):
    bits = []
    if fn_tokens:
        bits.append("fn:" + ",".join(fn_tokens[:6]))
    if text_kw:
        bits.append("txt:" + ",".join(text_kw[:6]))
    if jur_basis:
        bits.append("jur:" + jur_basis)
    if stage_basis and stage_basis != "none":
        bits.append("stage:" + stage_basis)
    if tier_basis:
        bits.append("tier:" + tier_basis)
    if extra:
        bits.append(extra)
    s = " | ".join(bits)
    return s[:MAX_EVIDENCE]


# -------------------------------------------------------------------- main ----
def collect(root, deep=False):
    rows = []
    seen_sha = {}
    for abspath in iter_docs(root):
        rel = os.path.relpath(abspath, root)
        name = os.path.basename(abspath)
        ext = os.path.splitext(name)[1].lower()
        sha, size = digest(abspath)
        text = extract_text(abspath, ext)
        norm = norm_words(name)
        squashed = squash(name)
        toks = tokens_of(name)
        pathlow = rel.lower()
        jur, jur_basis, canadian = detect_jurisdiction(rel, name, text)
        stage, stage_basis = detect_stage(norm, text)
        lang, lang_basis = detect_lang(norm, text)
        cls, cls_basis = detect_class(rel, norm, squashed, set(toks), text, jur, canadian)
        tier, tier_basis = detect_tier(text)
        if cls != "rsa-sample":
            tier = "T0"
        tier_shallow, stage_shallow, class_shallow = tier, stage, cls
        fn_tokens = [t for t in toks if t in set(METH_TOKENS) | set(RSA_TOKENS)][:6]
        text_kw = [k for k, v in KW.items() if k not in ("en", "fr") and has_any(text.lower(), v)]
        extra = []
        if "quarantine" in pathlow:
            extra.append("quarantine")
        if "not-audit" in pathlow:
            extra.append("path:not-audit-dir")
        if cls_basis.startswith("path:"):
            extra.append(cls_basis)
        evidence = build_evidence(fn_tokens, text_kw, jur_basis, stage_basis, tier_basis,
                                  ",".join(extra))
        deep_state = ""
        deep_sig = {}
        is_dup = sha in seen_sha
        if not is_dup:
            seen_sha[sha] = rel
        # ---- M5b: deep re-labelling of the Canadian in-scope subset ----------
        if deep and not is_dup and jur in CANONICAL_JURIS and cls in DEEP_CLASSES \
                and ext == ".pdf":
            full_text, ok = deep_text(abspath, ext)
            if ok:
                deep_state = "deep"
                dtier, groups, issues, recs, outcome = deep_tier(full_text)
                dstage, dstage_basis = deep_stage(full_text)
                rsa_hits = deep_rsa_signals(full_text)
                if cls == "unusable" and rsa_hits:
                    cls = "rsa-sample"
                    cls_basis = "deep:" + ",".join(rsa_hits[:3])
                if cls == "rsa-sample":
                    tier = dtier
                else:
                    tier = "T0"
                if dstage:
                    stage, stage_basis = dstage, dstage_basis
                in_hits = ",".join(name for name, hits in groups if hits)
                out_hits = ",".join(issues + recs)
                deep_sig = {"in": in_hits, "out": out_hits,
                            "outcome": ",".join(outcome[:2]), "rsa": ",".join(rsa_hits[:3])}
                bits = ["in:" + (in_hits or "none"), "out:" + (out_hits or "none")]
                if outcome:
                    bits.append("outc:" + ",".join(outcome[:2]))
                if rsa_hits:
                    bits.append("rs:" + ",".join(rsa_hits[:2]))
                if stage_basis and stage_basis != "none":
                    bits.append("stage:" + stage_basis)
                if jur_basis:
                    bits.append("jur:" + jur_basis)
                if fn_tokens:
                    bits.append("fn:" + ",".join(fn_tokens[:4]))
                if "path:not-audit-dir" in extra:
                    bits.append("path:not-audit-dir")
                evidence = " | ".join(bits)[:MAX_EVIDENCE]
            else:
                deep_state = "deep-failed"
                evidence = (evidence + " | deep:no-text")[:MAX_EVIDENCE]
        rows.append({
            "path": rel,
            "abs_path": abspath,
            "sha256": sha,
            "bytes": size,
            "ext": ext,
            "title": title_from(name),
            "jurisdiction": jur,
            "stage": stage,
            "tier": tier,
            "lang": lang,
            "class": cls,
            "label_confidence": "rule",
            "evidence": evidence,
            "dup_of": None,
            "source_group": source_group(rel),
            "_deep": deep_state,
            "_tier_shallow": tier_shallow,
            "_stage_shallow": stage_shallow,
            "_class_shallow": class_shallow,
        })
    return rows


def finalize(rows):
    """Apply anchors + duplicate resolution (first occurrence wins)."""
    by_sha = {}
    for r in rows:
        sha = r["sha256"]
        if sha in by_sha:
            r["dup_of"] = by_sha[sha]
        else:
            by_sha[sha] = r["path"]

    for r in rows:
        name = os.path.basename(r["path"])
        anchor = ANCHORS.get(name)
        if anchor:
            r["class"] = anchor["class"]
            r["tier"] = anchor["tier"]
            r["stage"] = anchor["stage"]
            r["jurisdiction"] = anchor["jurisdiction"]
            r["label_confidence"] = "anchor"
            r["evidence"] = ("anchor:HARVESTING_PLAN.md#s1 | " +
                              r["evidence"])[:MAX_EVIDENCE]
        elif r["dup_of"]:
            # duplicate content: keep tier of the canonical row, class = duplicate
            r["class"] = "duplicate"
        if r["label_confidence"] != "anchor":
            if r.get("_deep") == "deep":
                weak = (r["tier"] == "T0") or (r["stage"] == "unknown") or \
                       (r["class"] == "unusable")
            elif r.get("_deep") == "deep-failed":
                weak = True
            else:
                has_fn = r["evidence"].split(" | ")[0].startswith("fn:")
                weak = (not has_fn) or \
                       (r["stage"] == "unknown" and r["class"] == "rsa-sample") or \
                       (r["class"] == "rsa-sample" and r["tier"] == "T0") or \
                       (r["class"] == "unusable") or \
                       ("path:not-audit-dir" in r["evidence"])
            r["label_confidence"] = "needs_review" if weak else "rule"

    # a duplicate row is byte-identical to its canonical row: same content tier.
    # Only Canadian in-scope duplicates inherit the deep tier; non-Canadian rows
    # (USA/INT/sys) keep their labels untouched.
    by_path = dict((r["path"], r) for r in rows)
    for r in rows:
        if not r["dup_of"] or r["dup_of"] not in by_path:
            continue
        if os.path.basename(r["path"]) in ANCHORS:
            continue
        if r["jurisdiction"] not in CANONICAL_JURIS:
            continue
        canon = by_path[r["dup_of"]]
        if canon.get("_deep") == "deep":
            r["tier"] = canon["tier"]
    return rows


def summarize(rows, deep=False):
    counts = {}
    for field in ("class", "tier", "stage", "jurisdiction", "lang", "source_group"):
        c = Counter(r[field] for r in rows)
        counts[field] = OrderedSorted(c)
    summary = {
        "totals": {
            "documents": len(rows),
            "bytes": sum(r["bytes"] for r in rows),
            "unique_sha256": len(set(r["sha256"] for r in rows)),
            "duplicates": sum(1 for r in rows if r["dup_of"]),
            "anchors": sum(1 for r in rows if r["label_confidence"] == "anchor"),
            "needs_review": sum(1 for r in rows if r["label_confidence"] == "needs_review"),
        },
        "counts": counts,
    }
    subset = [r for r in rows if r["jurisdiction"] in CANONICAL_JURIS]
    selected = [r for r in subset if r["class"] in DEEP_CLASSES]
    processed = [r for r in selected if r.get("_deep") == "deep"]
    failed = [r for r in selected if r.get("_deep") == "deep-failed"]
    block = {
        "enabled": bool(deep),
        "canadian_in_scope_documents": len(subset),
        "selected": len(selected),
        "processed": len(processed),
        "text_failed": len(failed),
        "tier_changed": sum(1 for r in selected if r["tier"] != r["_tier_shallow"]),
        "stage_changed": sum(1 for r in selected if r["stage"] != r["_stage_shallow"]),
        "class_changed": sum(1 for r in selected if r["class"] != r["_class_shallow"]),
        "canadian_in_scope_counts": {
            "class": OrderedSorted(Counter(r["class"] for r in subset)),
            "tier": OrderedSorted(Counter(r["tier"] for r in subset)),
            "stage": OrderedSorted(Counter(r["stage"] for r in subset)),
        },
        "counts": {
            "class": OrderedSorted(Counter(r["class"] for r in selected)),
            "tier": OrderedSorted(Counter(r["tier"] for r in selected)),
            "stage": OrderedSorted(Counter(r["stage"] for r in selected)),
            "jurisdiction": OrderedSorted(Counter(r["jurisdiction"] for r in selected)),
            "label_confidence": OrderedSorted(Counter(r["label_confidence"] for r in selected)),
        },
    }
    summary["deep_subset"] = block
    return summary


def OrderedSorted(counter):
    """Deterministic dict: sorted by key."""
    out = {}
    for k in sorted(counter.keys()):
        out[str(k)] = counter[k]
    return out


# ----------------------------------------------------------- reconciliation --
def load_json(path, default):
    try:
        with open(path, "r") as fh:
            return json.load(fh)
    except Exception:
        return default


def reconcile(rows, out_dir, root, deep=False):
    inv_raw = load_json(os.path.join(out_dir, "corpus-inventory.json"), {})
    cat_raw = load_json(os.path.join(out_dir, "corpus-catalog.json"), {})
    idx_raw = load_json(os.path.join(out_dir, "dedupe-index.json"), [])
    inv_files = inv_raw.get("files", []) if isinstance(inv_raw, dict) else []
    cat_recs = cat_raw.get("records", []) if isinstance(cat_raw, dict) else []
    idx_rows = idx_raw if isinstance(idx_raw, list) else []

    inv_paths = set(e.get("path") for e in inv_files)
    cat_paths = set(r.get("path") for r in cat_recs)
    idx_paths = set(r.get("path") for r in idx_rows)
    cat_by_path = dict((r.get("path"), r) for r in cat_recs)
    idx_by_path = dict((r.get("path"), r) for r in idx_rows)
    idx_sha_paths = {}
    for r in idx_rows:
        idx_sha_paths.setdefault(r.get("sha256"), []).append(r.get("path"))

    disk_corpus = set(p for p in (r["corpus_rel"] for r in rows) if p)

    # --- drift 1: on disk but uncatalogued -------------------------------
    outside = []
    in_corpus_missing = []
    for r in rows:
        crel = r["corpus_rel"]
        if crel is None:
            outside.append(r)
        elif crel not in cat_paths:
            in_corpus_missing.append(r)

    outside_groups = OrderedSorted(Counter(r["source_group"] for r in outside))

    # --- drift 2: catalogued but missing on disk -------------------------
    cat_missing = []
    for r in cat_recs:
        p = r.get("path") or ""
        if p.lower().endswith(DOC_EXTS):
            if p not in disk_corpus:
                cat_missing.append(p)
    cat_missing_nondoc = [r.get("path") for r in cat_recs
                          if not (r.get("path") or "").lower().endswith(DOC_EXTS)
                          and r.get("path") not in disk_corpus]

    # --- drift 3: sha256 mismatch ---------------------------------------
    sha_mismatch = []
    for r in rows:
        crel = r["corpus_rel"]
        if crel is None:
            continue
        for label, table in (("catalog", cat_by_path), ("dedupe-index", idx_by_path)):
            rec = table.get(crel)
            if rec and rec.get("sha256") and rec["sha256"] != r["sha256"]:
                sha_mismatch.append({"path": r["path"], "source": label,
                                     "expected": rec["sha256"], "actual": r["sha256"]})
    # catalog/inventory rows whose bytes disagree with the recorded metadata
    meta_byte_mismatch = []
    for r in cat_recs:
        p = r.get("path") or ""
        if p in disk_corpus:
            row = next(x for x in rows if x["corpus_rel"] == p)
            if r.get("bytes") is not None and r["bytes"] != row["bytes"]:
                meta_byte_mismatch.append({"path": p, "source": "catalog",
                                           "expected": r["bytes"], "actual": row["bytes"]})

    # --- drift 4: mirrors (on-disk sha claimed by dedupe-index elsewhere) -
    mirrors = []
    for r in rows:
        crel = r["corpus_rel"]
        for p in idx_sha_paths.get(r["sha256"], []):
            if p != crel:
                mirrors.append({"path": r["path"], "sha256": r["sha256"],
                                "claimed_by": p, "own_index_path": crel})

    # --- coverage against each metadata source ---------------------------
    cov = {}
    corpus_rows = [r for r in rows if r["corpus_rel"]]
    for name, table in (("corpus-inventory.json", inv_paths),
                        ("corpus-catalog.json", cat_paths),
                        ("dedupe-index.json", idx_paths)):
        present = sum(1 for r in corpus_rows if r["corpus_rel"] in table)
        cov[name] = {"rows": len(table), "on_disk_corpus_docs": len(corpus_rows),
                     "present": present, "missing": len(corpus_rows) - present}

    # --- download log ----------------------------------------------------
    log_path = os.path.join(out_dir, "canadian-download-log.tsv")
    log_rows = []
    log_missing = []
    log_sha_on_disk = []
    if os.path.exists(log_path):
        with open(log_path, "r") as fh:
            header = fh.readline().rstrip("\n").split("\t")
            for line in fh:
                line = line.rstrip("\n")
                if not line.strip():
                    continue
                parts = line.split("\t")
                rec = dict(zip(header, parts))
                log_rows.append(rec)
        disk_sha_paths = {}
        for r in rows:
            disk_sha_paths.setdefault(r["sha256"], []).append(r["path"])
        for rec in log_rows:
            lp = rec.get("local_path", "")
            present = os.path.exists(os.path.join(root, lp)) if lp else False
            hits = disk_sha_paths.get(rec.get("sha256"), [])
            log_missing.append({"project_id": rec.get("project_id"), "local_path": lp,
                                "present_at_logged_path": present,
                                "sha256_on_disk_paths": hits})
            if hits:
                log_sha_on_disk.append(rec.get("project_id"))

    drift_counts = OrderedSorted({
        "on_disk_outside_corpus_root": len(outside),
        "on_disk_in_corpus_root_missing_from_catalog": len(in_corpus_missing),
        "catalogued_docs_missing_on_disk": len(cat_missing),
        "catalogued_nondoc_entries_missing_on_disk": len(cat_missing_nondoc),
        "sha256_mismatch_catalog_vs_disk": sum(1 for m in sha_mismatch
                                               if m["source"] == "catalog"),
        "sha256_mismatch_dedupeindex_vs_disk": sum(1 for m in sha_mismatch
                                                   if m["source"] == "dedupe-index"),
        "bytes_mismatch_catalog_vs_disk": len(meta_byte_mismatch),
        "mirrors_sha_claimed_by_dedupe_index": len(mirrors),
        "download_log_rows": len(log_rows),
        "download_log_rows_absent_at_logged_path": sum(
            1 for m in log_missing if not m["present_at_logged_path"]),
        "download_log_rows_whose_sha256_exists_on_disk": len(log_sha_on_disk),
    })

    md = []
    A = md.append
    A("# Track A - on-disk corpus reconciliation (M5)")
    A("")
    A("Generated by `docs/RSA-Documents/scripts/build-ondisk-inventory.py`. Do not hand-edit.")
    A("")
    A("- Checkout root scanned (read-only): `%s`" % root)
    A("- Documents inventoried: **%d**" % len(rows))
    A("- Corpus metadata compared: `corpus-inventory.json`, `corpus-catalog.json`, "
      "`dedupe-index.json`, `canadian-download-log.tsv`")
    A("- Deep labelling: %s" % ("ON - tier/stage re-derived from FULL document text for the "
                                "Canadian in-scope subset" if deep else
                                "OFF - labels derived from the first 4 pages only"))
    A("")
    A("## Label counts")
    A("")
    for field in ("class", "tier", "stage", "jurisdiction", "lang", "label_confidence"):
        c = Counter(r[field] for r in rows)
        A("**%s**" % field)
        A("")
        A("| value | documents |")
        A("| --- | ---: |")
        for k in sorted(c.keys()):
            A("| %s | %d |" % (k, c[k]))
        A("")
    A("## Drift counts")
    A("")
    A("| drift type | count |")
    A("| --- | ---: |")
    for k in sorted(drift_counts.keys()):
        A("| %s | %d |" % (k, drift_counts[k]))
    A("")
    A("## Coverage of on-disk corpus documents per metadata source")
    A("")
    A("| source | source rows | on-disk corpus docs | present | missing |")
    A("| --- | ---: | ---: | ---: | ---: |")
    for name in sorted(cov.keys()):
        c = cov[name]
        A("| %s | %d | %d | %d | %d |" % (name, c["rows"], c["on_disk_corpus_docs"],
                                          c["present"], c["missing"]))
    A("")
    A("## D1 - on disk, outside the corpus root (`docs/RSA-Documents/`)")
    A("")
    A("| group | documents |")
    A("| --- | ---: |")
    for k in sorted(outside_groups.keys()):
        A("| %s | %d |" % (k, outside_groups[k]))
    A("")
    for g in sorted(outside_groups.keys()):
        A("<details><summary>%s (%d)</summary>" % (g, outside_groups[g]))
        A("")
        for r in rows:
            if r["source_group"] == g:
                A("- `%s`" % r["path"])
        A("")
        A("</details>")
        A("")
    A("## D2 - on disk inside the corpus root but absent from `corpus-catalog.json`")
    A("")
    if in_corpus_missing:
        for r in in_corpus_missing:
            A("- `%s`" % r["path"])
    else:
        A("None - every on-disk corpus document is catalogued.")
    A("")
    A("## D3 - catalogued documents missing on disk")
    A("")
    if cat_missing:
        for p in sorted(cat_missing):
            A("- `%s`" % p)
    else:
        A("None - every catalogued document exists on disk.")
    A("")
    A("Non-document catalog entries (`.md`, `.csv`, `.html`, ...) not on disk: **%d** "
      "(metadata/reference files, not harvested documents)." % len(cat_missing_nondoc))
    A("")
    A("## D4 - sha256 / bytes mismatch vs recorded metadata")
    A("")
    if sha_mismatch:
        A("| path | source | expected sha256 | actual sha256 |")
        A("| --- | --- | --- | --- |")
        for m in sha_mismatch:
            A("| `%s` | %s | `%s` | `%s` |" % (m["path"], m["source"], m["expected"],
                                               m["actual"]))
    else:
        A("None - every on-disk corpus document hashes to its recorded sha256.")
    A("")
    if meta_byte_mismatch:
        A("| path | source | expected bytes | actual bytes |")
        A("| --- | --- | ---: | ---: |")
        for m in meta_byte_mismatch:
            A("| `%s` | %s | %d | %d |" % (m["path"], m["source"], m["expected"],
                                           m["actual"]))
        A("")
    A("## D5 - mirrors (on-disk sha256 already claimed by `dedupe-index.json` under "
      "another path)")
    A("")
    if mirrors:
        A("| on-disk path | sha256 | claimed by index path |")
        A("| --- | --- | --- |")
        for m in mirrors:
            A("| `%s` | `%s` | `%s` |" % (m["path"], m["sha256"][:16], m["claimed_by"]))
    else:
        A("None - no on-disk document shares a sha256 with a differently-pathed index row.")
    A("")
    A("## D6 - `canadian-download-log.tsv` rows")
    A("")
    A("The log lives in this repository (worktree), not in the operator checkout: "
      "`docs/RSA-Documents/canadian-download-log.tsv`. Its `local_path` values point at "
      "`docs/RSA-Documents/canada/track-a/...` paths that do not exist in the checkout.")
    A("")
    if log_missing:
        A("| project_id | logged local_path | present at logged path | sha256 found on disk |")
        A("| --- | --- | --- | --- |")
        for m in log_missing:
            hits = ", ".join("`%s`" % h for h in m["sha256_on_disk_paths"]) or "no"
            A("| %s | `%s` | %s | %s |" % (m["project_id"], m["local_path"],
                                          "yes" if m["present_at_logged_path"] else "no", hits))
    else:
        A("No download-log rows found.")
    A("")
    A("Note: the log's `stage` vocabulary (`FEASIBILITY_CONCEPT`, `UNSTAGED`) does not match "
      "the plan section 3 stage ladder used by this inventory.")
    A("")
    return "\n".join(md) + "\n", drift_counts


# ------------------------------------------------------------------- output --
def write_outputs(rows, summary, out_dir, root, deep=False):
    inv_path = os.path.join(out_dir, "track-a-ondisk-inventory.jsonl")
    with open(inv_path, "w") as fh:
        for r in rows:
            row = dict((k, v) for k, v in r.items()
                       if not k.startswith("_") and k != "corpus_rel")
            fh.write(json.dumps(row, sort_keys=False, ensure_ascii=False) + "\n")
    sum_path = os.path.join(out_dir, "track-a-ondisk-summary.json")
    with open(sum_path, "w") as fh:
        json.dump(summary, fh, indent=2, sort_keys=False, ensure_ascii=False)
        fh.write("\n")
    rec_path = os.path.join(out_dir, "track-a-reconciliation.md")
    md, drift_counts = reconcile(rows, out_dir, root, deep)
    with open(rec_path, "w") as fh:
        fh.write(md)
    return inv_path, sum_path, rec_path, drift_counts


def self_check(rows, summary):
    problems = []
    if len(rows) != summary["totals"]["documents"]:
        problems.append("row count %d != summary documents %d"
                        % (len(rows), summary["totals"]["documents"]))
    for r in rows:
        if not r["sha256"] or len(r["sha256"]) != 64:
            problems.append("bad sha256: %s" % r["path"])
        if r["class"] not in ("rsa-sample", "methodology", "out-of-scope", "duplicate",
                              "unusable"):
            problems.append("bad class: %s" % r["path"])
        if r["tier"] == "T2":
            problems.append("T2 emitted: %s" % r["path"])
        if r["tier"] not in ("T0", "T1", "T3", "T4"):
            problems.append("bad tier: %s" % r["path"])
        if len(r["evidence"]) > MAX_EVIDENCE:
            problems.append("evidence too long: %s" % r["path"])
        if r.get("_deep") == "deep":
            if "in:" not in r["evidence"] or "out:" not in r["evidence"]:
                problems.append("deep row without signal evidence: %s" % r["path"])
            if r["class"] != "rsa-sample" and r["tier"] != "T0":
                problems.append("non-sample with non-T0 tier: %s" % r["path"])
    block = summary.get("deep_subset", {})
    processed = sum(1 for r in rows if r.get("_deep") == "deep")
    if block.get("processed") != processed:
        problems.append("deep_subset.processed %s != %d"
                        % (block.get("processed"), processed))
    if block.get("selected") is not None:
        selected = sum(1 for r in rows if r["jurisdiction"] in CANONICAL_JURIS
                       and r["class"] in DEEP_CLASSES)
        if block["selected"] != selected:
            problems.append("deep_subset.selected %s != %d" % (block["selected"], selected))
    found = dict((os.path.basename(r["path"]), r) for r in rows)
    for name, want in sorted(ANCHORS.items()):
        r = found.get(name)
        if r is None:
            problems.append("anchor missing: %s" % name)
            continue
        if r["class"] != want["class"]:
            problems.append("anchor %s class %s != %s" % (name, r["class"], want["class"]))
        if r["tier"] != want["tier"]:
            problems.append("anchor %s tier %s != %s" % (name, r["tier"], want["tier"]))
        if r["label_confidence"] != "anchor":
            problems.append("anchor %s confidence %s" % (name, r["label_confidence"]))
    return problems


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--root", default=DEFAULT_ROOT,
                    help="checkout root to inventory (read-only)")
    ap.add_argument("--self-check", action="store_true",
                    help="assert invariants and exit non-zero on violation")
    ap.add_argument("--deep", action="store_true",
                    help="re-label the Canadian in-scope subset from FULL document text")
    ap.add_argument("--out-dir", default=OUT_DIR, help="where to write the outputs")
    args = ap.parse_args(argv)

    root = os.path.abspath(args.root)
    if not os.path.isdir(root):
        print("root not found: %s" % root, file=sys.stderr)
        return 2

    rows = collect(root, deep=args.deep)
    for r in rows:
        r["corpus_rel"] = corpus_rel(r["path"])
    rows = finalize(rows)
    summary = summarize(rows, deep=args.deep)

    problems = self_check(rows, summary)
    if problems and args.self_check:
        for p in problems:
            print("SELF-CHECK FAIL: %s" % p, file=sys.stderr)
        return 1

    inv_path, sum_path, rec_path, drift = write_outputs(rows, summary, args.out_dir,
                                                     root, args.deep)

    print("documents: %d  bytes: %d  unique-sha: %d" % (
        summary["totals"]["documents"], summary["totals"]["bytes"],
        summary["totals"]["unique_sha256"]))
    print("class:  %s" % json.dumps(summary["counts"]["class"]))
    print("tier:   %s" % json.dumps(summary["counts"]["tier"]))
    print("stage:  %s" % json.dumps(summary["counts"]["stage"]))
    print("juris:  %s" % json.dumps(summary["counts"]["jurisdiction"]))
    print("lang:   %s" % json.dumps(summary["counts"]["lang"]))
    print("confidence: anchor=%d needs_review=%d" % (
        summary["totals"]["anchors"], summary["totals"]["needs_review"]))
    block = summary["deep_subset"]
    print("deep: enabled=%s canadian_in_scope=%d selected=%d processed=%d failed=%d" % (
        block["enabled"], block["canadian_in_scope_documents"], block["selected"],
        block["processed"], block["text_failed"]))
    print("deep: changed tier=%d stage=%d class=%d" % (
        block["tier_changed"], block["stage_changed"], block["class_changed"]))
    print("deep: subset class %s" % json.dumps(block["counts"]["class"]))
    print("deep: subset tier  %s" % json.dumps(block["counts"]["tier"]))
    print("deep: subset stage %s" % json.dumps(block["counts"]["stage"]))
    print("deep: ca-scope tier %s" % json.dumps(block["canadian_in_scope_counts"]["tier"]))
    print("drift:  %s" % json.dumps(drift))
    print("wrote:  %s" % inv_path)
    print("wrote:  %s" % sum_path)
    print("wrote:  %s" % rec_path)
    if problems:
        for p in problems:
            print("SELF-CHECK FAIL: %s" % p, file=sys.stderr)
        return 1
    if args.self_check:
        print("self-check: OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
