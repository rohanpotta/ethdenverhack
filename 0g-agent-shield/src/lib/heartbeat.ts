/**
 * SILO — Heartbeat Daemon
 *
 * A cron-like scheduler for autonomous agent operation.
 *
 * When a user enables "fully autonomous" mode, the heartbeat daemon:
 *   1. Periodically checks agent health (storage connectivity, balance, session state)
 *   2. Runs diagnostic tasks and pushes fixes automatically
 *   3. Auto-commits attestation sessions at configurable intervals
 *   4. Syncs shared memory channels with other agents
 *   5. Stores heartbeat records on 0G for audit trail
 *
 * Inspired by clawdbots' heartbeat pattern — adapted for 0G-backed agent orchestration.
 */

import { AgentVault } from "./vault.js";
import { SharedMemoryBus, type MemoryEntry } from "./shared-memory.js";
import { createHash } from "node:crypto";

export type TaskType = "health_check" | "diagnostic" | "auto_fix" | "session_commit" | "memory_sync" | "custom";

export interface HeartbeatTask {
  name: string;
  type: TaskType;
  intervalMs: number;
  handler: (ctx: TaskContext) => Promise<TaskResult>;
  enabled: boolean;
  lastRunAt: number | null;
  runCount: number;
}

export interface TaskContext {
  vault: AgentVault;
  sharedMemory: SharedMemoryBus;
  heartbeatId: string;
  autonomousMode: boolean;
  taskHistory: TaskResult[];
}

export interface TaskResult {
  taskName: string;
  taskType: TaskType;
  success: boolean;
  timestamp: number;
  duration: number;
  output?: string;
  error?: string;
  fixApplied?: boolean;
  rootHash?: string;
}

export interface HeartbeatRecord {
  heartbeatId: string;
  agentId: string;
  timestamp: number;
  sequenceNumber: number;
  tasksRun: TaskResult[];
  autonomousMode: boolean;
  uptime: number;
}

export interface HeartbeatConfig {
  autonomousMode: boolean;
  baseIntervalMs: number;
  maxHistorySize: number;
  persistHeartbeats: boolean;
  heartbeatChannel: string;
  onBeat?: (record: HeartbeatRecord) => void;
  onTaskComplete?: (result: TaskResult) => void;
  onError?: (error: Error, task: HeartbeatTask) => void;
}

const DEFAULT_CONFIG: HeartbeatConfig = {
  autonomousMode: false,
  baseIntervalMs: 30_000,
  maxHistorySize: 500,
  persistHeartbeats: true,
  heartbeatChannel: "silo:heartbeat",
};

export class HeartbeatDaemon {
  private vault: AgentVault;
  private sharedMemory: SharedMemoryBus;
  private config: HeartbeatConfig;
  private tasks: Map<string, HeartbeatTask> = new Map();
  private taskTimers: Map<string, ReturnType<typeof setInterval>> = new Map();
  private running = false;
  private heartbeatId: string;
  private sequenceNumber = 0;
  private startedAt: number | null = null;
  private taskHistory: TaskResult[] = [];
  private mainTimer: ReturnType<typeof setInterval> | null = null;

  constructor(vault: AgentVault, sharedMemory: SharedMemoryBus, config: Partial<HeartbeatConfig> = {}) {
    this.vault = vault;
    this.sharedMemory = sharedMemory;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.heartbeatId = createHash("sha256")
      .update(`heartbeat:${vault.address}:${Date.now()}:${Math.random()}`)
      .digest("hex")
      .slice(0, 16);
  }

  get id(): string { return this.heartbeatId; }
  get isRunning(): boolean { return this.running; }
  get isAutonomous(): boolean { return this.config.autonomousMode; }

  /** Register a task with the heartbeat daemon */
  registerTask(task: Omit<HeartbeatTask, "lastRunAt" | "runCount">): void {
    this.tasks.set(task.name, {
      ...task,
      lastRunAt: null,
      runCount: 0,
    });
  }

  /** Enable or disable autonomous mode at runtime */
  setAutonomousMode(enabled: boolean): void {
    this.config.autonomousMode = enabled;
  }

  /** Register the default set of tasks for autonomous operation */
  registerDefaultTasks(): void {
    this.registerTask({
      name: "health_check",
      type: "health_check",
      intervalMs: 30_000,
      enabled: true,
      handler: async (ctx) => {
        const balance = await ctx.vault.getBalance();
        const balanceNum = parseFloat(balance);
        return {
          taskName: "health_check",
          taskType: "health_check",
          success: balanceNum > 0,
          timestamp: Date.now(),
          duration: 0,
          output: JSON.stringify({
            balance,
            sessionId: ctx.vault.sessionId,
            agentAddress: ctx.vault.address,
            lowBalance: balanceNum < 0.01,
          }),
        };
      },
    });

    this.registerTask({
      name: "session_auto_commit",
      type: "session_commit",
      intervalMs: 300_000,
      enabled: true,
      handler: async (ctx) => {
        if (!ctx.autonomousMode) {
          return {
            taskName: "session_auto_commit",
            taskType: "session_commit",
            success: true,
            timestamp: Date.now(),
            duration: 0,
            output: "Skipped — not in autonomous mode",
          };
        }

        const summary = ctx.vault.sessionSummary();
        if (summary.includes("Events:  0")) {
          return {
            taskName: "session_auto_commit",
            taskType: "session_commit",
            success: true,
            timestamp: Date.now(),
            duration: 0,
            output: "Skipped — no events to commit",
          };
        }

        const result = await ctx.vault.commitSession();
        return {
          taskName: "session_auto_commit",
          taskType: "session_commit",
          success: true,
          timestamp: Date.now(),
          duration: 0,
          output: JSON.stringify(result),
          rootHash: result.traceRootHash,
        };
      },
    });

    this.registerTask({
      name: "memory_sync",
      type: "memory_sync",
      intervalMs: 15_000,
      enabled: true,
      handler: async (ctx) => {
        const channels = ctx.sharedMemory.listChannels();
        return {
          taskName: "memory_sync",
          taskType: "memory_sync",
          success: true,
          timestamp: Date.now(),
          duration: 0,
          output: JSON.stringify({
            channelCount: channels.length,
            channels: channels.map(c => ({
              name: c.name,
              entries: c.entryCount,
              subscribers: c.subscribers.length,
            })),
          }),
        };
      },
    });
  }

  /**
   * Start the heartbeat daemon. Begins running all registered tasks on their intervals.
   */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.startedAt = Date.now();

    for (const [name, task] of this.tasks) {
      if (!task.enabled) continue;

      const timer = setInterval(async () => {
        await this.executeTask(task);
      }, task.intervalMs);

      this.taskTimers.set(name, timer);
    }

    this.mainTimer = setInterval(async () => {
      await this.beat();
    }, this.config.baseIntervalMs);

    this.sharedMemory.createChannel(this.config.heartbeatChannel);
  }

  /** Stop the heartbeat daemon */
  stop(): void {
    if (!this.running) return;
    this.running = false;

    for (const timer of this.taskTimers.values()) {
      clearInterval(timer);
    }
    this.taskTimers.clear();

    if (this.mainTimer) {
      clearInterval(this.mainTimer);
      this.mainTimer = null;
    }
  }

  private async executeTask(task: HeartbeatTask): Promise<TaskResult> {
    const startTime = Date.now();
    let result: TaskResult;

    try {
      const ctx: TaskContext = {
        vault: this.vault,
        sharedMemory: this.sharedMemory,
        heartbeatId: this.heartbeatId,
        autonomousMode: this.config.autonomousMode,
        taskHistory: this.taskHistory,
      };

      result = await task.handler(ctx);
      result.duration = Date.now() - startTime;
    } catch (error: any) {
      result = {
        taskName: task.name,
        taskType: task.type,
        success: false,
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        error: error.message,
      };
      this.config.onError?.(error, task);
    }

    task.lastRunAt = Date.now();
    task.runCount++;

    this.taskHistory.push(result);
    if (this.taskHistory.length > this.config.maxHistorySize) {
      this.taskHistory.shift();
    }

    this.config.onTaskComplete?.(result);
    return result;
  }

  /** The main heartbeat — runs on the base interval */
  private async beat(): Promise<void> {
    this.sequenceNumber++;

    const record: HeartbeatRecord = {
      heartbeatId: this.heartbeatId,
      agentId: this.vault.address,
      timestamp: Date.now(),
      sequenceNumber: this.sequenceNumber,
      tasksRun: this.taskHistory.slice(-10),
      autonomousMode: this.config.autonomousMode,
      uptime: this.startedAt ? Date.now() - this.startedAt : 0,
    };

    this.config.onBeat?.(record);

    if (this.config.persistHeartbeats && this.config.autonomousMode) {
      try {
        await this.sharedMemory.write(
          this.config.heartbeatChannel,
          JSON.stringify(record),
          { type: "heartbeat", seq: this.sequenceNumber }
        );
      } catch {}
    }
  }

  /** Get the current heartbeat status */
  status(): {
    running: boolean;
    autonomous: boolean;
    heartbeatId: string;
    uptime: number;
    sequenceNumber: number;
    registeredTasks: { name: string; type: TaskType; enabled: boolean; lastRunAt: number | null; runCount: number }[];
    recentResults: TaskResult[];
  } {
    return {
      running: this.running,
      autonomous: this.config.autonomousMode,
      heartbeatId: this.heartbeatId,
      uptime: this.startedAt ? Date.now() - this.startedAt : 0,
      sequenceNumber: this.sequenceNumber,
      registeredTasks: Array.from(this.tasks.values()).map(t => ({
        name: t.name,
        type: t.type,
        enabled: t.enabled,
        lastRunAt: t.lastRunAt,
        runCount: t.runCount,
      })),
      recentResults: this.taskHistory.slice(-20),
    };
  }
}
