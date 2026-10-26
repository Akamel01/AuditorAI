import type { DataStore } from "./store";
import * as Keys from "./keys";
import { artifactSeqOf } from "./keys";
import {
  AUDIT_TRAIL_GENESIS_HASH,
  buildAuditTrailEntry,
  type AuditTrailEntry,
  type AuditTrailRecordInput,
} from "@/domain/audit-trail";
import { log } from "@/lib/logger";
import { fireAlert } from "@/lib/alert";

// Serialises appends per workspace inside one instance by chaining onto the
// previous append's promise; waits instead of throwing (unlike
// withPersistenceSingleWriter). Cross-instance correctness comes from
// createIfAbsent (atomic create) on the shared store.
export class AuditTrailCorruptError extends Error {
  constructor(detail: string) {
    super(`audit trail corrupt: ${detail}`);
    this.name = "AuditTrailCorruptError";
  }
}

export class AuditTrailRaceError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = "AuditTrailRaceError";
  }
}

export class TrailStore {
  private chains = new Map<string, Promise<unknown>>();  constructor(private store: DataStore) {}

  append(workspace: string, record: AuditTrailRecordInput): Promise<AuditTrailEntry> {
    if (!workspace || !workspace.trim()) {
      return Promise.reject(new Error("workspace handle must not be empty"));
    }
    const prev = this.chains.get(workspace) ?? Promise.resolve();
    const next = prev.then(() => this.doAppend(workspace, record), () => this.doAppend(workspace, record));
    this.chains.set(workspace, next.catch(() => undefined));
    return next as Promise<AuditTrailEntry>;
  }

  private async doAppend(workspace: string, record: AuditTrailRecordInput): Promise<AuditTrailEntry> {
    try {
      // Head resolution via trailHeadKey pointer.
      const resolveHead = async (): Promise<{ seq: number; hash: string }> => {
        const pointer = await this.store.get<{ seq: number; entry_hash: string }>(Keys.trailHeadKey(workspace));
        if (pointer) {
          const head = await this.store.get<AuditTrailEntry>(Keys.trailKey(workspace, pointer.seq));
          if (head === null || head.seq !== pointer.seq) {
            throw new AuditTrailCorruptError(`unreadable or inconsistent head at seq ${pointer.seq}`);
          }
          // probe forward
          let lastSeq = head.seq;
          let lastHash = head.entry_hash;
          let probe = head.seq + 1;
          while (true) {
            const next = await this.store.get<AuditTrailEntry>(Keys.trailKey(workspace, probe));
            if (next === null) break;
            if (next.seq !== probe) {
              throw new AuditTrailCorruptError(`inconsistent entry at seq ${probe}`);
            }
            lastSeq = next.seq;
            lastHash = next.entry_hash;
            probe += 1;
          }
          return { seq: lastSeq, hash: lastHash };
        }
        // pointer absent: one-time fallback to keys scan
        const keys = await this.store.keys(Keys.trailPrefix(workspace));
        keys.sort((a, b) => artifactSeqOf(a) - artifactSeqOf(b));
        if (keys.length === 0) {
          return { seq: 0, hash: AUDIT_TRAIL_GENESIS_HASH };
        }
        const lastKey = keys[keys.length - 1];
        const parsedSeq = artifactSeqOf(lastKey);
        const head = await this.store.get<AuditTrailEntry>(lastKey);
        if (head === null || head.seq !== parsedSeq) {
          throw new AuditTrailCorruptError(`unreadable or inconsistent head at seq ${parsedSeq}`);
        }
        return { seq: head.seq, hash: head.entry_hash };
      };

      for (let attempt = 0; attempt < 5; attempt++) {
        const head = await resolveHead();
        const seq = head.seq + 1;
        const recordedAt = new Date().toISOString();
        const entry = buildAuditTrailEntry({
          ...record,
          workspace,
          seq,
          prev_hash: head.hash,
          recorded_at: recordedAt,
        });
        const created = await this.store.createIfAbsent(Keys.trailKey(workspace, seq), entry);
        if (created) {
          await this.store.put(Keys.trailHeadKey(workspace), { seq, entry_hash: entry.entry_hash });
          return entry;
        }
        // lost race: loop, re-read head
      }
      throw new AuditTrailRaceError(`audit trail append lost race after 5 attempts (workspace ${workspace})`);
    } catch (e) {
      log("error", "audit trail append failed", { workspace, action: record.action, subject: record.subject, error: String(e) });
      fireAlert({ kind: "audit_trail_failure", message: `audit trail append failed: ${record.action} ${record.subject.id} (workspace ${workspace})`, details: { workspace, action: record.action, subject: record.subject, error: String(e) } });
      throw e;
    }
  }

  async list(workspace: string): Promise<AuditTrailEntry[]> {
    const prefix = Keys.trailPrefix(workspace);
    const keys = await this.store.keys(prefix);
    keys.sort((a, b) => artifactSeqOf(a) - artifactSeqOf(b));
    const loaded = await this.store.getMany<AuditTrailEntry>(keys);
    return loaded.filter((e): e is AuditTrailEntry => e !== null);
  }
}
