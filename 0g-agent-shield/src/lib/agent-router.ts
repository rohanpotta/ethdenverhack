/**
 * SILO — Agent Router
 *
 * Enables any agent to dynamically spin up sub-agents with:
 *   - Inherited shared memory context (via 0G root hashes)
 *   - A dedicated parent↔child communication channel
 *   - Configurable autonomy levels (supervised vs autonomous)
 *   - Result propagation back to the parent
 *
 * The router manages a tree of agent relationships and their communication
 * channels. Each sub-agent gets its own vault instance but shares memory
 * context with its parent through 0G-backed channels.
 *
 * Communication Flow:
 *   Parent spawns SubAgent → creates dedicated channel "agent:{parentId}:{childId}"
 *   Parent writes context to channel → SubAgent reads on startup
 *   SubAgent writes results to channel → Parent receives via subscription
 *   SubAgent can itself spawn further sub-agents (recursive)
 */

import { AgentVault, type VaultConfig } from "./vault.js";
import { SharedMemoryBus, type MemoryEntry } from "./shared-memory.js";
import { createHash } from "node:crypto";

export type AgentAutonomy = "supervised" | "autonomous";
export type AgentStatus = "initializing" | "running" | "waiting" | "completed" | "failed" | "terminated";

export interface SubAgentDescriptor {
  id: string;
  role: string;
  parentId: string;
  channelName: string;
  status: AgentStatus;
  autonomy: AgentAutonomy;
  createdAt: number;
  completedAt: number | null;
  contextRootHashes: string[];
  resultRootHash: string | null;
  metadata?: Record<string, any>;
}

export interface SpawnOptions {
  role: string;
  contextRootHashes?: string[];
  contextData?: string;
  autonomy?: AgentAutonomy;
  metadata?: Record<string, any>;
  onMessage?: (entry: MemoryEntry) => void;
  onComplete?: (result: SubAgentResult) => void;
}

export interface SubAgentResult {
  agentId: string;
  role: string;
  success: boolean;
  output: string;
  rootHash: string | null;
  duration: number;
  eventsProcessed: number;
}

export interface AgentMessage {
  type: "context" | "instruction" | "result" | "status" | "error";
  from: string;
  to: string;
  payload: string;
  timestamp: number;
}

export class AgentRouter {
  private vault: AgentVault;
  private sharedMemory: SharedMemoryBus;
  private agentId: string;
  private children: Map<string, SubAgentDescriptor> = new Map();
  private parentId: string | null = null;
  private messageHandlers: Map<string, (msg: AgentMessage) => void> = new Map();

  private onSpawn?: (descriptor: SubAgentDescriptor) => void;
  private onMessage?: (channel: string, msg: AgentMessage) => void;

  constructor(vault: AgentVault, sharedMemory: SharedMemoryBus) {
    this.vault = vault;
    this.sharedMemory = sharedMemory;
    this.agentId = vault.address;
  }

  get id(): string { return this.agentId; }

  /** Register handlers for external notifications (WebSocket, etc.) */
  setEventHandlers(handlers: {
    onSpawn?: (descriptor: SubAgentDescriptor) => void;
    onMessage?: (channel: string, msg: AgentMessage) => void;
  }): void {
    this.onSpawn = handlers.onSpawn;
    this.onMessage = handlers.onMessage;
  }

  /**
   * Spawn a sub-agent with shared context.
   *
   * Creates a dedicated communication channel and seeds it with context.
   * The sub-agent descriptor is returned immediately — the actual agent
   * execution happens asynchronously (driven by whoever picks up the descriptor).
   */
  async spawn(options: SpawnOptions): Promise<SubAgentDescriptor> {
    const childId = createHash("sha256")
      .update(`subagent:${this.agentId}:${options.role}:${Date.now()}:${Math.random()}`)
      .digest("hex")
      .slice(0, 16);

    const channelName = `agent:${this.agentId.slice(0, 8)}:${childId}`;
    this.sharedMemory.createChannel(channelName);

    const descriptor: SubAgentDescriptor = {
      id: childId,
      role: options.role,
      parentId: this.agentId,
      channelName,
      status: "initializing",
      autonomy: options.autonomy ?? "supervised",
      createdAt: Date.now(),
      completedAt: null,
      contextRootHashes: options.contextRootHashes ?? [],
      resultRootHash: null,
      metadata: options.metadata,
    };

    this.children.set(childId, descriptor);

    if (options.contextData) {
      await this.sendMessage(channelName, {
        type: "context",
        from: this.agentId,
        to: childId,
        payload: options.contextData,
        timestamp: Date.now(),
      });
    }

    if (options.contextRootHashes?.length) {
      await this.sendMessage(channelName, {
        type: "context",
        from: this.agentId,
        to: childId,
        payload: JSON.stringify({
          inheritedMemory: options.contextRootHashes,
          instruction: "Retrieve these root hashes from 0G to load shared context",
        }),
        timestamp: Date.now(),
      });
    }

    if (options.onMessage) {
      this.sharedMemory.subscribe(channelName, (entry) => {
        try {
          const msg: AgentMessage = JSON.parse(entry.data);
          if (msg.from !== this.agentId) {
            options.onMessage!(entry);
          }
        } catch {}
      });
    }

    descriptor.status = "running";
    this.onSpawn?.(descriptor);

    const descriptorData = JSON.stringify(descriptor);
    const stored = await this.vault.store(descriptorData, `spawn:${options.role}`);

    await this.sharedMemory.write("silo:agents", JSON.stringify({
      event: "agent_spawned",
      descriptor: { ...descriptor, storedAt: stored.rootHash },
    }));

    return descriptor;
  }

  /** Send a message to a sub-agent (or parent) via their shared channel */
  async sendMessage(channelName: string, message: AgentMessage): Promise<MemoryEntry> {
    const entry = await this.sharedMemory.write(channelName, JSON.stringify(message), {
      messageType: message.type,
      from: message.from,
      to: message.to,
    });

    this.onMessage?.(channelName, message);
    return entry;
  }

  /** Send an instruction to a specific sub-agent */
  async instruct(childId: string, instruction: string): Promise<MemoryEntry> {
    const child = this.children.get(childId);
    if (!child) throw new Error(`Sub-agent "${childId}" not found`);

    return this.sendMessage(child.channelName, {
      type: "instruction",
      from: this.agentId,
      to: childId,
      payload: instruction,
      timestamp: Date.now(),
    });
  }

  /** Report a result back to the parent (called by sub-agents) */
  async reportResult(result: SubAgentResult): Promise<void> {
    if (!this.parentId) return;

    const channelName = `agent:${this.parentId.slice(0, 8)}:${this.agentId.slice(0, 16)}`;

    const stored = await this.vault.store(JSON.stringify(result), `result:${result.role}`);

    await this.sendMessage(channelName, {
      type: "result",
      from: this.agentId,
      to: this.parentId,
      payload: JSON.stringify({ ...result, rootHash: stored.rootHash }),
      timestamp: Date.now(),
    });
  }

  /** Mark a sub-agent as completed */
  completeChild(childId: string, resultRootHash?: string): void {
    const child = this.children.get(childId);
    if (!child) return;
    child.status = "completed";
    child.completedAt = Date.now();
    if (resultRootHash) child.resultRootHash = resultRootHash;
  }

  /** Terminate a sub-agent */
  async terminateChild(childId: string, reason?: string): Promise<void> {
    const child = this.children.get(childId);
    if (!child) return;

    await this.sendMessage(child.channelName, {
      type: "instruction",
      from: this.agentId,
      to: childId,
      payload: JSON.stringify({ action: "terminate", reason }),
      timestamp: Date.now(),
    });

    child.status = "terminated";
    child.completedAt = Date.now();
  }

  /** Set this agent as a child of a parent */
  setParent(parentId: string): void {
    this.parentId = parentId;
  }

  /** List all sub-agents */
  listChildren(): SubAgentDescriptor[] {
    return Array.from(this.children.values());
  }

  /** Get a sub-agent's descriptor */
  getChild(childId: string): SubAgentDescriptor | undefined {
    return this.children.get(childId);
  }

  /** Get full agent tree status */
  status(): {
    agentId: string;
    parentId: string | null;
    childCount: number;
    children: SubAgentDescriptor[];
    channels: string[];
  } {
    const channels = Array.from(this.children.values()).map(c => c.channelName);
    return {
      agentId: this.agentId,
      parentId: this.parentId,
      childCount: this.children.size,
      children: this.listChildren(),
      channels,
    };
  }
}
