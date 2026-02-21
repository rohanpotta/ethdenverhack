/**
 * SILO — Shared Memory Bus
 *
 * Named channels backed by 0G Storage for real-time multi-agent communication.
 *
 * Design:
 *   - Each channel is a linked list of entries on 0G (each entry points to the previous via rootHash)
 *   - A coordinator layer provides channel locks and optimistic concurrency control
 *   - A memory index provides root hash discoverability (search by label, tag, channel, author)
 *   - Periodic snapshots persist the full channel state to 0G for crash recovery
 *   - Any agent can create, join, write to, or read from a channel
 *
 * Safe Write Protocol (when coordinator is attached):
 *   1. acquireLock(channel) → lockToken
 *   2. Read current head → {headRootHash, version}
 *   3. Upload to 0G with prevRootHash = headRootHash
 *   4. commitWrite(channel, newRootHash, version, lockToken)
 *   5. Coordinator validates → updates head → releases lock → broadcasts
 *
 * Without coordinator, writes are best-effort (backward compatible with v1).
 */

import { AgentVault, type StoreResult } from "./vault.js";
import { MemoryCoordinator, type WriteReceipt, type ConflictError, type LockError } from "./memory-coordinator.js";
import { MemoryIndex, type IndexEntry } from "./memory-index.js";
import { createHash } from "node:crypto";

export interface MemoryEntry {
  id: string;
  channel: string;
  authorId: string;
  timestamp: number;
  data: string;
  rootHash: string;
  prevRootHash: string | null;
  contentHash: string;
  version: number;
  metadata?: Record<string, any>;
}

export interface ChannelManifest {
  name: string;
  createdAt: number;
  createdBy: string;
  headRootHash: string | null;
  version: number;
  entryCount: number;
  subscribers: string[];
  snapshotRootHash: string | null;
  lastSnapshotAt: number | null;
  schema?: ChannelSchema;
}

export interface ChannelSchema {
  description: string;
  contentType?: string;
  tags?: string[];
  writableBy?: string[];
}

export interface ChannelSubscription {
  channel: string;
  agentId: string;
  callback: (entry: MemoryEntry) => void;
}

export interface SharedMemoryConfig {
  snapshotThreshold: number;
  useCoordinator: boolean;
  maxWriteRetries: number;
}

export type WriteResult =
  | { ok: true; entry: MemoryEntry }
  | { ok: false; error: ConflictError | LockError | { code: "ERROR"; message: string } };

const DEFAULT_CONFIG: SharedMemoryConfig = {
  snapshotThreshold: 10,
  useCoordinator: true,
  maxWriteRetries: 3,
};

export class SharedMemoryBus {
  private vault: AgentVault;
  private coordinator: MemoryCoordinator | null = null;
  private index: MemoryIndex;
  private channels: Map<string, ChannelManifest> = new Map();
  private entries: Map<string, MemoryEntry[]> = new Map();
  private subscriptions: Map<string, ChannelSubscription[]> = new Map();
  private config: SharedMemoryConfig;
  private agentId: string;

  private onBroadcast?: (channel: string, entry: MemoryEntry) => void;

  constructor(vault: AgentVault, config: Partial<SharedMemoryConfig> = {}) {
    this.vault = vault;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.agentId = vault.address;
    this.index = new MemoryIndex();
  }

  /** Attach a coordinator for multi-agent safety (run on the API server) */
  attachCoordinator(coordinator: MemoryCoordinator): void {
    this.coordinator = coordinator;
  }

  /** Get the memory index (for search, lookup, stats) */
  getIndex(): MemoryIndex { return this.index; }

  /** Get the coordinator (if attached) */
  getCoordinator(): MemoryCoordinator | null { return this.coordinator; }

  /** Register a broadcast handler (e.g., Socket.IO emitter) for cross-process notifications */
  setBroadcastHandler(handler: (channel: string, entry: MemoryEntry) => void): void {
    this.onBroadcast = handler;
  }

  /**
   * Create a new named channel with optional schema.
   * If the channel already exists, returns the existing manifest.
   */
  createChannel(name: string, schema?: ChannelSchema): ChannelManifest {
    if (this.channels.has(name)) {
      const existing = this.channels.get(name)!;
      if (schema && !existing.schema) existing.schema = schema;
      return existing;
    }

    const manifest: ChannelManifest = {
      name,
      createdAt: Date.now(),
      createdBy: this.agentId,
      headRootHash: null,
      version: 0,
      entryCount: 0,
      subscribers: [this.agentId],
      snapshotRootHash: null,
      lastSnapshotAt: null,
      schema,
    };

    this.channels.set(name, manifest);
    this.entries.set(name, []);
    this.subscriptions.set(name, []);

    this.coordinator?.ensureChannel(name);

    return manifest;
  }

  /** Subscribe to a channel. Callback fires on every new entry. */
  subscribe(channel: string, callback: (entry: MemoryEntry) => void): ChannelSubscription {
    if (!this.channels.has(channel)) {
      this.createChannel(channel);
    }

    const manifest = this.channels.get(channel)!;
    if (!manifest.subscribers.includes(this.agentId)) {
      manifest.subscribers.push(this.agentId);
    }

    const subscription: ChannelSubscription = {
      channel,
      agentId: this.agentId,
      callback,
    };

    this.subscriptions.get(channel)!.push(subscription);
    return subscription;
  }

  /** Unsubscribe from a channel */
  unsubscribe(subscription: ChannelSubscription): void {
    const subs = this.subscriptions.get(subscription.channel);
    if (!subs) return;
    const idx = subs.indexOf(subscription);
    if (idx !== -1) subs.splice(idx, 1);
  }

  /**
   * Write data to a channel with coordination.
   *
   * When a coordinator is attached:
   *   1. Acquires channel lock
   *   2. Reads current head + version
   *   3. Uploads to 0G with correct prevRootHash
   *   4. Commits via coordinator (validates version)
   *   5. Retries on conflict up to maxWriteRetries
   *
   * Without coordinator: best-effort write (v1 behavior).
   */
  async write(channel: string, data: string, metadata?: Record<string, any>): Promise<MemoryEntry> {
    if (!this.channels.has(channel)) {
      this.createChannel(channel);
    }

    if (this.coordinator && this.config.useCoordinator) {
      return this.coordinatedWrite(channel, data, metadata);
    }

    return this.uncoordinatedWrite(channel, data, metadata);
  }

  /**
   * Safe write with full coordination — locks, version checks, conflict retry.
   */
  private async coordinatedWrite(channel: string, data: string, metadata?: Record<string, any>): Promise<MemoryEntry> {
    const coordinator = this.coordinator!;
    let lastError: any;

    for (let attempt = 0; attempt < this.config.maxWriteRetries; attempt++) {
      const beginResult = coordinator.beginWrite(channel, this.agentId);
      if ("code" in beginResult) {
        if (attempt < this.config.maxWriteRetries - 1) {
          await sleep(100 * Math.pow(2, attempt));
          continue;
        }
        throw new Error(`Failed to acquire lock on "${channel}": ${beginResult.message}`);
      }

      const { head, lock } = beginResult;

      try {
        const envelope = JSON.stringify({
          channel,
          data,
          prevRootHash: head.headRootHash,
          version: head.version,
          authorId: this.agentId,
          timestamp: Date.now(),
          metadata,
        });

        const result = await this.vault.store(envelope, `shm:${channel}`);

        const commitResult = coordinator.commitWrite(
          channel,
          result.rootHash,
          head.headRootHash,
          head.version,
          this.agentId,
          lock.token,
        );

        if ("code" in commitResult) {
          lastError = new Error(commitResult.message);
          continue;
        }

        const entry: MemoryEntry = {
          id: createHash("sha256").update(`${channel}:${result.rootHash}`).digest("hex").slice(0, 16),
          channel,
          authorId: this.agentId,
          timestamp: Date.now(),
          data,
          rootHash: result.rootHash,
          prevRootHash: head.headRootHash,
          contentHash: result.contentHash,
          version: commitResult.version,
          metadata,
        };

        const manifest = this.channels.get(channel)!;
        manifest.headRootHash = result.rootHash;
        manifest.version = commitResult.version;
        manifest.entryCount++;

        this.entries.get(channel)!.push(entry);
        this.registerInIndex(entry, result);
        this.notifySubscribers(channel, entry);

        if (manifest.entryCount % this.config.snapshotThreshold === 0) {
          await this.snapshot(channel);
        }

        return entry;
      } catch (err) {
        coordinator.releaseLock(channel, lock.token);
        lastError = err;
        if (attempt < this.config.maxWriteRetries - 1) {
          await sleep(100 * Math.pow(2, attempt));
        }
      }
    }

    throw lastError ?? new Error(`Coordinated write to "${channel}" failed after ${this.config.maxWriteRetries} attempts`);
  }

  /** Best-effort write without coordination (backward compatible) */
  private async uncoordinatedWrite(channel: string, data: string, metadata?: Record<string, any>): Promise<MemoryEntry> {
    const manifest = this.channels.get(channel)!;
    const prevRootHash = manifest.headRootHash;

    const envelope = JSON.stringify({
      channel,
      data,
      prevRootHash,
      version: manifest.version,
      authorId: this.agentId,
      timestamp: Date.now(),
      metadata,
    });

    const result = await this.vault.store(envelope, `shm:${channel}`);

    const entry: MemoryEntry = {
      id: createHash("sha256").update(`${channel}:${result.rootHash}`).digest("hex").slice(0, 16),
      channel,
      authorId: this.agentId,
      timestamp: Date.now(),
      data,
      rootHash: result.rootHash,
      prevRootHash,
      contentHash: result.contentHash,
      version: ++manifest.version,
      metadata,
    };

    manifest.headRootHash = result.rootHash;
    manifest.entryCount++;

    this.entries.get(channel)!.push(entry);
    this.registerInIndex(entry, result);
    this.notifySubscribers(channel, entry);

    if (manifest.entryCount % this.config.snapshotThreshold === 0) {
      await this.snapshot(channel);
    }

    return entry;
  }

  private registerInIndex(entry: MemoryEntry, storeResult: StoreResult): void {
    const tags = [entry.channel, "shared_memory"];
    if (entry.metadata?.tags) tags.push(...entry.metadata.tags);

    this.index.register({
      rootHash: entry.rootHash,
      label: entry.metadata?.label ?? `shm:${entry.channel}`,
      tags,
      channel: entry.channel,
      authorId: entry.authorId,
      contentType: "shared_memory",
      size: storeResult.size,
      createdAt: entry.timestamp,
      contentHash: entry.contentHash,
      metadata: entry.metadata,
    });
  }

  private notifySubscribers(channel: string, entry: MemoryEntry): void {
    const subs = this.subscriptions.get(channel) ?? [];
    for (const sub of subs) {
      try { sub.callback(entry); } catch {}
    }
    this.onBroadcast?.(channel, entry);
  }

  /**
   * Read the latest N entries from a channel (from local cache).
   * For full history recovery from 0G, use `recoverChannel()`.
   */
  read(channel: string, limit = 50): MemoryEntry[] {
    const entries = this.entries.get(channel) ?? [];
    return entries.slice(-limit);
  }

  /** Read a specific entry from 0G by its root hash */
  async readFromStorage(rootHash: string): Promise<{ data: string; prevRootHash: string | null }> {
    const raw = await this.vault.retrieve(rootHash, "shm:read");
    const envelope = JSON.parse(raw);
    return {
      data: envelope.data,
      prevRootHash: envelope.prevRootHash,
    };
  }

  /**
   * Search the memory index. Agents use this to discover root hashes
   * without knowing them in advance.
   */
  search(query: { label?: string; tags?: string[]; channel?: string; authorId?: string; contentType?: IndexEntry["contentType"]; limit?: number }): IndexEntry[] {
    return this.index.search(query);
  }

  /** Look up what a specific root hash contains */
  lookupRootHash(rootHash: string): IndexEntry | undefined {
    return this.index.lookup(rootHash);
  }

  /**
   * Persist the full channel state as a snapshot on 0G.
   */
  async snapshot(channel: string): Promise<string> {
    const manifest = this.channels.get(channel);
    if (!manifest) throw new Error(`Channel "${channel}" not found`);

    const entries = this.entries.get(channel) ?? [];
    const snapshotData = JSON.stringify({
      manifest,
      entries: entries.map(e => ({
        id: e.id,
        rootHash: e.rootHash,
        prevRootHash: e.prevRootHash,
        authorId: e.authorId,
        timestamp: e.timestamp,
        contentHash: e.contentHash,
        version: e.version,
        metadata: e.metadata,
      })),
      snapshotAt: Date.now(),
    });

    const result = await this.vault.store(snapshotData, `shm:snapshot:${channel}`);
    manifest.snapshotRootHash = result.rootHash;
    manifest.lastSnapshotAt = Date.now();

    this.index.register({
      rootHash: result.rootHash,
      label: `snapshot:${channel}`,
      tags: [channel, "snapshot"],
      channel,
      authorId: this.agentId,
      contentType: "snapshot",
      size: result.size,
      createdAt: Date.now(),
      contentHash: result.contentHash,
    });

    return result.rootHash;
  }

  /**
   * Recover a channel by walking the linked list from a known head root hash.
   */
  async recoverChannel(channel: string, headRootHash: string, maxDepth = 100): Promise<MemoryEntry[]> {
    const recovered: MemoryEntry[] = [];
    let currentHash: string | null = headRootHash;
    let depth = 0;

    while (currentHash && depth < maxDepth) {
      const { data, prevRootHash } = await this.readFromStorage(currentHash);

      recovered.unshift({
        id: createHash("sha256").update(`${channel}:${currentHash}`).digest("hex").slice(0, 16),
        channel,
        authorId: "recovered",
        timestamp: Date.now(),
        data,
        rootHash: currentHash,
        prevRootHash,
        contentHash: createHash("sha256").update(data).digest("hex"),
        version: depth,
      });

      currentHash = prevRootHash;
      depth++;
    }

    if (!this.channels.has(channel)) {
      this.createChannel(channel);
    }
    this.entries.set(channel, recovered);
    const manifest = this.channels.get(channel)!;
    manifest.headRootHash = headRootHash;
    manifest.entryCount = recovered.length;
    manifest.version = recovered.length;

    return recovered;
  }

  /**
   * Ingest an entry from another agent (received via WebSocket broadcast).
   * Keeps the local cache in sync without re-downloading from 0G.
   */
  ingestRemoteEntry(entry: MemoryEntry): void {
    if (!this.channels.has(entry.channel)) {
      this.createChannel(entry.channel);
    }

    const entries = this.entries.get(entry.channel)!;
    if (entries.some(e => e.rootHash === entry.rootHash)) return;

    entries.push(entry);

    const manifest = this.channels.get(entry.channel)!;
    manifest.headRootHash = entry.rootHash;
    manifest.entryCount = entries.length;
    if (entry.version > manifest.version) manifest.version = entry.version;

    const subs = this.subscriptions.get(entry.channel) ?? [];
    for (const sub of subs) {
      try { sub.callback(entry); } catch {}
    }
  }

  /** List all known channels */
  listChannels(): ChannelManifest[] {
    return Array.from(this.channels.values());
  }

  /** Get a channel's manifest */
  getChannel(name: string): ChannelManifest | undefined {
    return this.channels.get(name);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
