/**
 * 0G Agent Shield — Attestation Layer
 *
 * Tracks every action an agent takes during a session:
 *   - What was stored (hash of plaintext, NOT the plaintext)
 *   - What was retrieved
 *   - What tools were called
 *
 * At session end, builds a Merkle root from all event hashes.
 * The full encrypted trace goes to 0G Storage.
 * The Merkle root is the public commitment — anyone can verify
 * "this agent did N things in this session" without seeing what.
 *
 * This is what makes 0g-agent-shield more than an encrypted storage wrapper.
 * It's verifiable agent behavior.
 */

import { createHash } from "node:crypto";

export interface AttestationEvent {
  type: "store" | "retrieve" | "tool_call" | "policy_check";
  timestamp: number;
  inputHash: string;   // SHA-256 of the input
  outputHash: string;  // SHA-256 of the output
  metadata?: string;   // optional context (tool name, etc.)
}

export interface SessionAttestation {
  sessionId: string;
  agentAddress: string;
  startedAt: number;
  endedAt: number;
  eventCount: number;
  merkleRoot: string;
  events: AttestationEvent[]; // full trace (will be encrypted before storage)
}

export class AttestationSession {
  private events: AttestationEvent[] = [];
  private sessionId: string;
  private agentAddress: string;
  private startedAt: number;

  constructor(agentAddress: string) {
    this.agentAddress = agentAddress;
    this.startedAt = Date.now();
    this.sessionId = createHash("sha256")
      .update(`${agentAddress}-${this.startedAt}-${Math.random()}`)
      .digest("hex")
      .slice(0, 16);
  }

  get id(): string {
    return this.sessionId;
  }

  get count(): number {
    return this.events.length;
  }

  /**
   * Record an agent action. Only hashes are stored in the event —
   * the actual content is never part of the attestation.
   */
  record(
    type: AttestationEvent["type"],
    input: string,
    output: string,
    metadata?: string
  ): AttestationEvent {
    const event: AttestationEvent = {
      type,
      timestamp: Date.now(),
      inputHash: createHash("sha256").update(input).digest("hex"),
      outputHash: createHash("sha256").update(output).digest("hex"),
      metadata,
    };
    this.events.push(event);
    return event;
  }

  /**
   * Build a Merkle root from all recorded events.
   * Uses simple pairwise SHA-256 hashing.
   * 
   * This root is the public commitment: it proves exactly how many
   * actions occurred and their order, without revealing content.
   */
  computeMerkleRoot(): string {
    if (this.events.length === 0) {
      return createHash("sha256").update("empty-session").digest("hex");
    }

    // Leaf nodes: hash of each event's combined hashes
    let leaves = this.events.map((e) =>
      createHash("sha256")
        .update(`${e.type}:${e.inputHash}:${e.outputHash}:${e.timestamp}`)
        .digest("hex")
    );

    // Build tree bottom-up
    while (leaves.length > 1) {
      const next: string[] = [];
      for (let i = 0; i < leaves.length; i += 2) {
        const left = leaves[i];
        const right = leaves[i + 1] ?? left; // duplicate last if odd
        next.push(
          createHash("sha256").update(left + right).digest("hex")
        );
      }
      leaves = next;
    }

    return leaves[0];
  }

  /**
   * Finalize the session and produce the attestation record.
   * This gets encrypted and stored on 0G.
   * The merkleRoot is the only thing that needs to be public.
   */
  finalize(): SessionAttestation {
    return {
      sessionId: this.sessionId,
      agentAddress: this.agentAddress,
      startedAt: this.startedAt,
      endedAt: Date.now(),
      eventCount: this.events.length,
      merkleRoot: this.computeMerkleRoot(),
      events: [...this.events], // copy
    };
  }

  /**
   * Produce a human-readable summary (for CLI/demo output).
   */
  summary(): string {
    const root = this.computeMerkleRoot();
    const lines = [
      `Session: ${this.sessionId}`,
      `Agent:   ${this.agentAddress.slice(0, 10)}...`,
      `Events:  ${this.events.length}`,
      `Root:    ${root.slice(0, 16)}...`,
      "",
      "Event Log:",
      ...this.events.map(
        (e, i) => `  ${i + 1}. [${e.type}] ${new Date(e.timestamp).toISOString()} — ${e.metadata ?? ""}`
      ),
    ];
    return lines.join("\n");
  }
}
