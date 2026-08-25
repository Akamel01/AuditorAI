// Offline seed provider: curated portal veins per jurisdiction, harvested from
// docs/references/*MANIFEST.md + docs/research/sample-drawing-corpus.md. Always
// available (no network); feeds DRY-RUN pipelines and tests.
import { hitId } from "@/discovery/ids";
import type { DiscoveryHit } from "@/discovery/types";
import {
  providerEnabled,
  registerProvider,
  type DiscoverQuery,
  type DiscoveryProvider,
} from "./provider-types";
import type { JurisdictionId } from "@/domain/types";

interface Seed {
  url: string;
  source_type: DiscoveryHit["source_type"];
  portal_id: string;
  jurisdictions: JurisdictionId[];
  licence_hint: DiscoveryHit["licence_hint"];
  title_hint: string;
}

const SEEDS: Seed[] = [
  // UK — NSIP OGL planning portal (design-stage RSA reports live in DCO apps)
  { url: "https://national-infrastructure-consenting.planningregistry.co.uk/", source_type: "planning-portal", portal_id: "nsip-ogl", jurisdictions: ["UK"], licence_hint: "ogl-v3", title_hint: "NSIP consenting portal — search 'road safety audit'" },
  { url: "https://www.standardsforhighways.co.uk/tses/search", source_type: "dot-portal", portal_id: "standards-highways", jurisdictions: ["UK"], licence_hint: "ogl-v3", title_hint: "Standards for Highways — DMRB/MCHW search" },
  // USA — MnDOT edocs (richest design-stage vein), FHWA ROSA-P mirror
  { url: "https://www.dot.state.mn.us/planning/program/projdev.html", source_type: "dot-portal", portal_id: "mndot-edocs", jurisdictions: ["US"], licence_hint: "public-domain", title_hint: "MnDOT project development documents" },
  { url: "https://rosap.ntl.bts.gov/gsearch?ref=rsa", source_type: "institutional-repo", portal_id: "rosap", jurisdictions: ["US"], licence_hint: "public-domain", title_hint: "ROSA-P repository — road safety audits" },
  // Canada — Alberta CKAN / BC MoTI
  { url: "https://open.alberta.ca/opendatasets?q=road+safety+audit", source_type: "dot-portal", portal_id: "alberta-open", jurisdictions: ["CA"], licence_hint: "ogl-v3", title_hint: "Alberta Open Data — road safety audit" },
  { url: "https://www2.gov.bc.ca/gov/content/transportation/transportation-infrastructure/engineering-standards-and-guidelines/technical-circulars", source_type: "dot-portal", portal_id: "bc-moti", jurisdictions: ["CA"], licence_hint: "ogl-v3", title_hint: "BC MoTI technical circulars" },
  // UAE — QCC predictable URLs (Wayback CDX fallback), geo-fenced live edition
  { url: "https://web.archive.org/cdx/search/cdx?url=jawdah.qcc.abudhabi.ae*&output=text&filter=urlkey:.*isgl.*", source_type: "institutional-repo", portal_id: "jawdah-qcc-cdx", jurisdictions: ["AE"], licence_hint: "unknown", title_hint: "Jawdah/QCC ISGL list — Wayback CDX" },
  // International — Irish ABP/EIAR, CAREC
  { url: "https://www.pleanala.ie/publicaccess/", source_type: "planning-portal", portal_id: "abp-eiar", jurisdictions: ["INT"], licence_hint: "unknown", title_hint: "An Bord Pleanála public access — EIAR/RSA attachments" },
  { url: "https://www.carecprogram.org/?s=road+safety+audit", source_type: "institutional-repo", portal_id: "carec", jurisdictions: ["INT"], licence_hint: "unknown", title_hint: "CAREC program — road safety audit publications" },

  // Document-level seeds: already-harvested corpus exemplars (public provenance in
  // tests/fixtures/samples/*/index.md) so DRY-RUN exercises the full pipeline
  // against realistic titles/stages without network access.
  { url: "https://planning.welhat.gov.uk/Document/Download?module=PLA&recordNumber=107754&planId=2079274&imageId=5&isPlan=False&fileName=Stage%201%20Road%20Safety%20Report.pdf", source_type: "planning-portal", portal_id: "welhat-planning", jurisdictions: ["UK"], licence_hint: "unknown", title_hint: "Heathfield Lodge Great North Road — Stage 1 Road Safety Audit report with designer response and audit reference plan drawings" },
  { url: "https://www.hingham-ma.gov/DocumentCenter/View/2818/Derby-Street-Road-Safety-Audit-Derby-Street-at-Route-3-Ramps-PDF", source_type: "dot-portal", portal_id: "hingham-ma", jurisdictions: ["US"], licence_hint: "public-domain", title_hint: "Road Safety Audit — preliminary design phase, Derby Street at Route 3 Ramps" },
  { url: "https://open.alberta.ca/dataset/4f6fb605-f342-46ea-b531-d018fd81d70f/resource/2f0b905f-2c5c-4257-a91b-8272cb605242/download/neahdappendixc.pdf", source_type: "dot-portal", portal_id: "alberta-open", jurisdictions: ["CA"], licence_hint: "ogl-v3", title_hint: "Report on Planning Stage Road Safety Audit — North East Edmonton Ring Road functional planning" },
  { url: "https://www.pleanala.ie/publicaccess/EIAR-NIS/322160/Application%20Docs/DBFL%20Consulting%20Engineers/Reports/995%20DBFL%20Stage%201%20Road%20Safety%20Audit.pdf", source_type: "planning-portal", portal_id: "abp-eiar", jurisdictions: ["INT"], licence_hint: "unknown", title_hint: "Milltown Park Dublin — Stage 1 Road Safety Audit (preliminary design)" },
];

class SeedPortalsProvider implements DiscoveryProvider {
  readonly id = "seed-portals";
  readonly source_type = "dot-portal" as const;

  async discover(query: DiscoverQuery): Promise<DiscoveryHit[]> {
    const now = new Date(0).toISOString(); // deterministic in dry-run
    const wanted = new Set(query.jurisdictions);
    const hits: DiscoveryHit[] = [];
    for (const s of SEEDS) {
      if (query.jurisdictions.length > 0 && !s.jurisdictions.some((j) => wanted.has(j))) continue;
      hits.push({
        hit_id: hitId(this.id, s.url),
        url: s.url,
        source_type: s.source_type,
        provider_id: this.id,
        portal_id: s.portal_id,
        discovered_at: now,
        licence_hint: s.licence_hint,
        http_status: null,
        sha256_hint: null,
        title_hint: s.title_hint,
        jurisdiction_guess: s.jurisdictions[0] ?? null,
      });
    }
    return hits.slice(0, query.limit ?? hits.length);
  }

  async fetch(): Promise<never> {
    throw new Error("seed-portals is an offline discovery source; use a fetching provider to acquire");
  }
}

if (providerEnabled("seed-portals")) {
  registerProvider("seed-portals", () => new SeedPortalsProvider());
}
