// GET /api/dev/readiness — state/readiness-report.json + learning metrics from src/lib/learning-metrics.ts
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireAdmin, serverError } from "@/lib/api";
import { computeMetrics, parseOutcomeLog } from "@/lib/learning-metrics";

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;
  try {
    const root = process.cwd();
    let report: unknown = null;
    try {
      const raw = readFileSync(path.join(root, "state", "readiness-report.json"), "utf8");
      report = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "readiness-report.json not found or unreadable" }, { status: 404 });
    }

    // Compute learning metrics from candidate-outcomes logs if present
    const coDir = path.join(root, "state", "candidate-outcomes");
    let learning: unknown = null;
    let malformedLines = 0;
    let filesParsed = 0;
    if (existsSync(coDir)) {
      try {
        const files = readdirSync(coDir)
          .filter((f) => /^\d{4}-\d{2}\.jsonl$/.test(f))
          .sort();
        filesParsed = files.length;
        if (files.length > 0) {
          let rows: ReturnType<typeof parseOutcomeLog>["rows"] = [];
          for (const f of files) {
            const { rows: parsed, malformed_lines } = parseOutcomeLog(
              readFileSync(path.join(coDir, f), "utf8"),
            );
            rows = rows.concat(parsed);
            malformedLines += malformed_lines;
          }
          const metrics = computeMetrics({ outcomes: rows });
          learning = {
            source: "state/candidate-outcomes/*.jsonl",
            files_parsed: filesParsed,
            malformed_lines_skipped: malformedLines,
            thresholds_note:
              "numeric investigation thresholds unset per ADR-0013 §2 — set by owner amendment after ~30 days of data",
            ...metrics,
          };
        } else {
          learning = { outcomes_present: false, note: "no outcomes logged yet" };
        }
      } catch {
        learning = { outcomes_present: false, note: "no outcomes logged yet" };
      }
    } else {
      // No candidate-outcomes dir — surface report's own metrics if any
      const r = report as { learning_layer?: { metrics?: unknown } };
      learning = r?.learning_layer?.metrics ?? { outcomes_present: false, note: "no outcomes logged yet" };
    }

    return NextResponse.json({
      readiness: report,
      learning,
      // also expose top-level for backward compat / direct consumers
      report,
      metrics: learning,
    });
  } catch (e) {
    return serverError(e);
  }
}
