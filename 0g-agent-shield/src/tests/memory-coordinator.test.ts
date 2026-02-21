import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { MemoryCoordinator } from "../lib/memory-coordinator.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("MemoryCoordinator", () => {
  const instances: MemoryCoordinator[] = [];

  afterEach(() => {
    for (const c of instances) c.destroy();
    instances.length = 0;
  });

  it("acquires lock and blocks other agents until release", () => {
    const c = new MemoryCoordinator();
    instances.push(c);

    const lock = c.acquireLock("app:docs", "agent-a");
    assert.ok(!("code" in lock));

    const blocked = c.acquireLock("app:docs", "agent-b");
    assert.ok("code" in blocked);
    assert.equal(blocked.code, "LOCKED");

    const released = c.releaseLock("app:docs", "agent-a");
    assert.equal(released, true);

    const second = c.acquireLock("app:docs", "agent-b");
    assert.ok(!("code" in second));
  });

  it("expires lock after ttl and allows subsequent acquisition", async () => {
    const c = new MemoryCoordinator({ defaultLockTtlMs: 10, maxLockTtlMs: 50 });
    instances.push(c);

    const lock = c.acquireLock("app:frontend", "agent-a", 10);
    assert.ok(!("code" in lock));

    await sleep(30);

    const afterExpiry = c.acquireLock("app:frontend", "agent-b", 10);
    assert.ok(!("code" in afterExpiry));
  });

  it("commits write, increments version, updates head, and releases lock", () => {
    const c = new MemoryCoordinator();
    instances.push(c);

    const begin = c.beginWrite("app:backend", "agent-a");
    assert.ok(!("code" in begin));
    if ("code" in begin) return;

    const receipt = c.commitWrite(
      "app:backend",
      "0xnew",
      begin.head.headRootHash,
      begin.head.version,
      "agent-a",
      begin.lock.token,
    );

    assert.ok(!("code" in receipt));
    if ("code" in receipt) return;

    assert.equal(receipt.version, 1);
    assert.equal(c.getHead("app:backend").headRootHash, "0xnew");
    assert.equal(c.getHead("app:backend").version, 1);
    assert.equal(c.getLock("app:backend"), null);
  });

  it("returns conflict on stale expected version", () => {
    const c = new MemoryCoordinator();
    instances.push(c);

    const first = c.commitWrite("app:frontend", "0x1", null, 0, "agent-a");
    assert.ok(!("code" in first));

    const conflict = c.commitWrite("app:frontend", "0x2", "0x1", 0, "agent-b");
    assert.ok("code" in conflict);
    if (!("code" in conflict)) return;

    assert.equal(conflict.code, "CONFLICT");
    assert.equal(conflict.currentVersion, 1);
    assert.equal(conflict.currentHead, "0x1");
    assert.equal(conflict.yourVersion, 0);
  });

  it("detects fork on version mismatch with different previous root", () => {
    let forkDetected = 0;
    const c = new MemoryCoordinator({
      enableForkDetection: true,
      onForkDetected: () => { forkDetected++; },
    });
    instances.push(c);

    const first = c.commitWrite("app:frontend", "0x1", null, 0, "agent-a");
    assert.ok(!("code" in first));

    const conflict = c.commitWrite("app:frontend", "0xfork", "0xancestor", 0, "agent-b");
    assert.ok("code" in conflict);

    const forks = c.getForks("app:frontend");
    assert.equal(forks.length, 1);
    assert.equal(forkDetected, 1);
    assert.equal(forks[0].branchA.rootHash, "0x1");
    assert.equal(forks[0].branchB.rootHash, "0xfork");
    assert.equal(forks[0].resolved, false);
  });

  it("resolves fork and optionally advances channel head", () => {
    const c = new MemoryCoordinator({ enableForkDetection: true });
    instances.push(c);

    const first = c.commitWrite("app:frontend", "0x1", null, 0, "agent-a");
    assert.ok(!("code" in first));
    const conflict = c.commitWrite("app:frontend", "0xfork", "0xancestor", 0, "agent-b");
    assert.ok("code" in conflict);

    const resolved = c.resolveFork("app:frontend", "keep_b", "0xresolved");
    assert.equal(resolved, true);

    const head = c.getHead("app:frontend");
    assert.equal(head.headRootHash, "0xresolved");
    assert.equal(head.version, 2);

    const forks = c.getForks("app:frontend");
    assert.equal(forks[0].resolved, true);
    assert.equal(forks[0].resolution, "keep_b");
  });

  it("includes channel lock metadata in listChannels", () => {
    const c = new MemoryCoordinator();
    instances.push(c);

    const lock = c.acquireLock("app:docs", "agent-a");
    assert.ok(!("code" in lock));
    const channels = c.listChannels();
    const docs = channels.find(ch => ch.head.channel === "app:docs");
    assert.ok(docs);
    assert.equal(docs?.locked, true);
    assert.equal(docs?.lockHolder, "agent-a");
  });
});
