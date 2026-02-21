/**
 * 0G Agent Shield — Public API
 *
 * Import everything you need from one place:
 *   import { AgentVault, VaultCrypto, AttestationSession } from "0g-agent-shield";
 */

export { AgentVault, type VaultConfig, type StoreResult, type CommitResult } from "./lib/vault.js";
export { VaultCrypto, type EncryptedPayload } from "./lib/crypto.js";
export { StorageClient, type UploadResult } from "./lib/storage.js";
export { AttestationSession, type AttestationEvent, type SessionAttestation } from "./lib/attestation.js";
