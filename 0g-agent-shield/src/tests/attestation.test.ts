import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { AttestationSession } from "../lib/attestation.js";

describe("AttestationSession", () => {
  const AGENT_ADDR = "0xTestAgent1234567890";

  // ── Construction ──

  it("generates a unique session ID", () => {
    const a = new AttestationSession(AGENT_ADDR);
    const b = new AttestationSession(AGENT_ADDR);
    assert.notEqual(a.id, b.id);
  });

  it("session ID is 16 hex chars", () => {
    const session = new AttestationSession(AGENT_ADDR);
    assert.equal(session.id.length, 16);
    assert.match(session.id, /^[0-9a-f]{16}$/);
  });

  it("starts with zero events", () => {
    const session = new AttestationSession(AGENT_ADDR);
    assert.equal(session.count, 0);
  });

  // ── Recording events ──

  it("records an event and increments count", () => {
    const session = new AttestationSession(AGENT_ADDR);
    const event = session.record("store", "input-data", "output-hash", "label");
    assert.equal(session.count, 1);
    assert.equal(event.type, "store");
    assert.equal(event.metadata, "label");
  });

  it("hashes input and output (never stores plaintext)", () => {
    const session = new AttestationSession(AGENT_ADDR);
    const event = session.record("store", "secret-plaintext", "some-output");

    const expectedInputHash = createHash("sha256").update("secret-plaintext").digest("hex");
    const expectedOutputHash = createHash("sha256").update("some-output").digest("hex");

    assert.equal(event.inputHash, expectedInputHash);
    assert.equal(event.outputHash, expectedOutputHash);
  });

  it("records multiple event types", () => {
    const session = new AttestationSession(AGENT_ADDR);
    session.record("store", "a", "b");
    session.record("retrieve", "c", "d");
    session.record("tool_call", "e", "f");
    session.record("policy_check", "g", "h");
    assert.equal(session.count, 4);
  });

  it("event has a timestamp close to now", () => {
    const before = Date.now();
    const session = new AttestationSession(AGENT_ADDR);
    const event = session.record("store", "x", "y");
    const after = Date.now();
    assert.ok(event.timestamp >= before);
    assert.ok(event.timestamp <= after);
  });

  // ── Merkle root ──

  it("empty session produces a deterministic empty-session root", () => {
    const session = new AttestationSession(AGENT_ADDR);
    const root = session.computeMerkleRoot();
    const expected = createHash("sha256").update("empty-session").digest("hex");
    assert.equal(root, expected);
  });

  it("single event produces a valid 64-char hex root", () => {
    const session = new AttestationSession(AGENT_ADDR);
    session.record("store", "data", "hash");
    const root = session.computeMerkleRoot();
    assert.equal(root.length, 64);
    assert.match(root, /^[0-9a-f]{64}$/);
  });

  it("merkle root is deterministic for same events", () => {
    // Two sessions with identical events should produce the same root
    // (assuming same timestamps — we control that by recording in sequence)
    const session = new AttestationSession(AGENT_ADDR);
    session.record("store", "data", "hash");
    const root1 = session.computeMerkleRoot();
    const root2 = session.computeMerkleRoot();
    assert.equal(root1, root2);
  });

  it("different events produce different roots", () => {
    const s1 = new AttestationSession(AGENT_ADDR);
    s1.record("store", "data-a", "hash-a");

    const s2 = new AttestationSession(AGENT_ADDR);
    s2.record("store", "data-b", "hash-b");

    assert.notEqual(s1.computeMerkleRoot(), s2.computeMerkleRoot());
  });

  it("merkle root changes when events are added", () => {
    const session = new AttestationSession(AGENT_ADDR);
    session.record("store", "first", "out1");
    const root1 = session.computeMerkleRoot();

    session.record("retrieve", "second", "out2");
    const root2 = session.computeMerkleRoot();

    assert.notEqual(root1, root2);
  });

  it("handles odd number of leaves (duplicates last)", () => {
    const session = new AttestationSession(AGENT_ADDR);
    session.record("store", "a", "b");
    session.record("store", "c", "d");
    session.record("store", "e", "f");
    // 3 leaves → pair (1,2), then (3,3-dup) → 2 nodes → pair → 1 root
    const root = session.computeMerkleRoot();
    assert.equal(root.length, 64);
    assert.match(root, /^[0-9a-f]{64}$/);
  });

  it("handles power-of-2 leaves correctly", () => {
    const session = new AttestationSession(AGENT_ADDR);
    for (let i = 0; i < 4; i++) {
      session.record("store", `input-${i}`, `output-${i}`);
    }
    const root = session.computeMerkleRoot();
    assert.equal(root.length, 64);
  });

  it("handles large number of events (100)", () => {
    const session = new AttestationSession(AGENT_ADDR);
    for (let i = 0; i < 100; i++) {
      session.record("store", `input-${i}`, `output-${i}`);
    }
    assert.equal(session.count, 100);
    const root = session.computeMerkleRoot();
    assert.equal(root.length, 64);
  });

  // ── Finalize ──

  it("finalize returns a complete SessionAttestation", () => {
    const session = new AttestationSession(AGENT_ADDR);
    session.record("store", "data", "hash");
    session.record("retrieve", "hash", "data");

    const attestation = session.finalize();

    assert.equal(attestation.sessionId, session.id);
    assert.equal(attestation.agentAddress, AGENT_ADDR);
    assert.equal(attestation.eventCount, 2);
    assert.equal(attestation.events.length, 2);
    assert.ok(attestation.startedAt > 0);
    assert.ok(attestation.endedAt >= attestation.startedAt);
    assert.equal(attestation.merkleRoot.length, 64);
  });

  it("finalize returns a copy of events (not a reference)", () => {
    const session = new AttestationSession(AGENT_ADDR);
    session.record("store", "x", "y");
    const attestation = session.finalize();

    // Adding more events shouldn't affect the finalized attestation
    session.record("store", "a", "b");
    assert.equal(attestation.events.length, 1);
    assert.equal(session.count, 2);
  });

  it("finalize preserves event order", () => {
    const session = new AttestationSession(AGENT_ADDR);
    session.record("store", "first", "1");
    session.record("retrieve", "second", "2");
    session.record("tool_call", "third", "3");

    const attestation = session.finalize();
    assert.equal(attestation.events[0].type, "store");
    assert.equal(attestation.events[1].type, "retrieve");
    assert.equal(attestation.events[2].type, "tool_call");
  });

  // ── Summary ──

  it("summary includes session ID and event count", () => {
    const session = new AttestationSession(AGENT_ADDR);
    session.record("store", "data", "hash", "test-label");
    const summary = session.summary();

    assert.ok(summary.includes(session.id));
    assert.ok(summary.includes("Events:  1"));
    assert.ok(summary.includes("[store]"));
    assert.ok(summary.includes("test-label"));
  });

  it("summary works with no events", () => {
    const session = new AttestationSession(AGENT_ADDR);
    const summary = session.summary();
    assert.ok(summary.includes("Events:  0"));
    assert.ok(summary.includes("Event Log:"));
  });

  it("summary truncates agent address", () => {
    const session = new AttestationSession(AGENT_ADDR);
    const summary = session.summary();
    assert.ok(summary.includes(AGENT_ADDR.slice(0, 10)));
    assert.ok(summary.includes("..."));
  });
});
