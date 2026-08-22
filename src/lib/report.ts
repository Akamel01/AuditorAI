// Report renderer: AuditResult → deterministic Markdown. JSON output is the
// AuditResult itself (schema-valid by construction). PDF via browser print.
import type { AuditResult } from "@/domain/types";

export function renderReportMarkdown(r: AuditResult): string {
  const L: string[] = [];
  const h = (n: number, t: string) => L.push(`${"#".repeat(n)} ${t}\n`);

  h(1, `Road Safety Audit Report — ${r.native_stage_display_name}`);
  L.push(`> ${r.disclaimer}\n`);

  h(2, "1. Audit metadata");
  L.push(
    `- **Audit ID:** ${r.audit_id}`,
    `- **Project ID:** ${r.project_id}`,
    `- **Jurisdiction:** ${r.jurisdiction}`,
    `- **Framework:** ${r.framework_name}`,
    `- **Native stage:** ${r.native_stage_display_name} (${r.native_stage_id})`,
    `- **Canonical mapping:** ${r.canonical_stages.join(" + ") || "—"} (confidence: ${r.mapping_confidence})`,
    `- **Executed:** ${r.ran_at}`,
    "",
  );

  h(2, "2. Reviewed information");
  for (const m of r.input_manifest) {
    L.push(`- ${m.label} — *${m.state.replace("_", " ")}* (${m.requirement_level})`);
  }
  if (r.input_manifest.length === 0) L.push("- No stage inputs defined.");
  L.push("");

  h(2, "3. Findings");
  const reviewable = r.findings.filter((f) => f.reviewer_status !== "rejected");
  if (reviewable.length === 0) L.push("_No findings recorded in this audit._\n");
  let i = 1;
  for (const f of reviewable) {
    L.push(`### Finding ${i++} [${f.kind}] ${f.finding_id}`);
    L.push(`- **Statement:** ${f.statement.text}`);
    if (f.location) L.push(`- **Location:** ${f.location}`);
    if (f.road_users.length) L.push(`- **Road users:** ${f.road_users.join(", ")}`);
    if (f.scenario) L.push(`- **Scenario:** ${f.scenario}`);
    if (f.evidence.length)
      L.push(
        `- **Evidence:** ${f.evidence.map((e) => e.evidence_id).join(", ")}`,
      );
    const rc = f.risk_components;
    const scored = rc.severity || rc.likelihood || rc.exposure;
    L.push(
      `- **Risk:** ${
        scored
          ? [rc.severity && `severity ${rc.severity}`, rc.likelihood && `likelihood ${rc.likelihood}`, rc.exposure && `exposure ${rc.exposure}`]
              .filter(Boolean)
              .join(" / ") + (rc.scale_id ? ` (scale: ${rc.scale_id})` : "")
          : "not scored under this framework"
      }`,
    );
    L.push(`- **Confidence:** ${f.confidence.label} — ${f.confidence.basis}`);
    if (f.rationale) L.push(`- **Rationale (inference):** ${f.rationale}`);
    if (f.recommendation) L.push(`- **Recommendation:** ${f.recommendation}`);
    L.push(`- **Reviewer status:** ${f.reviewer_status}`);
    L.push("");
  }

  h(2, "4. Missing information");
  if (r.missing_information.length === 0) L.push("_None._\n");
  for (const m of r.missing_information) {
    L.push(`- **${m.label}** (${m.requirement_level}; state: unknown/missing) — ${m.note} [${m.evidence_ids.join(", ")}]`);
  }
  L.push("");

  h(2, "5. Assessment questions to be addressed by the audit team");
  for (const q of r.audit_questions) {
    L.push(`- [${q.addressed ? "x" : " "}] ${q.text} _(${q.topic}${q.source_note ? `; ${q.source_note}` : ""})_`);
  }
  if (r.audit_questions.length === 0) L.push("- No stage-specific questions defined.");
  L.push("");

  h(2, "6. Limitations");
  for (const lim of r.limitations) L.push(`- ${lim}`);
  L.push("");

  return L.join("\n");
}
