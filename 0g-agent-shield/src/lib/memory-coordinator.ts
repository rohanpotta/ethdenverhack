/**
 * SILO — Memory Coordinator
 *
 * Solves the multi-agent coordination problem for shared memory:
 *
 *   1. Channel Locks — Prevents concurrent writes to the same channel.
 *      Agents acquire a lock before writing, release after. TTL-based
 *      expiry prevents deadlocks from crashed agents.
 *
 *   2. Optimistic Concurrency — Every write must include the expected
 *      prevRootHash. If another agent wrote in between, the write is
 *      rejected with a CONFLICT error. The agent must re-read and retry.
 *
 *   3. Fork Detection — If two agents somehow both write with the same
 *      prevRootHash (e.g., lock wasn't used), the coordinator detects
 *      the fork and flags it for resolution.
 *
 *   4. Version Vector — Each channel tracks a monotonic version counter.
 *      Agents include the version they read from, enabling the server
 *      to detect stale writes without comparing root hashes.
 *
 * The coordinator runs on the API server (single source of truth).
 * Agents interact with it via REST or WebSocket before writing to 0G.
 *
 * Protocol:
 *   1. Agent calls acquireLock(channel) → gets lockToken
 *   2. Agent reads current head via getHead(channel) → {headRootHash, version}
 *   3. Agent writes to 0G with prevRootHash = headRootHash
 *   4. Agent calls commitWrite(channel, newRootHash, expectedVersion, lockToken)
 *   5. Coordinator validates version match → updates head → releases lock
 *   6. Coordinator broadcasts update to all subscribers
 */

import { createHash } from "node:crypto";

export interface ChannelLock {
  channel: string;
  holderId: string;
  token: string;
  acquiredAt: number;
  ttlMs: number;
  expiresAt: number;
}

export interface ChannelHead {
  channel: string;
  headRootHash: string | null;
  version: number;
  lastWriterId: string | null;
  lastWriteAt: number | null;
}

export interface WriteReceipt {
  channel: string;
  rootHash: string;
  prevRootHash: string | null;
  version: number;
  writerId: string;
  timestamp: number;
}

export interface ForkRecord {
  channel: string;
  detectedAt: number;
  branchA: { rootHash: string; writerId: string; version: number };
  branchB: { rootHash: string; writerId: string; version: number };
  commonAncestor: string | null;
  resolved: boolean;
  resolution?: "keep_a" | "keep_b" | "merge";
}

export type ConflictError = {
  code: "CONFLICT";
  message: string;
  currentVersion: number;
  currentHead: string | null;
  yourVersion: number;
};

export type LockError = {
  code: "LOCKED";
  message: string;
  holder: string;
  expiresAt: number;
};

export interface CoordinatorConfig {
  defaultLockTtlMs: number;
  maxLockTtlMs: number;
  enableForkDetection: boolean;
  onForkDetected?: (fork: ForkRecord) => void;
  onHeadUpdated?: (receipt: WriteReceipt) => void;
}

const DEFAULT_CONFIG: CoordinatorConfig = {
  defaultLockTtlMs: 30_000,
  maxLockTtlMs: 120_000,
  enableForkDetection: true,
};

export class MemoryCoordinator {
  private locks: Map<string, ChannelLock> = new Map();
  private heads: Map<string, ChannelHead> = new Map();
  private writeLog: Map<string, WriteReceipt[]> = new Map();
  private forks: ForkRecord[] = [];
  private config: CoordinatorConfig;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<CoordinatorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cleanupTimer = setInterval(() => this.cleanExpiredLocks(), 5_000);
  }

  /** Initialize or get the tracked head for a channel */
  ensureChannel(channel: string): ChannelHead {
    if (!this.heads.has(channel)) {
      this.heads.set(channel, {
        channel,
        headRootHash: null,
        version: 0,
        lastWriterId: null,
        lastWriteAt: null,
      });
      this.writeLog.set(channel, []);
    }
    return this.heads.get(channel)!;
  }

  /**
   * Acquire a write lock on a channel.
   * Returns a lock token that must be passed to commitWrite.
   * Rejects if channel is already locked by another agent.
   */
  acquireLock(channel: string, agentId: string, ttlMs?: number): ChannelLock | LockError {
    this.cleanExpiredLocks();
    this.ensureChannel(channel);

    const existing = this.locks.get(channel);
    if (existing && existing.holderId !== agentId) {
      return {
        code: "LOCKED",
        message: `Channel "${channel}" is locked by ${existing.holderId.slice(0, 8)}... (expires in ${Math.round((existing.expiresAt - Date.now()) / 1000)}s)`,
        holder: existing.holderId,
        expiresAt: existing.expiresAt,
      };
    }

    if (existing && existing.holderId === agentId) {
      existing.expiresAt = Date.now() + (ttlMs ?? this.config.defaultLockTtlMs);
      return existing;
    }

    const effectiveTtl = Math.min(ttlMs ?? this.config.defaultLockTtlMs, this.config.maxLockTtlMs);
    const lock: ChannelLock = {
      channel,
      holderId: agentId,
      token: createHash("sha256")
        .update(`lock:${channel}:${agentId}:${Date.now()}:${Math.random()}`)
        .digest("hex")
        .slice(0, 32),
      acquiredAt: Date.now(),
      ttlMs: effectiveTtl,
      expiresAt: Date.now() + effectiveTtl,
    };

    this.locks.set(channel, lock);
    return lock;
  }

  /** Release a lock (requires the token or the holder's agentId) */
  releaseLock(channel: string, tokenOrAgentId: string): boolean {
    const lock = this.locks.get(channel);
    if (!lock) return true;
    if (lock.token === tokenOrAgentId || lock.holderId === tokenOrAgentId) {
      this.locks.delete(channel);
      return true;
    }
    return false;
  }

  /** Check if a channel is locked and by whom */
  getLock(channel: string): ChannelLock | null {
    this.cleanExpiredLocks();
    return this.locks.get(channel) ?? null;
  }

  /** Get the current head of a channel (what agents read before writing) */
  getHead(channel: string): ChannelHead {
    return this.ensureChannel(channel);
  }

  /**
   * Commit a write to a channel.
   *
   * This is the critical coordination point:
   *   - Validates the lock token
   *   - Checks the expectedVersion matches current version (optimistic concurrency)
   *   - Detects forks if the prevRootHash doesn't match current head
   *   - Updates the head and increments version
   *   - Releases the lock
   *   - Returns a receipt
   */
  commitWrite(
    channel: string,
    newRootHash: string,
    prevRootHash: string | null,
    expectedVersion: number,
    writerId: string,
    lockToken?: string,
  ): WriteReceipt | ConflictError {
    const head = this.ensureChannel(channel);

    if (lockToken) {
      const lock = this.locks.get(channel);
      if (lock && lock.token !== lockToken && lock.holderId !== writerId) {
        return {
          code: "CONFLICT",
          message: `Invalid lock token for channel "${channel}"`,
          currentVersion: head.version,
          currentHead: head.headRootHash,
          yourVersion: expectedVersion,
        };
      }
    }

    if (expectedVersion !== head.version) {
      if (this.config.enableForkDetection && prevRootHash !== head.headRootHash) {
        const fork: ForkRecord = {
          channel,
          detectedAt: Date.now(),
          branchA: { rootHash: head.headRootHash ?? "null", writerId: head.lastWriterId ?? "unknown", version: head.version },
          branchB: { rootHash: newRootHash, writerId, version: expectedVersion },
          commonAncestor: prevRootHash,
          resolved: false,
        };
        this.forks.push(fork);
        this.config.onForkDetected?.(fork);
      }

      return {
        code: "CONFLICT",
        message: `Version mismatch on "${channel}": expected ${expectedVersion}, current is ${head.version}. Re-read and retry.`,
        currentVersion: head.version,
        currentHead: head.headRootHash,
        yourVersion: expectedVersion,
      };
    }

    head.headRootHash = newRootHash;
    head.version++;
    head.lastWriterId = writerId;
    head.lastWriteAt = Date.now();

    const receipt: WriteReceipt = {
      channel,
      rootHash: newRootHash,
      prevRootHash,
      version: head.version,
      writerId,
      timestamp: Date.now(),
    };

    const log = this.writeLog.get(channel)!;
    log.push(receipt);
    if (log.length > 200) log.shift();

    this.releaseLock(channel, writerId);

    this.config.onHeadUpdated?.(receipt);
    return receipt;
  }

  /**
   * Coordinated write — acquire lock, check version, commit, release.
   * This is the high-level "safe write" that agents should use.
   */
  beginWrite(channel: string, agentId: string): { head: ChannelHead; lock: ChannelLock } | LockError {
    const lockResult = this.acquireLock(channel, agentId);
    if ("code" in lockResult) return lockResult;
    const head = this.getHead(channel);
    return { head, lock: lockResult };
  }

  /** Get the write history for a channel */
  getWriteLog(channel: string, limit = 50): WriteReceipt[] {
    const log = this.writeLog.get(channel) ?? [];
    return log.slice(-limit);
  }

  /** Get all detected forks */
  getForks(channel?: string): ForkRecord[] {
    if (channel) return this.forks.filter(f => f.channel === channel);
    return [...this.forks];
  }

  /** Resolve a fork (mark it as handled) */
  resolveFork(channel: string, resolution: "keep_a" | "keep_b" | "merge", resolvedHead?: string): boolean {
    const fork = this.forks.find(f => f.channel === channel && !f.resolved);
    if (!fork) return false;

    fork.resolved = true;
    fork.resolution = resolution;

    if (resolvedHead) {
      const head = this.ensureChannel(channel);
      head.headRootHash = resolvedHead;
      head.version++;
    }

    return true;
  }

  /** List all channels with their coordination state */
  listChannels(): { head: ChannelHead; locked: boolean; lockHolder?: string }[] {
    return Array.from(this.heads.values()).map(head => {
      const lock = this.locks.get(head.channel);
      return {
        head,
        locked: !!lock,
        lockHolder: lock?.holderId,
      };
    });
  }

  private cleanExpiredLocks(): void {
    const now = Date.now();
    for (const [channel, lock] of this.locks) {
      if (lock.expiresAt <= now) {
        this.locks.delete(channel);
      }
    }
  }

  /** Shutdown the coordinator */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}
