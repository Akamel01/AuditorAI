"use client";
import Link from "next/link";
import { useWorkspaceKey, useResetWorkspace } from "@/lib/client";

export default function Home() {
  const key = useWorkspaceKey();
  const reset = useResetWorkspace();
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight">AuditorAI</h1>
      <p className="mt-2 text-neutral-600">
        AI-assisted, evidence-grounded <strong>Road Safety Audit</strong> support across
        International, UK, USA, Canada and UAE practice — Stages 0–2, mapped to a canonical
        internal model with cited provenance and explicit confidence.
      </p>
      <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        This software <strong>assists</strong> the audit process. Final professional
        responsibility remains with the qualified auditor and the road authority.
        Compliance outputs never imply that a scheme is “safe”.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Link
          href="/projects"
          className="rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Open workspace →
        </Link>
        {key && (
          <button
            onClick={reset}
            className="text-xs text-neutral-500 underline hover:text-neutral-800"
          >
            reset local key
          </button>
        )}
      </div>

      <section className="mt-10 text-sm text-neutral-600">
        <h2 className="font-semibold text-neutral-900">How it works</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Create a project and select jurisdiction → framework → native stage.</li>
          <li>See required/recommended/optional inputs for that exact stage.</li>
          <li>Fill inputs (paste text or upload PDF/TXT/MD for extraction).</li>
          <li>Run the deterministic audit: input states, process rules and stage questions.</li>
          <li>Review findings, record recommendations, generate the report.</li>
        </ol>
        <p className="mt-3 text-xs text-neutral-500">
          Your workspace key stays in this browser; the server stores only its hash.
          AI candidate generation ships behind a seam and is off by default.
        </p>
      </section>
    </main>
  );
}
