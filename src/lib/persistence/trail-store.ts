import type { DataStore } from "./store";
import * as Keys from "./keys";
import { artifactSeqOf } from "./keys";
import {
  AUDIT_TRAIL_GENESIS_HASH,
  buildAuditTrailEntry,
  type AuditTrailEntry,
  type AuditTrailRecordInput,
} from "@/domain/audit-trail";

// Module-scope per-workspace promise chain. Serialises appends inside one
// process by chaining onto the previous append's promise; waits instead of
// throwing (unlike withPersistenceSingleWriter). KV has no compare-and-set,
// so cross-instance appends remain best-effort; upgrade when the store offers CAS.
const chains = new Map<string, Promise<unknown>>();

export class AuditTrailCorruptError extends Error {
  constructor(detail: string) {
    super(`audit trail corrupt: ${detail}`);
    this.name = "AuditTrailCorruptError";
  }
}

export class TrailStore {
  constructor(private store: DataStore) {}

  append(workspace: string, record: AuditTrailRecordInput): Promise<AuditTrailEntry> {
    if (!workspace || !workspace.trim()) {
      return Promise.reject(new Error("workspace handle must not be empty"));
    }
    const prev = chains.get(workspace) ?? Promise.resolve();
    const next = prev.then(() => this.doAppend(workspace, record), () => this.doAppend(workspace, record));
    chains.set(workspace, next.catch(() => undefined));
    return next as Promise<AuditTrailEntry>;
  }

  private async doAppend(workspace: string, record: AuditTrailRecordInput): Promise<AuditTrailEntry> {
    const prefix = Keys.trailPrefix(workspace);
    const keys = await this.store.keys(prefix);
    keys.sort((a, b) => artifactSeqOf(a) - artifactSeqOf(b));
    const lastKey = keys[keys.length - 1];
    let seq = 1;
    let prevHash = AUDIT_TRAIL_GENESIS_HASH;
    if (lastKey) {
      const parsedSeq = artifactSeqOf(lastKey);
      const head = await this.store.get<AuditTrailEntry>(lastKey);
      if (head === null || head.seq !== parsedSeq) {
        throw new AuditTrailCorruptError(`unreadable or inconsistent head at seq ${parsedSeq}`);
      }
      seq = head.seq + 1;
      prevHash = head.entry_hash;
    }
    const recordedAt = new Date().toISOString();
    const entry = buildAuditTrailEntry({
      ...record,
      workspace,
      seq,
      prev_hash: prevHash,
      recorded_at: recordedAt,
    });
    const targetKey = Keys.trailKey(workspace, seq);
    if ((await this.store.get(targetKey)) !== null) {
      throw new AuditTrailCorruptError(`refusing to overwrite existing seq ${seq}`);
    }
    await this.store.put(targetKey, entry);
    return entry;
  }

  async list(workspace: string): Promise<AuditTrailEntry[]> {
    const prefix = Keys.trailPrefix(workspace);
    const keys = await this.store.keys(prefix);
    keys.sort((a, b) => artifactSeqOf(a) - artifactSeqOf(b));
    const loaded = await this.store.getMany<AuditTrailEntry>(keys);
    return loaded.filter((e): e is AuditTrailEntry => e !== null);
  }
}