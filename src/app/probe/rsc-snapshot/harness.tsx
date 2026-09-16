"use client";
// Probe-only H5 RSC-spike harness. Read-only: reuses the WorkspaceApiAdapter
// read path (`load` = 2 GETs) against sentinel IDs, exactly like the audit
// page's initial load. Initial render mirrors the audit page skeleton
// (Skeleton + LoadingRows) so SSR HTML matches hydration; the 404 settle
// swaps skeleton for a deterministic notice (M3 = skeleton gone).
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { load as loadWorkspace } from "@/domain/audit-workspace";
import { LoadingRows, Skeleton } from "@/app/_components/ui/empty-state";

const PROJECT_ID = "probe-nonexistent";
const AUDIT_ID = "probe-nonexistent";

export function ProbeHarness() {
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    loadWorkspace(PROJECT_ID, AUDIT_ID, api).then(
      () => {
        if (live) setNotice("probe: sentinel IDs unexpectedly resolved");
      },
      (e: unknown) => {
        if (live) setNotice(`probe settled read-only: ${e instanceof Error ? e.message : String(e)}`);
      },
    );
    return () => {
      live = false;
    };
  }, []);
  if (!notice) {
    return (
      <div className="pt-12">
        <Skeleton className="h-8 w-2/3" />
        <div className="mt-6">
          <LoadingRows rows={4} />
        </div>
      </div>
    );
  }
  return (
    <div className="pt-12">
      <div role="note" data-testid="probe-settled" className="font-mono text-[12px] text-muted">
        {notice}
      </div>
    </div>
  );
}
