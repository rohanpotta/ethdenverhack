/**
 * SILO — Autonomy Engine
 *
 * The orchestrator that ties heartbeat + shared memory + agent routing into
 * a fully autonomous build pipeline.
 *
 * When enabled, the engine:
 *   1. Monitors the system via heartbeat tasks
 *   2. Detects issues through diagnostic handlers
 *   3. Spawns sub-agents to investigate and fix problems
 *   4. Pushes fixes through the attestation pipeline
 *   5. Persists all decisions and outcomes to shared memory on 0G
 *
 * The autonomy loop:
 *   DETECT → PLAN → SPAWN → FIX → ATTEST → REPEAT
 *
 * All autonomous actions are fully attested — the Merkle tree captures
 * every decision, fix, and outcome. Nothing happens in the dark.
 */

import { AgentVault } from "./vault.js";
import { SharedMemoryBus } from "./shared-memory.js";
import { HeartbeatDaemon, type TaskContext, type TaskResult, type HeartbeatRecord } from "./heartbeat.js";
import { AgentRouter, type SubAgentDescriptor, type SubAgentResult } from "./agent-router.js";
import { createHash } from "node:crypto";

export type AutonomyLevel = "off" | "monitor" | "suggest" | "autonomous";

export interface AutonomyConfig {
  level: AutonomyLevel;
  heartbeatIntervalMs: number;
  fixChannel: string;
  decisionChannel: string;
  maxConcurrentAgents: number;
  autoCommitIntervalMs: number;
  diagnosticHandlers: DiagnosticHandler[];
  onDecision?: (decision: AutonomyDecision) => void;
  onFixPushed?: (fix: AutonomyFix) => void;
}

export interface DiagnosticHandler {
  name: string;
  description: string;
  check: (ctx: TaskContext) => Promise<DiagnosticResult>;
  fix?: (ctx: TaskContext, diagnostic: DiagnosticResult) => Promise<FixResult>;
}

export interface DiagnosticResult {
  handler: string;
  healthy: boolean;
  severity: "info" | "warning" | "critical";
  message: string;
  details?: Record<string, any>;
  suggestedFix?: string;
}

export interface FixResult {
  applied: boolean;
  description: string;
  rootHash?: string;
  rollbackData?: string;
}

export interface AutonomyDecision {
  id: string;
  timestamp: number;
  trigger: string;
  diagnostic: DiagnosticResult;
  action: "ignore" | "log" | "suggest" | "auto_fix" | "spawn_agent";
  reasoning: string;
  autonomyLevel: AutonomyLevel;
}

export interface AutonomyFix {
  id: string;
  decisionId: string;
  timestamp: number;
  handler: string;
  result: FixResult;
  attestedRootHash: string | null;
  agentId: string | null;
}

const DEFAULT_CONFIG: AutonomyConfig = {
  level: "monitor",
  heartbeatIntervalMs: 30_000,
  fixChannel: "silo:fixes",
  decisionChannel: "silo:decisions",
  maxConcurrentAgents: 3,
  autoCommitIntervalMs: 300_000,
  diagnosticHandlers: [],
};

export class AutonomyEngine {
  private vault: AgentVault;
  private sharedMemory: SharedMemoryBus;
  private heartbeat: HeartbeatDaemon;
  private router: AgentRouter;
  private config: AutonomyConfig;
  private decisions: AutonomyDecision[] = [];
  private fixes: AutonomyFix[] = [];
  private running = false;
  private diagnosticTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    vault: AgentVault,
    sharedMemory: SharedMemoryBus,
    heartbeat: HeartbeatDaemon,
    router: AgentRouter,
    config: Partial<AutonomyConfig> = {},
  ) {
    this.vault = vault;
    this.sharedMemory = sharedMemory;
    this.heartbeat = heartbeat;
    this.router = router;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  get level(): AutonomyLevel { return this.config.level; }
  get isRunning(): boolean { return this.running; }

  /** Set autonomy level at runtime */
  setLevel(level: AutonomyLevel): void {
    this.config.level = level;
    this.heartbeat.setAutonomousMode(level === "autonomous");
  }

  /** Register a diagnostic handler */
  registerDiagnostic(handler: DiagnosticHandler): void {
    this.config.diagnosticHandlers.push(handler);
  }

  /**
   * Start the autonomy engine.
   * Initializes shared memory channels, starts heartbeat, and begins diagnostic loop.
   */
  start(): void {
    if (this.running) return;
    this.running = true;

    this.sharedMemory.createChannel(this.config.fixChannel);
    this.sharedMemory.createChannel(this.config.decisionChannel);
    this.sharedMemory.createChannel("silo:agents");

    this.heartbeat.registerDefaultTasks();

    this.heartbeat.registerTask({
      name: "autonomy_diagnostics",
      type: "diagnostic",
      intervalMs: this.config.heartbeatIntervalMs,
      enabled: true,
      handler: async (ctx) => this.runDiagnostics(ctx),
    });

    this.heartbeat.start();

    this.diagnosticTimer = setInterval(async () => {
      if (this.config.level !== "off") {
        const ctx: TaskContext = {
          vault: this.vault,
          sharedMemory: this.sharedMemory,
          heartbeatId: this.heartbeat.id,
          autonomousMode: this.config.level === "autonomous",
          taskHistory: [],
        };
        await this.runDiagnostics(ctx);
      }
    }, this.config.heartbeatIntervalMs);
  }

  /** Stop the autonomy engine and all sub-systems */
  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.heartbeat.stop();
    if (this.diagnosticTimer) {
      clearInterval(this.diagnosticTimer);
      this.diagnosticTimer = null;
    }
  }

  /** Run all registered diagnostic handlers and take action based on autonomy level */
  private async runDiagnostics(ctx: TaskContext): Promise<TaskResult> {
    const results: DiagnosticResult[] = [];
    const startTime = Date.now();

    for (const handler of this.config.diagnosticHandlers) {
      try {
        const result = await handler.check(ctx);
        results.push(result);

        if (!result.healthy) {
          await this.handleDiagnostic(ctx, handler, result);
        }
      } catch (error: any) {
        results.push({
          handler: handler.name,
          healthy: false,
          severity: "critical",
          message: `Diagnostic check failed: ${error.message}`,
        });
      }
    }

    return {
      taskName: "autonomy_diagnostics",
      taskType: "diagnostic",
      success: results.every(r => r.healthy),
      timestamp: Date.now(),
      duration: Date.now() - startTime,
      output: JSON.stringify({
        totalChecks: results.length,
        healthy: results.filter(r => r.healthy).length,
        unhealthy: results.filter(r => !r.healthy).length,
        results,
      }),
    };
  }

  /** Decide what to do about an unhealthy diagnostic based on autonomy level */
  private async handleDiagnostic(
    ctx: TaskContext,
    handler: DiagnosticHandler,
    diagnostic: DiagnosticResult,
  ): Promise<void> {
    let action: AutonomyDecision["action"];
    let reasoning: string;

    switch (this.config.level) {
      case "off":
        return;

      case "monitor":
        action = "log";
        reasoning = "Monitoring only — logging diagnostic for review";
        break;

      case "suggest":
        action = "suggest";
        reasoning = diagnostic.suggestedFix
          ? `Suggesting fix: ${diagnostic.suggestedFix}`
          : "Issue detected but no automated fix available";
        break;

      case "autonomous":
        if (handler.fix && diagnostic.severity !== "info") {
          action = diagnostic.severity === "critical" ? "spawn_agent" : "auto_fix";
          reasoning = diagnostic.severity === "critical"
            ? "Critical issue — spawning dedicated agent for investigation"
            : "Applying automated fix";
        } else {
          action = "log";
          reasoning = "No automated fix handler registered";
        }
        break;

      default:
        return;
    }

    const decision: AutonomyDecision = {
      id: createHash("sha256")
        .update(`decision:${Date.now()}:${Math.random()}`)
        .digest("hex")
        .slice(0, 16),
      timestamp: Date.now(),
      trigger: handler.name,
      diagnostic,
      action,
      reasoning,
      autonomyLevel: this.config.level,
    };

    this.decisions.push(decision);
    this.config.onDecision?.(decision);

    await this.sharedMemory.write(this.config.decisionChannel, JSON.stringify(decision), {
      action: decision.action,
      severity: diagnostic.severity,
    });

    if (action === "auto_fix" && handler.fix) {
      await this.applyFix(ctx, handler, diagnostic, decision);
    } else if (action === "spawn_agent") {
      await this.spawnFixAgent(handler, diagnostic, decision);
    }
  }

  /** Apply a fix directly */
  private async applyFix(
    ctx: TaskContext,
    handler: DiagnosticHandler,
    diagnostic: DiagnosticResult,
    decision: AutonomyDecision,
  ): Promise<void> {
    if (!handler.fix) return;

    try {
      const result = await handler.fix(ctx, diagnostic);
      let attestedRootHash: string | null = null;

      if (result.applied) {
        const fixRecord = JSON.stringify({ decision, result, appliedAt: Date.now() });
        const stored = await this.vault.store(fixRecord, `fix:${handler.name}`);
        attestedRootHash = stored.rootHash;
      }

      const fix: AutonomyFix = {
        id: createHash("sha256").update(`fix:${Date.now()}:${Math.random()}`).digest("hex").slice(0, 16),
        decisionId: decision.id,
        timestamp: Date.now(),
        handler: handler.name,
        result,
        attestedRootHash,
        agentId: null,
      };

      this.fixes.push(fix);
      this.config.onFixPushed?.(fix);

      await this.sharedMemory.write(this.config.fixChannel, JSON.stringify(fix), {
        handler: handler.name,
        applied: result.applied,
      });
    } catch (error: any) {
      await this.sharedMemory.write(this.config.fixChannel, JSON.stringify({
        error: error.message,
        decisionId: decision.id,
        handler: handler.name,
      }));
    }
  }

  /** Spawn a dedicated sub-agent for critical issues */
  private async spawnFixAgent(
    handler: DiagnosticHandler,
    diagnostic: DiagnosticResult,
    decision: AutonomyDecision,
  ): Promise<SubAgentDescriptor | null> {
    const activeAgents = this.router.listChildren().filter(c => c.status === "running");
    if (activeAgents.length >= this.config.maxConcurrentAgents) {
      return null;
    }

    const descriptor = await this.router.spawn({
      role: `fix-agent:${handler.name}`,
      contextData: JSON.stringify({
        diagnostic,
        decision,
        instruction: `Investigate and fix: ${diagnostic.message}`,
        suggestedFix: diagnostic.suggestedFix,
      }),
      autonomy: "autonomous",
      metadata: {
        triggeredBy: "autonomy_engine",
        handler: handler.name,
        severity: diagnostic.severity,
      },
    });

    return descriptor;
  }

  /** Get the full autonomy engine status */
  status(): {
    level: AutonomyLevel;
    running: boolean;
    heartbeat: ReturnType<HeartbeatDaemon["status"]>;
    agents: ReturnType<AgentRouter["status"]>;
    recentDecisions: AutonomyDecision[];
    recentFixes: AutonomyFix[];
    diagnosticHandlers: string[];
  } {
    return {
      level: this.config.level,
      running: this.running,
      heartbeat: this.heartbeat.status(),
      agents: this.router.status(),
      recentDecisions: this.decisions.slice(-20),
      recentFixes: this.fixes.slice(-20),
      diagnosticHandlers: this.config.diagnosticHandlers.map(h => h.name),
    };
  }
}
