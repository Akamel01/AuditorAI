import { describe, expect, it } from "vitest";
import {
  buildTicketIndex,
  classifyTickets,
  indexWayfinderTickets,
  parseTicketFrontMatter,
  ticketFromFields,
  type WayfinderTicket,
} from "@/wayfinder/tickets";

function ticket(partial: Partial<WayfinderTicket> & Pick<WayfinderTicket, "map" | "id" | "status">): WayfinderTicket {
  return {
    title: partial.title ?? partial.id,
    type: "task",
    hitl: false,
    assignee: null,
    blocked_by: [],
    blocks: [],
    issue: null,
    created: "2026-08-30",
    resolved: null,
    path: `workflow/wayfinder/maps/${partial.map}/tickets/${partial.id}.md`,
    key: `${partial.map}:${partial.id}`,
    ...partial,
  };
}

describe("parseTicketFrontMatter", () => {
  it("keeps issue numbers that YAML would treat as comments", () => {
    const fields = parseTicketFrontMatter(
      "---\nid: D2\ntitle: Dev-tab UX\nstatus: resolved\nissue: #3\nhitl: true\nblocked_by: [D1]\n---\n\nbody\n",
      "t.md",
    );
    expect(fields.issue).toBe("#3");
    expect(fields.hitl).toBe("true");
    expect(fields.blocked_by).toBe("[D1]");
  });
});

describe("classifyTickets (TRACKER.md frontier)", () => {
  it("marks open + unassigned + closed deps as frontier and ready without owner", () => {
    const [r3] = classifyTickets([
      ticket({ map: "ops-residual", id: "R3", status: "open", title: "Regression tests" }),
    ]);
    expect(r3.frontier).toBe(true);
    expect(r3.ready_without_owner).toBe(true);
  });

  it("excludes HITL tickets from ready_without_owner but keeps them on the frontier", () => {
    const [r4] = classifyTickets([
      ticket({ map: "ops-residual", id: "R4", status: "open", hitl: true, title: "Production proof" }),
    ]);
    expect(r4.frontier).toBe(true);
    expect(r4.ready_without_owner).toBe(false);
  });

  it("excludes claimed, blocked-status, and open-dependency tickets from the frontier", () => {
    const indexed = classifyTickets([
      ticket({ map: "ops", id: "T1", status: "resolved" }),
      ticket({ map: "ops", id: "T2", status: "blocked", blocked_by: ["T1"] }),
      ticket({ map: "ops", id: "A", status: "open", assignee: "agent" }),
      ticket({ map: "v2", id: "F1", status: "open", hitl: true }),
      ticket({ map: "v2", id: "F4", status: "open", hitl: true, blocked_by: ["F1"] }),
    ]);
    const byId = Object.fromEntries(indexed.map((t) => [t.id, t]));
    expect(byId.T2.frontier).toBe(false);
    expect(byId.A.frontier).toBe(false);
    expect(byId.F4.frontier).toBe(false);
    expect(byId.F1.frontier).toBe(true);
  });

  it("treats resolved/closed/out-of-scope as terminal for blocked_by, scoped per map", () => {
    const indexed = classifyTickets([
      ticket({ map: "mvp", id: "R1", status: "closed" }),
      ticket({ map: "ops-residual", id: "R1", status: "open" }),
      ticket({
        map: "ops-residual",
        id: "R9",
        status: "open",
        blocked_by: ["R1"],
      }),
    ]);
    const r9 = indexed.find((t) => t.id === "R9")!;
    expect(r9.frontier).toBe(false);
  });
});

describe("ticketFromFields", () => {
  it("parses empty assignee and lists", () => {
    const t = ticketFromFields(
      {
        id: "R8",
        title: "Health route",
        type: "task",
        hitl: "false",
        status: "open",
        assignee: "",
        blocked_by: "[]",
        blocks: "[]",
        issue: "#24",
        created: "2026-08-30",
        resolved: "",
      },
      "ops-residual",
      "x.md",
    );
    expect(t.assignee).toBeNull();
    expect(t.blocked_by).toEqual([]);
    expect(t.issue).toBe("#24");
    expect(t.hitl).toBe(false);
  });
});

describe("indexWayfinderTickets (repo tree)", () => {
  it("indexes every map ticket and reports a non-empty ready-without-owner lane", () => {
    const index = indexWayfinderTickets();
    expect(index.schema_version).toBe("1.0.0");
    expect(index.maps).toEqual(
      expect.arrayContaining([
        "mvp",
        "ops-residual",
        "ops-seamless-verify",
        "v2-agentic-platform",
        "v3-architecture-deepening",
      ]),
    );
    expect(index.counts.total).toBeGreaterThanOrEqual(50);
    expect(index.counts.ready_without_owner).toBeGreaterThan(0);

    const r3 = index.tickets.find((t) => t.key === "ops-residual:R3");
    expect(r3?.ready_without_owner).toBe(true);

    const f1 = index.tickets.find((t) => t.key === "v2-agentic-platform:F1");
    expect(f1?.frontier).toBe(true);
    expect(f1?.ready_without_owner).toBe(false);

    const t2 = index.tickets.find((t) => t.key === "ops-seamless-verify:T2");
    expect(t2?.status).toBe("blocked");
    expect(t2?.frontier).toBe(false);

    const f4 = index.tickets.find((t) => t.key === "v2-agentic-platform:F4");
    expect(f4?.frontier).toBe(false);
  });

  it("builds counts from classified tickets", () => {
    const index = buildTicketIndex([
      ticket({ map: "ops", id: "A", status: "open" }),
      ticket({ map: "ops", id: "B", status: "open", hitl: true }),
      ticket({ map: "ops", id: "C", status: "closed" }),
    ]);
    expect(index.counts).toEqual({
      total: 3,
      open: 2,
      claimed: 0,
      blocked: 0,
      closed: 1,
      frontier: 2,
      ready_without_owner: 1,
      hitl_frontier: 1,
    });
  });
});
