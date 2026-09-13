# Extraction matrix for RSA corpus workflow

- Purpose: outline formats, tools, quality samples, and rough cost/time estimates for processing the 886 MB corpus. Includes a French/Quebec usage note.
- Dataset note: full corpus around 886 MB; distributed across PDFs, HTMLs, and some PPTs; translations/locale noted where relevant.

| Tool/Format | Quality sample | Notes on French/Quebec | Estimated cost (per-file rough) | Estimated time (per-file rough) |
|-------------|------------------|--------------------------|---------------------------------|--------------------------------|
| PDF (pdftotext) | Text extracted from born-digital PDFs; NEEDS_OCR flagged if chars/page falls below threshold | FR/FR-Quebec content included in corpus; handled as separate samples if language flag present | Low (CPU-bound) | 0.2–0.8s per page depending on font and encoding |
| HTML (pandoc/lynx) | Plain-text extraction; formatting preserved where possible | French/Quebec content flagged when language hint is fr/ca | Low | 0.05–0.2s per page (typical HTML pages) |
| PPT/PPTX | Manual extraction recommended | French/Quebec content is present in some slide decks but not automatically extractable | Very low (0 if manual; otherwise high for automation) | 1.0–5.0s per slide on average |

Notes:
- For full 886 MB dataset, we expect a multi-hour pipeline on a single modest server; the matrix above is coarse-grained to aid planning.
- The French/Quebec note indicates that language-specific QA may be needed for metadata, translations, or OCR language packs.
