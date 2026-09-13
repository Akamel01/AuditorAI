#!/usr/bin/env bash
set -euo pipefail

# extract-corpus.sh
# Usage: extract-corpus.sh <input-file> <out-dir>
# - Processes PDFs via pdftotext when available and flags NEEDS_OCR if text per page is too low
# - HTML: converts to text via pandoc/lynx/w3m or a simple tag-stripping fallback
# - PPT: flags as MANUAL (no automated extraction here)

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <input-file> <out-dir>" 1>&2
  exit 1
fi

INPUT_FILE="$1"
OUT_DIR="$2"
mkdir -p "$OUT_DIR"

BASE=$(basename "$INPUT_FILE")
NAME="${BASE%.*}"
EXT="${BASE##*.}"

META_FILE="$OUT_DIR/${NAME}.meta.txt"
FLAG_FILE="$OUT_DIR/${NAME}.flag.txt"
TEXT_OUT="$OUT_DIR/${NAME}.txt"

echo "Processing $INPUT_FILE -> $OUT_DIR (name=$NAME, ext=$EXT)" 

case "$EXT" in
  pdf)
    # Try to extract with pdftotext if available (born-digital). Compute per-page text density if possible.
    if command -v pdfinfo >/dev/null 2>&1; then
      PAGES=$(pdfinfo "$INPUT_FILE" 2>/dev/null | awk '/Pages/ {print $2}')
      if [[ -z "$PAGES" ]]; then
        PAGES=0
      fi
    else
      PAGES=0
    fi
    if command -v pdftotext >/dev/null 2>&1; then
      pdftotext "$INPUT_FILE" "$TEXT_OUT" 2>/dev/null || true
      CHARS=$(wc -c < "$TEXT_OUT")
    else
      # Fallback: try to dump text with mutt-like approach or leave empty
      CHARS=0
      echo "NO_PDFFLUX" > "$TEXT_OUT" || true
    fi
    AVG_PER_PAGE=0
    if (( PAGES > 0 )); then
      AVG_PER_PAGE=$((CHARS / PAGES))
    else
      AVG_PER_PAGE=$CHARS
    fi
    FLAG="OK"
    if (( AVG_PER_PAGE < 350 )); then FLAG="NEEDS_OCR"; fi
    echo "pages=$PAGES" > "$META_FILE"
    echo "chars=$CHARS" >> "$META_FILE"
    echo "avg_per_page=$AVG_PER_PAGE" >> "$META_FILE"
    if [[ "$FLAG" != "OK" ]]; then
      echo "$FLAG" > "$FLAG_FILE"
    else
      : > "$FLAG_FILE"  # create empty flag file for idempotence
    fi
    ;;
  html|htm)
    # Try pandoc first, then lynx/w3m, then basic tag-stripping fallback
    if command -v pandoc >/dev/null 2>&1; then
      pandoc "$INPUT_FILE" -t plain > "$TEXT_OUT" 2>/dev/null || true
    elif command -v lynx >/dev/null 2>&1; then
      lynx -dump "$INPUT_FILE" > "$TEXT_OUT" 2>/dev/null || true
    elif command -v w3m >/dev/null 2>&1; then
      w3m -dump "$INPUT_FILE" > "$TEXT_OUT" 2>/dev/null || true
    else
      # naive HTML tag stripping
      sed 's/<[^>]*>//g' "$INPUT_FILE" > "$TEXT_OUT" 2>/dev/null || true
    fi
    CHARS=$(wc -c < "$TEXT_OUT")
    echo "chars=$CHARS" > "$META_FILE"
    echo "flag=OK" > "$FLAG_FILE" || true
    ;;
  ppt|pptx)
    # PPTs are manual to extract; flag accordingly
    echo "MANUAL" > "$FLAG_FILE" || true
    echo "comments=requires manual review" > "$META_FILE" || true
    ;;
  *)
    echo "Unknown extension: $EXT" 1>&2
    echo "chars=0" > "$META_FILE"
    echo "NO_EXT" > "$FLAG_FILE" || true
    ;;
esac

echo "done" 
