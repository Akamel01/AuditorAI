import Link from "next/link";
import { AppShell } from "./_components/ui/app-shell";
import { AlignmentRail, RailCaption } from "./_components/ui/alignment-rail";
import { Eyebrow } from "./_components/ui/chips";
import { Reveal } from "./_components/ui/reveal";
import { Button } from "./_components/ui/button";
import { ResetKeyLink } from "./_components/reset-key";
import { ArrowRight, Clause, Pin, Scales, Seal } from "./_components/ui/icons";

/*
 * Landing — the drawing sheet. The hero figure is a plan-view junction
 * excerpt being audited: findings pinned, evidence cited, desire lines
 * drawn. Everything on this page states what the product actually does.
 */

const PROCESS: { label: string; code: string }[] = [
  { label: "Scheme & jurisdiction", code: "CH 0+000" },
  { label: "Stage inputs", code: "CH 0+030" },
  { label: "Audit run", code: "CH 0+060" },
  { label: "Findings review", code: "CH 0+090" },
  { label: "Recommendations", code: "CH 0+120" },
  { label: "Issue report", code: "CH 0+150" },
];

const METHOD: { id: string; title: string; icon: React.ReactNode; body: React.ReactNode }[] = [
  {
    id: "01",
    title: "Evidence",
    icon: <Clause size={17} />,
    body: (
      <>
        Normative claims carry registry provenance — cited clauses like{" "}
        <span className="mono text-[0.92em] text-accent">EV-UK-015</span>, quoted in place, never
        paraphrased into authority. Inferences are labelled as derived, and stay distinguishable
        from what the standard actually says.
      </>
    ),
  },
  {
    id: "02",
    title: "Reasoning",
    icon: <Pin size={17} />,
    body: (
      <>
        The audit runs deterministically: input states for the exact native stage, process rules,
        and stage questions. Unknown is never treated as no, and every mapping between a
        jurisdiction’s own stages and the internal model carries an explicit confidence.
      </>
    ),
  },
  {
    id: "03",
    title: "Finding",
    icon: <Scales size={17} />,
    body: (
      <>
        Findings are typed — a <strong className="font-medium text-text">safety concern</strong> is
        categorically distinct from a{" "}
        <strong className="font-medium text-text">compliance question</strong>, and passing checks
        never implies a scheme is safe. Risk stays descriptive where the framework assigns no scale.
      </>
    ),
  },
  {
    id: "04",
    title: "Professional decision",
    icon: <Seal size={17} />,
    body: (
      <>
        Recommendations are recorded in the auditor’s voice — specific and proportionate; the
        wording discipline is enforced. Issuing freezes an immutable, numbered revision (I1, I2 …)
        that later runs can never alter.
      </>
    ),
  },
];

const JURISDICTIONS: { id: string; name: string; framework: string }[] = [
  { id: "INT", name: "International", framework: "Qualified PIARC-derived baseline" },
  { id: "UK", name: "United Kingdom", framework: "DMRB · GG 119" },
  { id: "US", name: "United States", framework: "FHWA RSA guidance" },
  { id: "CA", name: "Canada", framework: "TAC CRSAG + provincial instruments" },
  { id: "AE", name: "United Arab Emirates", framework: "DMT Road Safety Audit Manual · QCC TR-540" },
];

export default function Home() {
  return (
    <AppShell>
      {/* ————— hero ————— */}
      <section className="grid items-end gap-10 pt-14 pb-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)] lg:gap-12">
        <div className="anim-settle">
          <Eyebrow code="CH 0+000">Road safety audit, assisted</Eyebrow>
          <h1 className="max-w-[21ch] text-[clamp(30px,4.4vw,44px)] font-semibold leading-[1.12] tracking-[-0.022em]">
            The examination stays independent. The evidence does the heavy lifting.
          </h1>
          <p className="mt-5 max-w-[58ch] text-[16px] leading-[1.65] text-muted">
            AuditorAI runs the deterministic mechanics of a Road Safety Audit — stage inputs,
            process rules, cited standards — across International, UK, US, Canada and UAE
            practice. Every claim carries its source, every judgement its confidence, every
            decision its professional owner.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href="/projects" className="no-underline">
              <Button variant="primary">
                Open workspace
                <ArrowRight size={14} />
              </Button>
            </Link>
            <Link href="#method" className="no-underline">
              <Button variant="secondary">Read the method</Button>
            </Link>
          </div>
        </div>

        <Reveal delay={150}>
          <figure className="overflow-hidden rounded-md border border-hairline bg-surface">
            <JunctionFigure />
            <figcaption className="flex justify-between border-t border-hairline px-3.5 py-2.5 font-mono text-[10px] uppercase leading-[1.5] tracking-[0.08em] text-faint">
              <span>Fig. 01 — scheme excerpt, not to scale</span>
              <span>drawing ref JB-GF6</span>
            </figcaption>
          </figure>
        </Reveal>
      </section>

      {/* ————— process ————— */}
      <Reveal className="mt-16">
        <section aria-label="Process">
          <Eyebrow code="CH 0+120">Process</Eyebrow>
          <AlignmentRail stations={PROCESS} current={4} />
          <RailCaption>
            One pass of the rail is one <strong className="font-medium">Run</strong>. Reruns replace
            the draft’s results; issued revisions (<span className="mono text-[0.88em]">I1, I2 …</span>)
            are frozen permanently and never altered.
          </RailCaption>
        </section>
      </Reveal>

      {/* ————— method ————— */}
      <Reveal className="mt-20">
        <section id="method" aria-label="Method" className="scroll-mt-20">
          <Eyebrow code="CH 0+180">Method</Eyebrow>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
            <div>
              <h2 className="max-w-[16ch] text-[24px] font-semibold leading-[1.25]">
                Evidence, reasoning, finding — then the professional decision.
              </h2>
              <p className="mt-4 max-w-[46ch] text-[13.5px] leading-relaxed text-muted">
                The system’s job is to make the audit record honest, not to make judgements.
                Capability is declared per framework and stage — an explicit operational design
                domain, not a vague claim of coverage.
              </p>
            </div>
            <ol className="border-t border-hairline">
              {METHOD.map((m) => (
                <li key={m.id} className="grid grid-cols-[44px_1fr] gap-x-4 border-b border-hairline py-5">
                  <span className="pt-0.5 font-mono text-[11px] leading-none tracking-[0.1em] text-faint">
                    {m.id}
                  </span>
                  <div>
                    <div className="flex items-center gap-2 text-[14px] font-semibold">
                      <span className="text-subtle">{m.icon}</span>
                      {m.title}
                    </div>
                    <p className="mt-2 max-w-[62ch] text-[13.5px] leading-relaxed text-muted">{m.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </Reveal>

      {/* ————— jurisdictions ————— */}
      <Reveal className="mt-20">
        <section aria-label="Jurisdictions and frameworks">
          <Eyebrow code="CH 0+240">Jurisdictions · native stages preserved</Eyebrow>
          <div className="overflow-hidden rounded-md border border-hairline bg-surface">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-hairline">
                  {["Jurisdiction", "Framework of practice", "Stage vocabulary"].map((h, i) => (
                    <th
                      key={h}
                      className={`px-4 py-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-faint ${
                        i === 2 ? "hidden md:table-cell" : ""
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {JURISDICTIONS.map((j) => (
                  <tr key={j.id} className="border-b border-hairline transition-colors last:border-b-0 hover:bg-sunken">
                    <td className="px-4 py-3">
                      <span className="mr-3 inline-block min-w-[36px] rounded-[3px] border border-edge bg-sunken px-1.5 py-0.5 text-center font-mono text-[10.5px] leading-[1.6] text-subtle">
                        {j.id}
                      </span>
                      <span className="text-[13.5px] font-medium">{j.name}</span>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-muted">{j.framework}</td>
                    <td className="hidden px-4 py-3 font-mono text-[11px] text-faint md:table-cell">
                      native stages · never silently harmonised
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 max-w-[74ch] text-[12.5px] leading-relaxed text-subtle">
            “Stage 3” means detailed design in Alberta and post-construction in the UK. AuditorAI
            always presents the framework’s own stage, alongside its canonical mapping and the
            mapping’s confidence.
          </p>
        </section>
      </Reveal>

      {/* ————— charter ————— */}
      <Reveal className="mt-20">
        <section
          aria-label="Professional responsibility"
          className="border-y border-edge py-8"
        >
          <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
            <Seal size={20} className="mt-1 text-subtle" />
            <p className="formal max-w-[62ch] text-[17px] leading-[1.65] text-muted">
              This software <strong className="not-italic font-semibold text-text">assists</strong> the
              audit process. Final professional responsibility remains with the qualified auditor and
              the road authority. Compliance outputs never imply that a scheme is “safe”.
            </p>
          </div>
        </section>
      </Reveal>

      {/* ————— cta ————— */}
      <Reveal className="mt-16">
        <section className="flex flex-wrap items-center gap-4">
          <Link href="/projects" className="no-underline">
            <Button variant="primary">
              Open workspace
              <ArrowRight size={14} />
            </Button>
          </Link>
          <p className="max-w-[52ch] font-mono text-[11px] leading-[1.7] text-faint">
            Your workspace key stays in this browser; the server stores only its hash. AI candidate
            generation ships behind a seam and is off by default.
          </p>
          <span className="ml-auto">
            <ResetKeyLink />
          </span>
        </section>
      </Reveal>
    </AppShell>
  );
}

/* Plan-view junction excerpt with audit annotations. Colours follow the theme. */
function JunctionFigure() {
  return (
    <svg viewBox="0 0 460 250" role="img" aria-label="Plan view of the audited junction with an annotated finding and its evidence clause" className="block h-auto w-full">
      <g fill="none">
        {/* north arrow */}
        <g className="stroke-faint" opacity={0.9}>
          <path d="M436 22V7M431.5 11.5 436 7l4.5 4.5" />
        </g>
        <text x="430" y="34" className="font-mono fill-faint" fontSize="9">N</text>

        {/* motorway (M5) */}
        <path className="anim-draw stroke-edge" strokeWidth="1.2" d="M0 78H460" />
        <path className="anim-draw anim-d2 stroke-edge" strokeWidth="1.2" d="M0 122H460" />
        <path className="anim-draw anim-d3 stroke-faint" strokeWidth="1" strokeDasharray="7 6" d="M0 100H460" />
        <text x="8" y="70" className="font-mono fill-faint" fontSize="9" letterSpacing="1">M5</text>

        {/* A4019 arm */}
        <path className="anim-draw anim-d2 stroke-edge" strokeWidth="1.2" d="M196 0V250" />
        <path className="anim-draw anim-d3 stroke-edge" strokeWidth="1.2" d="M240 0V250" />
        <path className="anim-draw anim-d4 stroke-faint" strokeWidth="1" strokeDasharray="7 6" d="M218 0V250" />
        <g className="anim-settle stroke-hairline" style={{ animationDelay: ".9s" }}>
          <path d="m214 34 4 5 4-5M214 48l4 5 4-5" />
        </g>
        <text x="248" y="18" className="font-mono fill-faint" fontSize="9" letterSpacing="1">A4019</text>

        {/* central refuges (the finding) */}
        <g className="anim-settle" style={{ animationDelay: "1.05s" }}>
          <rect x="200" y="150" width="14" height="26" className="fill-sunken stroke-concern" />
          <rect x="222" y="150" width="14" height="26" className="fill-sunken stroke-concern" />
          <path className="stroke-concern-line" strokeWidth="0.8" d="M203 153l8 8M203 159l8 8M203 165l8 8" />
          <path className="stroke-concern-line" strokeWidth="0.8" d="M225 153l8 8M225 159l8 8M225 165l8 8" />
        </g>

        {/* desire lines to the bus stop */}
        <g className="anim-settle stroke-concern" style={{ animationDelay: "1.2s" }} strokeDasharray="2 4" strokeLinecap="round">
          <path d="M160 208C185 190 195 180 206 176" />
          <path d="M292 190C270 186 252 180 236 174" />
        </g>
        <g className="anim-settle font-mono fill-faint" style={{ animationDelay: "1.35s" }} fontSize="9.5">
          <text x="40" y="132">desire lines → bus stop</text>
          <path className="stroke-hairline" strokeWidth="0.8" fill="none" d="M96 138C120 158 140 176 158 190" />
        </g>

        {/* leader to finding label */}
        <g className="anim-settle" style={{ animationDelay: "1.45s" }}>
          <path className="stroke-faint" strokeWidth="1" fill="none" d="M214 163 320 52h32" />
          <circle className="fill-concern" cx="214" cy="163" r="2.6" />
        </g>
      </g>

      {/* callouts */}
      <g className="anim-settle font-mono" style={{ animationDelay: "1.5s" }} fontSize="10">
        <rect x="352" y="38" width="78" height="28" className="fill-canvas stroke-edge" />
        <text x="360" y="49" className="fill-text">JB-GF6-001</text>
        <text x="360" y="60" className="fill-concern">CONCERN</text>
      </g>
      <g className="anim-settle font-mono" style={{ animationDelay: "1.6s" }} fontSize="10">
        <rect x="60" y="196" width="84" height="24" className="fill-canvas stroke-accent-line" />
        <text x="68" y="211" className="fill-accent">EV-UK-015</text>
      </g>
    </svg>
  );
}
