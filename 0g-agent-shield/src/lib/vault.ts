/**
 * 0G Agent Shield — AgentVault
 *
 * This is the single entry point that ties everything together.
 * Developers interact with this class, not the internals.
 *
 * Usage:
 *   const vault = new AgentVault({ privateKey, evmRpc, indexerRpc });
 *   await vault.init();
 *   const { rootHash } = await vault.store("patient has arrhythmia");
 *   const data = await vault.retrieve(rootHash);
 *   const proof = await vault.commitSession(); // attestation
 */

import { VaultCrypto, type EncryptedPayload } from "./crypto.js";
import { StorageClient, type UploadResult } from "./storage.js";
import { AttestationSession, type SessionAttestation } from "./attestation.js";

export interface VaultConfig {
  privateKey: string;
  evmRpc: string;
  indexerRpc: string;
  vaultSecret?: string; // optional override; defaults to privateKey
}

export interface StoreResult {
  rootHash: string;
  txHash: string;
  contentHash: string; // SHA-256 of plaintext (for verification)
  size: number;
  sessionEvent: number; // which event # in the attestation session
  encryptedPayload?: string; // Added for frontend visualization
}

export interface CommitResult {
  merkleRoot: string;
  sessionId: string;
  eventCount: number;
  traceRootHash: string; // 0G root hash of the encrypted full trace
  traceTxHash: string;
  durationMs: number;
}

export class AgentVault {
  private crypto: VaultCrypto;
  private storage: StorageClient;
  private session: AttestationSession;
  private initialized = false;
  private config: VaultConfig;

  constructor(config: VaultConfig) {
    this.config = config;
    this.crypto = new VaultCrypto();
    this.storage = new StorageClient(config.privateKey, config.evmRpc, config.indexerRpc);
    this.session = new AttestationSession(this.storage.address);
  }

  /** Initialize encryption. Must be called before store/retrieve. */
  async init(): Promise<void> {
    const secret = this.config.vaultSecret ?? this.config.privateKey;
    await this.crypto.init(secret);
    this.initialized = true;
  }

  get address(): string {
    return this.storage.address;
  }

  get sessionId(): string {
    return this.session.id;
  }

  private ensureInit() {
    if (!this.initialized) throw new Error("Vault not initialized — call init() first");
  }

  /**
   * Encrypt data and store it on 0G Storage.
   * Automatically records the action in the attestation session.
   */
  async store(data: string, label?: string): Promise<StoreResult> {
    this.ensureInit();

    // 1. Encrypt
    const encrypted = await this.crypto.encrypt(data);

    // 2. Upload encrypted payload to 0G
    const payload = JSON.stringify(encrypted);
    const upload = await this.storage.upload(payload);

    // 3. Record in attestation session
    const event = this.session.record(
      "store",
      data,
      upload.rootHash,
      label ?? "vault_store"
    );

    return {
      rootHash: upload.rootHash,
      txHash: upload.txHash,
      contentHash: encrypted.hash,
      size: upload.size,
      sessionEvent: this.session.count,
      encryptedPayload: payload,
    };
  }

  /**
   * Download and decrypt data from 0G Storage.
   * Automatically records the retrieval in the attestation session.
   */
  async retrieve(rootHash: string, label?: string): Promise<string> {
    this.ensureInit();

    // 1. Download from 0G
    const raw = await this.storage.download(rootHash);

    // 2. Parse and decrypt
    const encrypted: EncryptedPayload = JSON.parse(raw);
    const decrypted = await this.crypto.decrypt(encrypted);

    // 3. Record in attestation session
    this.session.record(
      "retrieve",
      rootHash,
      decrypted,
      label ?? "vault_retrieve"
    );

    return decrypted;
  }

  /**
   * Finalize the current attestation session:
   *   1. Compute Merkle root of all events
   *   2. Encrypt the full trace
   *   3. Upload encrypted trace to 0G Storage
   *   4. Return the public commitment (merkleRoot) and trace location
   *
   * After this call, a new session begins automatically.
   */
  async commitSession(): Promise<CommitResult> {
    this.ensureInit();

    const startMs = Date.now();
    const attestation = this.session.finalize();

    // Encrypt the full trace — it contains hashes of inputs/outputs,
    // so even the trace itself should be private
    const traceJson = JSON.stringify(attestation);
    const encrypted = await this.crypto.encrypt(traceJson);
    const tracePayload = JSON.stringify(encrypted);
    const upload = await this.storage.upload(tracePayload);

    // Start fresh session
    this.session = new AttestationSession(this.storage.address);

    return {
      merkleRoot: attestation.merkleRoot,
      sessionId: attestation.sessionId,
      eventCount: attestation.eventCount,
      traceRootHash: upload.rootHash,
      traceTxHash: upload.txHash,
      durationMs: Date.now() - startMs,
    };
  }

  /** Get a human-readable summary of the current session */
  sessionSummary(): string {
    return this.session.summary();
  }

  /** Check wallet balance */
  async getBalance(): Promise<string> {
    return this.storage.getBalance();
  }
}
