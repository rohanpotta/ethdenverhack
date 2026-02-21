import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MemoryIndex, type IndexEntry } from "../lib/memory-index.js";

function entry(overrides: Partial<IndexEntry> = {}): IndexEntry {
  return {
    rootHash: "0x" + Math.random().toString(16).slice(2, 10),
    label: "default-entry",
    tags: ["default"],
    channel: null,
    authorId: "agent-a",
    contentType: "data",
    size: 123,
    createdAt: Date.now(),
    contentHash: "hash-default",
    ...overrides,
  };
}

describe("MemoryIndex", () => {
  it("registers and looks up entries by root hash", () => {
    const index = new MemoryIndex();
    const e = entry({ rootHash: "0xabc", label: "patient-record" });
    index.register(e);

    const found = index.lookup("0xabc");
    assert.ok(found);
    assert.equal(found?.label, "patient-record");
  });

  it("searches by intersected tags", () => {
    const index = new MemoryIndex();
    index.register(entry({ rootHash: "0x1", label: "alpha", tags: ["a", "b"] }));
    index.register(entry({ rootHash: "0x2", label: "beta", tags: ["a"] }));
    index.register(entry({ rootHash: "0x3", label: "gamma", tags: ["b"] }));

    const results = index.search({ tags: ["a", "b"] });
    assert.equal(results.length, 1);
    assert.equal(results[0].rootHash, "0x1");
  });

  it("supports fuzzy label search when no exact match exists", () => {
    const index = new MemoryIndex();
    index.register(entry({ rootHash: "0x1", label: "customer-onboarding-notes" }));
    index.register(entry({ rootHash: "0x2", label: "incident-log" }));

    const results = index.search({ label: "onboarding" });
    assert.equal(results.length, 1);
    assert.equal(results[0].rootHash, "0x1");
  });

  it("filters by channel, author, content type, time window and limit", () => {
    const index = new MemoryIndex();
    const now = Date.now();
    index.register(entry({
      rootHash: "0x1",
      label: "doc-1",
      channel: "app:docs",
      authorId: "agent-a",
      contentType: "shared_memory",
      createdAt: now - 2000,
    }));
    index.register(entry({
      rootHash: "0x2",
      label: "doc-2",
      channel: "app:docs",
      authorId: "agent-a",
      contentType: "shared_memory",
      createdAt: now - 1000,
    }));
    index.register(entry({
      rootHash: "0x3",
      label: "doc-3",
      channel: "app:backend",
      authorId: "agent-b",
      contentType: "data",
      createdAt: now,
    }));

    const results = index.search({
      channel: "app:docs",
      authorId: "agent-a",
      contentType: "shared_memory",
      fromTime: now - 3000,
      toTime: now - 500,
      limit: 1,
    });

    assert.equal(results.length, 1);
    assert.equal(results[0].rootHash, "0x2");
  });

  it("returns channel entries ordered by time ascending", () => {
    const index = new MemoryIndex();
    const now = Date.now();
    index.register(entry({ rootHash: "0x1", channel: "app:docs", createdAt: now - 2000 }));
    index.register(entry({ rootHash: "0x2", channel: "app:docs", createdAt: now - 1000 }));
    index.register(entry({ rootHash: "0x3", channel: "app:docs", createdAt: now }));

    const entries = index.channelEntries("app:docs");
    assert.deepEqual(entries.map(e => e.rootHash), ["0x1", "0x2", "0x3"]);
  });

  it("produces accurate stats summary", () => {
    const index = new MemoryIndex();
    index.register(entry({ rootHash: "0x1", tags: ["a", "b"], channel: "c1", authorId: "agent-a", contentType: "data" }));
    index.register(entry({ rootHash: "0x2", tags: ["b"], channel: "c2", authorId: "agent-b", contentType: "shared_memory" }));

    const stats = index.stats();
    assert.equal(stats.totalEntries, 2);
    assert.equal(stats.uniqueTags, 2);
    assert.equal(stats.uniqueChannels, 2);
    assert.equal(stats.uniqueAuthors, 2);
    assert.equal(stats.byContentType.data, 1);
    assert.equal(stats.byContentType.shared_memory, 1);
  });

  it("exports and imports snapshots without duplicating existing entries", () => {
    const source = new MemoryIndex();
    source.register(entry({ rootHash: "0x1", label: "first" }));
    source.register(entry({ rootHash: "0x2", label: "second" }));

    const snapshot = source.exportSnapshot();
    assert.equal(snapshot.entryCount, 2);
    assert.equal(snapshot.schemaVersion, 1);

    const target = new MemoryIndex();
    const importedFirst = target.importSnapshot(snapshot);
    const importedSecond = target.importSnapshot(snapshot);

    assert.equal(importedFirst, 2);
    assert.equal(importedSecond, 0);
    assert.equal(target.size, 2);
  });

  it("prunes expired entries and keeps non-expired entries", () => {
    const index = new MemoryIndex();
    const now = Date.now();
    index.register(entry({ rootHash: "0x-expired", expiresAt: now - 1 }));
    index.register(entry({ rootHash: "0x-live", expiresAt: now + 60_000 }));
    index.register(entry({ rootHash: "0x-no-expiry" }));

    const pruned = index.pruneExpired();
    assert.equal(pruned, 1);
    assert.equal(index.lookup("0x-expired"), undefined);
    assert.ok(index.lookup("0x-live"));
    assert.ok(index.lookup("0x-no-expiry"));
  });

  it("returns sorted unique tags", () => {
    const index = new MemoryIndex();
    index.register(entry({ rootHash: "0x1", tags: ["zeta", "alpha"] }));
    index.register(entry({ rootHash: "0x2", tags: ["beta"] }));
    assert.deepEqual(index.allTags(), ["alpha", "beta", "zeta"]);
  });
});
