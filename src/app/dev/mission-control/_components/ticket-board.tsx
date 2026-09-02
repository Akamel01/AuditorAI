"use client";

import { useMemo, useState } from "react";
import { Panel } from "@/app/_components/ui/panel";
import { Eyebrow, StateChip } from "@/app/_components/ui/chips";
import { Segmented } from "@/app/_components/ui/segmented";
import type { IndexedTicket, TicketIndex } from "@/wayfinder/ticket-types";

type Lane = "ready" | "hitl" | "blocked" | "open" | "all";

const LANES: { value: Lane; label: string }[] = [
  { value: "ready", label: "Ready (no owner gate)" },
  { value: "hitl", label: "HITL frontier" },
  { value: "blocked", label: "Blocked" },
  { value: "open", label: "All open" },
  { value: "all", label: "Everything" },
];

function chipFor(t: IndexedTicket): { state: string; label: string } {
  if (t.ready_without_owner) return { state: "provided", label: "ready" };
  if (t.frontier && t.hitl) return { state: "unknown", label: "hitl" };
  if (t.status === "blocked") return { state: "conflicting", label: "blocked" };
  if (t.status === "claimed") return { state: "unknown", label: "claimed" };
  if (t.status === "open") return { state: "not_available", label: "waiting" };
  return { state: "not_applicable", label: t.status };
}

function inLane(t: IndexedTicket, lane: Lane): boolean {
  if (lane === "ready") return t.ready_without_owner;
  if (lane === "hitl") return t.frontier && t.hitl;
  if (lane === "blocked") return t.status === "blocked" || (t.status === "open" && !t.frontier);
  if (lane === "open") return t.status === "open" || t.status === "claimed" || t.status === "blocked";
  return true;
}

export function TicketBoard({ index }: { index: TicketIndex }) {
  const [lane, setLane] = useState<Lane>("ready");
  const rows = useMemo(
    () => index.tickets.filter((t) => inLane(t, lane)),
    [index.tickets, lane],
  );

  return (
    <div className="space-y-4">
      <Panel className="px-4 py-4">
        <Eyebrow code="CH 0+510">Wayfinder tickets · markdown tracker</Eyebrow>
        <div className="mt-2 grid gap-3 font-mono text-[11px] leading-snug text-muted sm:grid-cols-4">
          <span>
            total {index.counts.total} · maps {index.maps.length}
          </span>
          <span>
            frontier {index.counts.frontier} · ready {index.counts.ready_without_owner}
          </span>
          <span>HITL waiting {index.counts.hitl_frontier}</span>
          <span>
            open {index.counts.open} · blocked {index.counts.blocked} · closed {index.counts.closed}
          </span>
        </div>
        <p className="mt-2 font-mono text-[10.5px] leading-snug text-faint">
          Canonical files live under <span className="text-subtle">{index.source}</span>. Claim still means editing the ticket front-matter (`status: claimed` + assignee). This view does not write.
        </p>
      </Panel>

      <Segmented options={LANES} value={lane} onChange={setLane} ariaLabel="Ticket lanes" />

      <Panel className="px-0 py-0 overflow-hidden">
        {rows.length === 0 ? (
          <p className="px-4 py-6 font-mono text-[12px] text-faint">No tickets in this lane.</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {rows.map((t) => {
              const chip = chipFor(t);
              return (
                <li key={t.key} className="flex flex-wrap items-start justify-between gap-2 px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] font-medium tracking-[0.04em] text-text">
                        {t.map}/{t.id}
                      </span>
                      <StateChip state={chip.state} label={chip.label} />
                      {t.issue && <span className="font-mono text-[10px] text-faint">{t.issue}</span>}
                    </div>
                    <p className="mt-0.5 text-[13px] leading-snug text-text">{t.title}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-faint">
                      {t.type}
                      {t.blocked_by.length ? ` · blocked_by ${t.blocked_by.join(", ")}` : ""}
                      {t.assignee ? ` · ${t.assignee}` : ""}
                      {" · "}
                      {t.path}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
