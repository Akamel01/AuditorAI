// wave A: parallel_safe = true; no cross-process state
export const WAYFINDER_MAPS_DIR = "workflow/wayfinder/maps";

export type TicketStatus =
  | "open"
  | "claimed"
  | "blocked"
  | "closed"
  | "resolved"
  | "out-of-scope";

export interface WayfinderTicket {
  map: string;
  id: string;
  key: string;
  title: string;
  type: string;
  hitl: boolean;
  status: TicketStatus;
  assignee: string | null;
  blocked_by: string[];
  blocks: string[];
  issue: string | null;
  created: string | null;
  resolved: string | null;
  path: string;
}

export interface TicketLane {
  frontier: boolean;
  ready_without_owner: boolean;
}

export type IndexedTicket = WayfinderTicket & TicketLane;

export interface TicketIndex {
  schema_version: "1.0.0";
  source: typeof WAYFINDER_MAPS_DIR;
  maps: string[];
  tickets: IndexedTicket[];
  counts: {
    total: number;
    open: number;
    claimed: number;
    blocked: number;
    closed: number;
    frontier: number;
    ready_without_owner: number;
    hitl_frontier: number;
  };
}
