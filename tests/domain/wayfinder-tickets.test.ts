import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildTicketIndex,
  classifyTickets,
  indexWayfinderTickets,
  isTerminalStatus,
  loadTicketsFromTree,
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
    expect(r3?.status).toBe("closed");

    const f1 = index.tickets.find((t) => t.key === "v2-agentic-platform:F1");
    expect(f1?.status).toBe("closed"); // closed 2026-09-15: fresh judged Tier-1 + archive
    expect(f1?.frontier).toBe(false);
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

// M-H13-TEST: temp-dir leniency unit test for indexWayfinderTickets
// Creates a temporary workflow/wayfinder/maps/<m>/tickets/ with one valid ticket and
// one invalid status ticket. Expects 1 ticket served, 1 skipped, and total count == 1.
describe("M-H13-TEST: temp-dir leniency", () => {
  it("indexes one good ticket and one bad ticket using a temp dir without mutating cwd", () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "aud-wf-test-"));
    try {
      const mapsRoot = path.join(tmpRoot, "workflow", "wayfinder", "maps");
      const map = "mvp";
      const ticketsDir = path.join(mapsRoot, map, "tickets");
      fs.mkdirSync(ticketsDir, { recursive: true });

      // Good ticket
      const goodPath = path.join(ticketsDir, "R3.md");
      fs.writeFileSync(
        goodPath,
        `---\nid: R3\ntitle: Regression tests\nstatus: open\n---\nbody\n`,
        "utf8",
      );

      // Bad ticket with invalid status
      const badPath = path.join(ticketsDir, "R4.md");
      fs.writeFileSync(
        badPath,
        `---\nid: R4\ntitle: Bad status\nstatus: in_progress\n---\nbody\n`,
        "utf8",
      );

      // Execute
      const index = indexWayfinderTickets(tmpRoot);

      // Validate expectations
      expect(index.tickets.length).toBe(1);
      expect(index.skipped.length).toBe(1);
      expect(index.counts.total).toBe(1);
      // The skipped file should be the relative path used by the loader
      const expectedRel = `workflow/wayfinder/maps/${map}/tickets/${path.basename(badPath)}`.replaceAll("\\", "/");
      expect(index.skipped[0].file).toBe(expectedRel);
    } finally {
      // Cleanup temp dir
      try {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  });
});

// M-H1: duplicate ticket id within one map → deterministic first-wins + skipped record.
// (Keys are map:id, so same-key collision can only arise from two files sharing
// one map+id; readdir is sorted, so the lexicographically-first file wins.)
describe("M-H1 duplicate ticket key determinism", () => {
  it("keeps the first file, reports the second in skipped", () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "aud-wf-dup-"));
    try {
      const ticketsDir = path.join(tmpRoot, "workflow", "wayfinder", "maps", "mvp", "tickets");
      fs.mkdirSync(ticketsDir, { recursive: true });
      const content = `---\nid: R3\ntitle: Regression tests\nstatus: open\n---\nbody\n`;
      fs.writeFileSync(path.join(ticketsDir, "R3.md"), content, "utf8");
      fs.writeFileSync(path.join(ticketsDir, "R3-dup.md"), content, "utf8");
      const { tickets, skipped } = loadTicketsFromTree(tmpRoot);
      expect(tickets).toHaveLength(1);
      expect(tickets[0].key).toBe("mvp:R3");
      // readdir is byte-sorted: "R3-dup.md" ('-' 0x2D) precedes "R3.md" ('.' 0x2E),
      // so first-wins deterministically keeps R3-dup.md regardless of mtime.
      expect(tickets[0].path.endsWith("tickets/R3-dup.md")).toBe(true);
      expect(skipped).toHaveLength(1);
      expect(skipped[0].file.endsWith("tickets/R3.md")).toBe(true);
      expect(skipped[0].reason).toContain("duplicate ticket key mvp:R3");
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

// M-H2: loadTicketsFromTree consumer shape guard — {tickets, skipped}; malformed
// front-matter lands in skipped with a reason instead of throwing.
describe("M-H2 loadTicketsFromTree shape guard", () => {
  it("returns { tickets, skipped } and skips id-less files with reason", () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "aud-wf-shape-"));
    try {
      const ticketsDir = path.join(tmpRoot, "workflow", "wayfinder", "maps", "shape-drift", "tickets");
      fs.mkdirSync(ticketsDir, { recursive: true });
      fs.writeFileSync(
        path.join(ticketsDir, "R9.md"),
        `---\ntitle: Bad front matter\nstatus: open\n---\nbody\n`,
        "utf8",
      );
      const result = loadTicketsFromTree(tmpRoot);
      expect(Object.keys(result).sort()).toEqual(["skipped", "tickets"]);
      expect(result.tickets).toHaveLength(0);
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0].reason).toContain("missing id");
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

// M-H3: terminal-status helper + all-skipped index carries no nulls.
describe("M-H3 terminal logic and all-skipped seam", () => {
  it("classifies terminal vs live statuses", () => {
    expect(isTerminalStatus("closed")).toBe(true);
    expect(isTerminalStatus("resolved")).toBe(true);
    expect(isTerminalStatus("out-of-scope")).toBe(true);
    expect(isTerminalStatus("open")).toBe(false);
    expect(isTerminalStatus("claimed")).toBe(false);
    expect(isTerminalStatus("blocked")).toBe(false);
  });

  it("all-skipped index has empty tickets, preserved skipped, no nulls", () => {
    const skipped = [{ file: "workflow/wayfinder/maps/mvp/tickets/R3.md", reason: "duplicate ticket key mvp:R3" }];
    const index = buildTicketIndex([], skipped);
    expect(index.tickets).toHaveLength(0);
    expect(index.skipped).toEqual(skipped);
    expect(index.counts.total).toBe(0);
    expect(index.tickets.every((t) => t != null)).toBe(true);
  });
});
