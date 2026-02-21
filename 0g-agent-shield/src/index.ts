/**
 * 0G Agent Shield — Public API
 *
 * Import everything you need from one place:
 *   import { AgentVault, SharedMemoryBus, HeartbeatDaemon, AgentRouter, AutonomyEngine } from "0g-agent-shield";
 */

export { AgentVault, type VaultConfig, type StoreResult, type CommitResult } from "./lib/vault.js";
export { VaultCrypto, type EncryptedPayload } from "./lib/crypto.js";
export { StorageClient, type UploadResult } from "./lib/storage.js";
export { AttestationSession, type AttestationEvent, type SessionAttestation } from "./lib/attestation.js";
export { SharedMemoryBus, type MemoryEntry, type ChannelManifest, type ChannelSubscription, type ChannelSchema, type WriteResult } from "./lib/shared-memory.js";
export { MemoryCoordinator, type ChannelLock, type ChannelHead, type WriteReceipt, type ForkRecord, type CoordinatorConfig } from "./lib/memory-coordinator.js";
export { MemoryIndex, type IndexEntry, type SearchQuery, type IndexSnapshot } from "./lib/memory-index.js";
export { HeartbeatDaemon, type HeartbeatConfig, type HeartbeatTask, type HeartbeatRecord, type TaskResult, type TaskContext } from "./lib/heartbeat.js";
export { AgentRouter, type SubAgentDescriptor, type SpawnOptions, type SubAgentResult, type AgentMessage } from "./lib/agent-router.js";
export { AutonomyEngine, type AutonomyConfig, type AutonomyLevel, type DiagnosticHandler, type AutonomyDecision, type AutonomyFix } from "./lib/autonomy.js";
