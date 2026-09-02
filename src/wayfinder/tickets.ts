// Wayfinder ticket index — markdown files in workflow/wayfinder/maps are the
// tracker (TRACKER.md). This module compiles them so agents and Mission Control
// can see frontier vs HITL vs blocked without grepping.
// wave A: parallel_safe = true; locks = []
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  WAYFINDER_MAPS_DIR,
  type IndexedTicket,
  type TicketIndex,
  type TicketStatus,
  type WayfinderTicket,
} from "./ticket-types";

export {
  WAYFINDER_MAPS_DIR,
  type IndexedTicket,
  type TicketIndex,
  type TicketLane,
  type TicketStatus,
  type WayfinderTicket,
} from "./ticket-types";

const TERMINAL: ReadonlySet<string> = new Set(["closed", "resolved", "out-of-scope"]);
const KNOWN_STATUS: ReadonlySet<string> = new Set([
  "open",
  "claimed",
  "blocked",
  "closed",
  "resolved",
  "out-of-scope",
]);

const FRONT_MATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

export function isTerminalStatus(status: string): boolean {
  return TERMINAL.has(status);
}

export function ticketKey(map: string, id: string): string {
  return `${map}:${id}`;
}

export function parseTicketFrontMatter(text: string, file: string): Record<string, string> {
  const m = text.match(FRONT_MATTER_RE);
  if (!m) throw new Error(`${file}: missing front-matter block`);
  const fields: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const trimmed = line.trimEnd();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const colon = trimmed.indexOf(":");
    if (colon <= 0) continue;
    const key = trimmed.slice(0, colon).trim();
    const value = trimmed.slice(colon + 1).trim();
    fields[key] = value;
  }
  return fields;
}

function parseList(raw: string | undefined): string[] {
  if (raw === undefined) return [];
  const v = raw.trim();
  if (!v || v === "[]" || v === "null" || v === "~") return [];
  const inner = v.startsWith("[") && v.endsWith("]") ? v.slice(1, -1) : v;
  if (!inner.trim()) return [];
  return inner
    .split(",")
    .map((s) => s.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

function parseScalar(raw: string | undefined): string | null {
  if (raw === undefined) return null;
  const v = raw.trim();
  if (!v || v === "null" || v === "~") return null;
  return v.replace(/^["']|["']$/g, "");
}

function parseHitl(raw: string | undefined): boolean {
  return parseScalar(raw) === "true";
}

function parseStatus(raw: string | undefined, file: string): TicketStatus {
  const v = parseScalar(raw);
  if (!v || !KNOWN_STATUS.has(v)) {
    throw new Error(`${file}: status must be one of ${[...KNOWN_STATUS].join("|")} (got ${JSON.stringify(raw)})`);
  }
  return v as TicketStatus;
}

export function ticketFromFields(
  fields: Record<string, string>,
  map: string,
  filePath: string,
): WayfinderTicket {
  const id = parseScalar(fields.id);
  const title = parseScalar(fields.title);
  if (!id) throw new Error(`${filePath}: missing id`);
  if (!title) throw new Error(`${filePath}: missing title`);
  const status = parseStatus(fields.status, filePath);
  return {
    map,
    id,
    key: ticketKey(map, id),
    title,
    type: parseScalar(fields.type) ?? "task",
    hitl: parseHitl(fields.hitl),
    status,
    assignee: parseScalar(fields.assignee),
    blocked_by: parseList(fields.blocked_by),
    blocks: parseList(fields.blocks),
    issue: parseScalar(fields.issue),
    created: parseScalar(fields.created),
    resolved: parseScalar(fields.resolved),
    path: filePath,
  };
}

export function classifyTickets(tickets: WayfinderTicket[]): IndexedTicket[] {
  const byKey = new Map(tickets.map((t) => [t.key, t]));
  return tickets.map((t) => {
    const depsClosed = t.blocked_by.every((depId) => {
      const dep = byKey.get(ticketKey(t.map, depId));
      return !dep || isTerminalStatus(dep.status);
    });
    const unassigned = t.assignee === null;
    const frontier = t.status === "open" && unassigned && depsClosed;
    return {
      ...t,
      frontier,
      ready_without_owner: frontier && !t.hitl,
    };
  });
}

function listMapSlugs(root: string): string[] {
  const mapsDir = path.join(root, WAYFINDER_MAPS_DIR);
  return readdirSync(mapsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

export function loadTicketsFromTree(root = process.cwd()): WayfinderTicket[] {
  const tickets: WayfinderTicket[] = [];
  const seen = new Set<string>();
  for (const map of listMapSlugs(root)) {
    const dir = path.join(root, WAYFINDER_MAPS_DIR, map, "tickets");
    let names: string[] = [];
    try {
      names = readdirSync(dir).filter((n) => n.endsWith(".md")).sort();
    } catch {
      continue;
    }
    for (const name of names) {
      const rel = path.join(WAYFINDER_MAPS_DIR, map, "tickets", name);
      const abs = path.join(root, rel);
      const text = readFileSync(abs, "utf8");
      const fields = parseTicketFrontMatter(text, rel);
      const ticket = ticketFromFields(fields, map, rel);
      if (seen.has(ticket.key)) throw new Error(`${rel}: duplicate ticket key ${ticket.key}`);
      seen.add(ticket.key);
      tickets.push(ticket);
    }
  }
  return tickets;
}

export function buildTicketIndex(tickets: WayfinderTicket[]): TicketIndex {
  const indexed = classifyTickets(tickets);
  const maps = [...new Set(indexed.map((t) => t.map))].sort();
  const counts = {
    total: indexed.length,
    open: indexed.filter((t) => t.status === "open").length,
    claimed: indexed.filter((t) => t.status === "claimed").length,
    blocked: indexed.filter((t) => t.status === "blocked").length,
    closed: indexed.filter((t) => isTerminalStatus(t.status)).length,
    frontier: indexed.filter((t) => t.frontier).length,
    ready_without_owner: indexed.filter((t) => t.ready_without_owner).length,
    hitl_frontier: indexed.filter((t) => t.frontier && t.hitl).length,
  };
  return {
    schema_version: "1.0.0",
    source: WAYFINDER_MAPS_DIR,
    maps,
    tickets: indexed.sort((a, b) => a.key.localeCompare(b.key)),
    counts,
  };
}

export function indexWayfinderTickets(root = process.cwd()): TicketIndex {
  return buildTicketIndex(loadTicketsFromTree(root));
}
