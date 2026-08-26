// D02-QUALIFY — deterministic in-scope/reserve/reject rules over raw hits.
// Mirrors sample-corpus R1-R4 intent at discovery time: prefer paired
// design-stage material; route in-service/reference-grade to reserve.
import { qualificationId } from "@/discovery/ids";
import type { DiscoveryHit, Qualification } from "@/discovery/types";
import type { JurisdictionId } from "@/domain/types";

const IN_SCOPE_PATTERNS: RegExp[] = [
  /road\s+safety\s+audit/i,
  /\brsa\b/i,
  /stage\s*[12]\s+(rsa|audit)/i,
  /(preliminary|detailed|functional\s+planning)\s+design/i,
];

const RESERVE_PATTERNS: RegExp[] = [
  /existing[- ]road/i,
  /in[- ]service/i,
  /road\s+safety\s+inspec(tion)?/i,
  /post[- ]?opening/i,
  /network\s+screening/i,
];

const REJECT_PATTERNS: RegExp[] = [
  /\.jpe?g($|\?)/i,
  /\.png($|\?)/i,
  /\.(zip|dwg|exe)($|\?)/i,
  /login|signin|cart|checkout/i,
];

export function qualifyHits(hits: DiscoveryHit[]): Qualification[] {
  const out: Qualification[] = [];
  for (const hit of hits) {
    const text = `${hit.title_hint ?? ""} ${hit.url}`;
    let verdict: Qualification["verdict"];
    const reasons: string[] = [];

    const looksLikeDoc = /\.pdf(\?|$)/i.test(hit.url) || /\b(View|Download|DocumentCenter|open\.alberta)\b/i.test(hit.url);
    if (REJECT_PATTERNS.some((p) => p.test(text))) {
      verdict = "reject";
      reasons.push("non-document or portal-chrome URL pattern");
    } else if (IN_SCOPE_PATTERNS.some((p) => p.test(text)) && !RESERVE_PATTERNS.some((p) => p.test(text))) {
      if (!looksLikeDoc) {
        verdict = "reserve";
        reasons.push("RSA title signal but URL lacks document pattern (no .pdf/View/Download) — treat as portal index for later crawl");
      } else {
        verdict = "in_scope";
        reasons.push("matches road-safety-audit document patterns; no in-service markers");
      }
    } else if (RESERVE_PATTERNS.some((p) => p.test(text))) {
      verdict = "reserve";
      reasons.push("in-service / inspection-class material (R1 analogue)");
    } else {
      verdict = "reserve";
      reasons.push("no RSA document signal in title/url");
    }

    if (hit.licence_hint === "licensed-tier1-pending") {
      if (verdict === "in_scope") {
        verdict = "reserve";
        reasons.push("tier-1 licensed source awaiting case-by-case owner approval");
      }
    }

    out.push({
      qualification_id: qualificationId(hit.hit_id),
      hit_id: hit.hit_id,
      verdict,
      reasons,
      scheme_hint: hit.title_hint,
      jurisdiction_guess: guessJurisdiction(hit),
    });
  }
  return out;
}

function guessJurisdiction(hit: DiscoveryHit): JurisdictionId | null {
  if (hit.jurisdiction_guess) return hit.jurisdiction_guess;
  const u = hit.url.toLowerCase();
  if (/standardsforhighways|planningregistry\.co\.uk|gov\.uk/.test(u)) return "UK";
  if (/dot\.gov|rosap|state\.[a-z]{2}\.us|mndot/.test(u)) return "US";
  if (/alberta\.ca|gov\.bc\.ca|ontario\.ca/.test(u)) return "CA";
  if (/qcc\.abudhabi|dmt\.gov\.ae/.test(u)) return "AE";
  return "INT";
}
