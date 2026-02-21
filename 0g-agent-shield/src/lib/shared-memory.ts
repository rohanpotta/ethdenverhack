/**
 * SILO — Shared Memory Bus
 *
 * Named channels backed by 0G Storage for real-time multi-agent communication.
 *
 * Design:
 *   - Each channel is a linked list of entries on 0G (each entry points to the previous via rootHash)
 *   - A coordinator layer (in-memory + WebSocket) provides instant pub/sub notifications
 *   - Periodic snapshots persist the full channel state to 0G for crash recovery
 *   - Any agent can create, join, write to, or read from a channel
 *
 * This transforms 0G from a static vault into a live shared memory bus.
 */

import { AgentVault, type StoreResult } from "./vault.js";
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
  metadata?: Record<string, any>;
}

export interface ChannelManifest {
  name: string;
  createdAt: number;
  createdBy: string;
  headRootHash: string | null;
  entryCount: number;
  subscribers: string[];
  snapshotRootHash: string | null;
  lastSnapshotAt: number | null;
}

export interface ChannelSubscription {
  channel: string;
  agentId: string;
  callback: (entry: MemoryEntry) => void;
}

export interface SharedMemoryConfig {
  snapshotThreshold: number;
}

const DEFAULT_CONFIG: SharedMemoryConfig = {
  snapshotThreshold: 10,
};

export class SharedMemoryBus {
  private vault: AgentVault;
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
  }

  /** Register a broadcast handler (e.g., Socket.IO emitter) for cross-process notifications */
  setBroadcastHandler(handler: (channel: string, entry: MemoryEntry) => void): void {
    this.onBroadcast = handler;
  }

  /**
   * Create a new named channel. Returns the manifest.
   * If the channel already exists, returns the existing manifest.
   */
  createChannel(name: string): ChannelManifest {
    if (this.channels.has(name)) {
      return this.channels.get(name)!;
    }

    const manifest: ChannelManifest = {
      name,
      createdAt: Date.now(),
      createdBy: this.agentId,
      headRootHash: null,
      entryCount: 0,
      subscribers: [this.agentId],
      snapshotRootHash: null,
      lastSnapshotAt: null,
    };

    this.channels.set(name, manifest);
    this.entries.set(name, []);
    this.subscriptions.set(name, []);
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
   * Write data to a channel. Encrypts and stores on 0G, then notifies all subscribers.
   * Each entry is linked to the previous one, forming an immutable chain on 0G.
   */
  async write(channel: string, data: string, metadata?: Record<string, any>): Promise<MemoryEntry> {
    if (!this.channels.has(channel)) {
      this.createChannel(channel);
    }

    const manifest = this.channels.get(channel)!;
    const prevRootHash = manifest.headRootHash;

    const envelope = JSON.stringify({
      channel,
      data,
      prevRootHash,
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
      metadata,
    };

    manifest.headRootHash = result.rootHash;
    manifest.entryCount++;

    this.entries.get(channel)!.push(entry);

    const subs = this.subscriptions.get(channel) ?? [];
    for (const sub of subs) {
      try { sub.callback(entry); } catch {}
    }

    this.onBroadcast?.(channel, entry);

    if (manifest.entryCount % this.config.snapshotThreshold === 0) {
      await this.snapshot(channel);
    }

    return entry;
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
   * Persist the full channel state as a snapshot on 0G.
   * This allows crash recovery — any agent can rebuild the channel from the snapshot.
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
        metadata: e.metadata,
      })),
      snapshotAt: Date.now(),
    });

    const result = await this.vault.store(snapshotData, `shm:snapshot:${channel}`);
    manifest.snapshotRootHash = result.rootHash;
    manifest.lastSnapshotAt = Date.now();
    return result.rootHash;
  }

  /**
   * Recover a channel by walking the linked list from a known head root hash.
   * Downloads and decrypts each entry from 0G, rebuilding the channel history.
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

    return recovered;
  }

  /**
   * Ingest an entry from another agent (received via WebSocket broadcast).
   * This keeps the local cache in sync without re-downloading from 0G.
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
