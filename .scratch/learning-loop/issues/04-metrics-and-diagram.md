# 04 — PromotionRate/HallucinationRate metrics + generated diagram numbers

Type: task · Status: open · Blocked by: 01, 02

## Question

Implement ADR-0013 mechanism-first metrics: compute PromotionRate + HallucinationRate
(+ per-cell few-shot coverage) from the outcome log + run artifacts; publish via
readiness-report learning_layer section; regenerate docs/architecture/
learning-architecture.html KPI numbers from generated data (script or documented
manual step reading readiness-report.json). Numeric thresholds deliberately unset.

## Answer

RESOLVED. computeMetrics + learning_layer.metrics + render script; honest nulls pre-data; diagram KPIs generated.

