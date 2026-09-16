// Probe-only H5 RSC spike (round 2). Server Component: renders a
// deterministic, static representative audit snapshot as plain HTML so first
// paint carries real text with zero JS. force-static => byte-identical doc
// across iters (P5). No imports from pipeline/Repository; no edits anywhere
// outside src/app/probe/**. The live read path stays client-side in
// ./harness.tsx via the WorkspaceApiAdapter `load` GETs.
import { ProbeHarness } from "./harness";

export const dynamic = "force-static";

export default function RscSnapshotSpike() {
  return (
    <main className="mx-auto max-w-3xl px-6 pb-16">
      <p className="pt-8 font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint">
        probe · rsc snapshot spike · server-rendered
      </p>
      <h1 className="mt-2 text-[26px] font-semibold tracking-[-0.02em]">
        Audit snapshot — DEMO-AUDIT-001
      </h1>

      <section aria-label="Snapshot meta">
        <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-md border">
          <div className="px-4 py-3">
            <dt className="font-mono text-[9.5px] uppercase">Audit</dt>
            <dd className="mt-1 font-mono text-[12.5px]">DEMO-AUDIT-001</dd>
          </div>
          <div className="px-4 py-3">
            <dt className="font-mono text-[9.5px] uppercase">Framework</dt>
            <dd className="mt-1 text-[13px]">UK Road Lighting Model 2024, preliminary design review pack</dd>
          </div>
          <div className="px-4 py-3">
            <dt className="font-mono text-[9.5px] uppercase">Native stage</dt>
            <dd className="mt-1 text-[13px]">Preliminary Design — gateway review before detailed design freeze</dd>
          </div>
          <div className="px-4 py-3">
            <dt className="font-mono text-[9.5px] uppercase">Canonical map</dt>
            <dd className="mt-1 font-mono text-[11.5px]">PRELIMINARY_DESIGN · mapping confidence high</dd>
          </div>
        </dl>
      </section>

      <section aria-label="Disclaimer" className="mt-4 border-y py-4">
        <p className="max-w-[70ch] text-[15.5px] leading-[1.6]">
          This snapshot is a deterministic, server-rendered representative extract for loading
          measurement only. It mirrors the shape of a real audit workspace — title block,
          disclaimer, findings, stage questions, missing information, and limitations — without
          touching any repository or pipeline. The live workspace still loads client-side through
          the same WorkspaceApiAdapter read path the production audit page uses, so reviewer
          mutations keep their existing contracts byte-for-byte.
        </p>
      </section>

      <section aria-label="Findings summary" className="mt-10">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.12em]">Findings — 3 this run</h2>
        <ul className="mt-3 space-y-3">
          <li className="rounded-md border px-4 py-3">
            <span className="font-mono text-[12px]">F-001</span>
            <p className="mt-1 max-w-[60ch] text-[14px] font-medium leading-[1.5]">
              Forward visibility splay at the proposed priority junction falls 12 metres short of
              the stopping sight distance for the 85th-percentile approach speed recorded on site.
            </p>
            <p className="mt-1 font-mono text-[10.5px]">category junction-visibility · risk high / likely · evidence EV-UK-002 · EV-UK-009</p>
          </li>
          <li className="rounded-md border px-4 py-3">
            <span className="font-mono text-[12px]">F-002</span>
            <p className="mt-1 max-w-[60ch] text-[14px] font-medium leading-[1.5]">
              Proposed lighting column positions on the northern footway narrow the clear walking
              width below the minimum for wheelchair users passing side by side with pedestrians.
            </p>
            <p className="mt-1 font-mono text-[10.5px]">category pedestrian-comfort · risk medium / possible · evidence EV-UK-014</p>
          </li>
          <li className="rounded-md border px-4 py-3">
            <span className="font-mono text-[12px]">F-003</span>
            <p className="mt-1 max-w-[60ch] text-[14px] font-medium leading-[1.5]">
              Dropped kerb gradients at the two uncontrolled crossing points exceed the maximum
              running slope, which may destabilise mobility-scooter users crossing in wet weather.
            </p>
            <p className="mt-1 font-mono text-[10.5px]">category inclusive-access · risk medium / likely · evidence EV-UK-021 · EV-UK-022</p>
          </li>
        </ul>
      </section>

      <section aria-label="Stage questions" className="mt-10">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.12em]">Stage questions — 1/4 addressed</h2>
        <ul className="mt-3 space-y-1.5">
          <li className="rounded-md border px-4 py-3 text-[13.5px]">Have 85th-percentile speeds been re-surveyed after the traffic-calming build-out? — addressed.</li>
          <li className="rounded-md border px-4 py-3 text-[13.5px]">Is the lighting design filed against the adopted column schedule with outreach confirmed?</li>
          <li className="rounded-md border px-4 py-3 text-[13.5px]">Are swept paths for refuse vehicles checked against the tightened junction radii?</li>
          <li className="rounded-md border px-4 py-3 text-[13.5px]">Has the drainage outfall capacity been confirmed for the 1-in-100-year storm event?</li>
        </ul>
      </section>

      <section aria-label="Missing information" className="mt-10">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.12em]">Missing information</h2>
        <p className="mt-2 max-w-[70ch] text-[13px] leading-relaxed">
          Speed survey dated after calming works; lighting column schedule revision C; swept-path
          analysis for an 11-metre refuse vehicle; drainage capacity letter from the adopting
          authority. Nothing else is outstanding — all other required inputs are recorded.
        </p>
      </section>

      <section aria-label="Limitations" className="mt-10">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.12em]">Limitations</h2>
        <ul className="mt-2 space-y-1.5">
          <li className="max-w-[80ch] text-[13px] leading-relaxed">No night-time site visit was undertaken; lighting levels are assessed from drawings only.</li>
          <li className="max-w-[80ch] text-[13px] leading-relaxed">Traffic counts cover a single neutral weekday and exclude school-holiday peaks.</li>
        </ul>
      </section>

      {/* Live read path (client harness). SSR of its initial state renders the
          skeleton below at first paint; the sentinel 404 settle removes it.
          Harness is last on the page so the swap shifts nothing below (CLS 0). */}
      <section aria-label="Live workspace status">
        <ProbeHarness />
      </section>
    </main>
  );
}
