/**
 * SILO — Memory Index
 *
 * A searchable catalog of everything stored on 0G through SILO.
 * Solves the "I have a root hash but what IS it?" problem.
 *
 * Every store/write operation registers an entry in the index with:
 *   - The root hash (the 0G address)
 *   - Human-readable label
 *   - Tags for categorization
 *   - The channel it belongs to (if any)
 *   - Who stored it and when
 *   - Content type and size
 *
 * Agents can then SEARCH the index by label, tag, channel, author,
 * or time range — no need to know root hashes in advance.
 *
 * The index itself is periodically snapshotted to 0G for durability.
 * On startup, agents can load a snapshot to rebuild their local index.
 */

import { createHash } from "node:crypto";

export interface IndexEntry {
  rootHash: string;
  label: string;
  tags: string[];
  channel: string | null;
  authorId: string;
  contentType: "data" | "shared_memory" | "attestation_trace" | "snapshot" | "agent_descriptor" | "fix_record" | "heartbeat";
  size: number;
  createdAt: number;
  contentHash: string;
  description?: string;
  expiresAt?: number;
  metadata?: Record<string, any>;
}

export interface SearchQuery {
  label?: string;
  tags?: string[];
  channel?: string;
  authorId?: string;
  contentType?: IndexEntry["contentType"];
  fromTime?: number;
  toTime?: number;
  limit?: number;
}

export interface IndexSnapshot {
  snapshotAt: number;
  entryCount: number;
  entries: IndexEntry[];
  schemaVersion: number;
}

export class MemoryIndex {
  private entries: Map<string, IndexEntry> = new Map();
  private tagIndex: Map<string, Set<string>> = new Map();
  private channelIndex: Map<string, Set<string>> = new Map();
  private labelIndex: Map<string, Set<string>> = new Map();
  private authorIndex: Map<string, Set<string>> = new Map();

  /** Register a new entry in the index */
  register(entry: IndexEntry): void {
    this.entries.set(entry.rootHash, entry);

    for (const tag of entry.tags) {
      if (!this.tagIndex.has(tag)) this.tagIndex.set(tag, new Set());
      this.tagIndex.get(tag)!.add(entry.rootHash);
    }

    if (entry.channel) {
      if (!this.channelIndex.has(entry.channel)) this.channelIndex.set(entry.channel, new Set());
      this.channelIndex.get(entry.channel)!.add(entry.rootHash);
    }

    const labelLower = entry.label.toLowerCase();
    if (!this.labelIndex.has(labelLower)) this.labelIndex.set(labelLower, new Set());
    this.labelIndex.get(labelLower)!.add(entry.rootHash);

    if (!this.authorIndex.has(entry.authorId)) this.authorIndex.set(entry.authorId, new Set());
    this.authorIndex.get(entry.authorId)!.add(entry.rootHash);
  }

  /** Look up a single entry by root hash */
  lookup(rootHash: string): IndexEntry | undefined {
    return this.entries.get(rootHash);
  }

  /** Search the index with flexible query parameters */
  search(query: SearchQuery): IndexEntry[] {
    let candidateHashes: Set<string> | null = null;

    if (query.tags?.length) {
      const tagSets = query.tags
        .map(t => this.tagIndex.get(t))
        .filter((s): s is Set<string> => !!s);
      if (tagSets.length > 0) {
        candidateHashes = intersectSets(tagSets);
      } else {
        return [];
      }
    }

    if (query.channel) {
      const channelSet = this.channelIndex.get(query.channel);
      if (!channelSet) return [];
      candidateHashes = candidateHashes ? intersectSets([candidateHashes, channelSet]) : new Set(channelSet);
    }

    if (query.authorId) {
      const authorSet = this.authorIndex.get(query.authorId);
      if (!authorSet) return [];
      candidateHashes = candidateHashes ? intersectSets([candidateHashes, authorSet]) : new Set(authorSet);
    }

    if (query.label) {
      const labelLower = query.label.toLowerCase();
      const exactMatch = this.labelIndex.get(labelLower);
      if (exactMatch) {
        candidateHashes = candidateHashes ? intersectSets([candidateHashes, exactMatch]) : new Set(exactMatch);
      } else {
        const fuzzyMatches = new Set<string>();
        for (const [label, hashes] of this.labelIndex) {
          if (label.includes(labelLower)) {
            for (const h of hashes) fuzzyMatches.add(h);
          }
        }
        if (fuzzyMatches.size === 0) return [];
        candidateHashes = candidateHashes ? intersectSets([candidateHashes, fuzzyMatches]) : fuzzyMatches;
      }
    }

    let results: IndexEntry[];
    if (candidateHashes) {
      results = Array.from(candidateHashes)
        .map(h => this.entries.get(h))
        .filter((e): e is IndexEntry => !!e);
    } else {
      results = Array.from(this.entries.values());
    }

    if (query.contentType) {
      results = results.filter(e => e.contentType === query.contentType);
    }
    if (query.fromTime) {
      results = results.filter(e => e.createdAt >= query.fromTime!);
    }
    if (query.toTime) {
      results = results.filter(e => e.createdAt <= query.toTime!);
    }

    results.sort((a, b) => b.createdAt - a.createdAt);

    const limit = query.limit ?? 50;
    return results.slice(0, limit);
  }

  /** Get all unique tags in the index */
  allTags(): string[] {
    return Array.from(this.tagIndex.keys()).sort();
  }

  /** Get all entries for a specific channel, ordered by time */
  channelEntries(channel: string): IndexEntry[] {
    const hashes = this.channelIndex.get(channel);
    if (!hashes) return [];
    return Array.from(hashes)
      .map(h => this.entries.get(h))
      .filter((e): e is IndexEntry => !!e)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  /** Get summary statistics */
  stats(): {
    totalEntries: number;
    uniqueTags: number;
    uniqueChannels: number;
    uniqueAuthors: number;
    byContentType: Record<string, number>;
  } {
    const byContentType: Record<string, number> = {};
    for (const entry of this.entries.values()) {
      byContentType[entry.contentType] = (byContentType[entry.contentType] ?? 0) + 1;
    }
    return {
      totalEntries: this.entries.size,
      uniqueTags: this.tagIndex.size,
      uniqueChannels: this.channelIndex.size,
      uniqueAuthors: this.authorIndex.size,
      byContentType,
    };
  }

  /** Export the full index as a snapshot (for persisting to 0G) */
  exportSnapshot(): IndexSnapshot {
    return {
      snapshotAt: Date.now(),
      entryCount: this.entries.size,
      entries: Array.from(this.entries.values()),
      schemaVersion: 1,
    };
  }

  /** Import a snapshot (for restoring from 0G) */
  importSnapshot(snapshot: IndexSnapshot): number {
    let imported = 0;
    for (const entry of snapshot.entries) {
      if (!this.entries.has(entry.rootHash)) {
        this.register(entry);
        imported++;
      }
    }
    return imported;
  }

  /** Remove expired entries */
  pruneExpired(): number {
    const now = Date.now();
    let pruned = 0;
    for (const [rootHash, entry] of this.entries) {
      if (entry.expiresAt && entry.expiresAt <= now) {
        this.removeEntry(rootHash);
        pruned++;
      }
    }
    return pruned;
  }

  private removeEntry(rootHash: string): void {
    const entry = this.entries.get(rootHash);
    if (!entry) return;

    this.entries.delete(rootHash);

    for (const tag of entry.tags) {
      this.tagIndex.get(tag)?.delete(rootHash);
    }
    if (entry.channel) {
      this.channelIndex.get(entry.channel)?.delete(rootHash);
    }
    this.labelIndex.get(entry.label.toLowerCase())?.delete(rootHash);
    this.authorIndex.get(entry.authorId)?.delete(rootHash);
  }

  get size(): number { return this.entries.size; }
}

function intersectSets(sets: Set<string>[]): Set<string> {
  if (sets.length === 0) return new Set();
  if (sets.length === 1) return new Set(sets[0]);

  const [smallest, ...rest] = [...sets].sort((a, b) => a.size - b.size);
  const result = new Set<string>();
  for (const item of smallest) {
    if (rest.every(s => s.has(item))) {
      result.add(item);
    }
  }
  return result;
}
