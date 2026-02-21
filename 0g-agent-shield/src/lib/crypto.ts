/**
 * 0G Agent Shield — Encryption Core
 *
 * AES-256-GCM via WebCrypto API.
 * Key derived from user passphrase using PBKDF2 (100k iterations).
 * Random 12-byte IV per encryption — never reused.
 *
 * The LLM never sees raw keys. Data is only decrypted in-memory,
 * never persisted in plaintext.
 */

import { webcrypto } from "node:crypto";
import { createHash } from "node:crypto";

export interface EncryptedPayload {
  iv: string;      // hex-encoded 12-byte nonce
  content: string; // hex-encoded ciphertext + auth tag
  hash: string;    // SHA-256 of plaintext (for attestation, NOT for decryption)
}

export class VaultCrypto {
  private key: CryptoKey | null = null;

  /**
   * Derive encryption key from a secret.
   * Recommended: pass the wallet private key or a user-provided passphrase.
   * The secret is stretched via PBKDF2 so even weak inputs produce strong keys.
   */
  async init(secret: string): Promise<void> {
    const enc = new TextEncoder();

    const keyMaterial = await webcrypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "PBKDF2" },
      false,
      ["deriveKey"]
    );

    // Salt is project-scoped. In production you'd store a random salt per-user.
    // For hackathon MVP this is acceptable — the PBKDF2 iterations do the heavy lifting.
    this.key = await webcrypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: enc.encode("0g-agent-shield-v1"),
        iterations: 100_000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false, // non-extractable — key stays in WebCrypto
      ["encrypt", "decrypt"]
    );
  }

  /**
   * Encrypt arbitrary string data.
   * Returns hex-encoded IV + ciphertext + a plaintext hash for attestation.
   */
  async encrypt(data: string): Promise<EncryptedPayload> {
    if (!this.key) throw new Error("VaultCrypto not initialized — call init() first");

    const iv = webcrypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(data);

    const encrypted = await webcrypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      this.key,
      encoded
    );

    // Hash plaintext for attestation (proves content integrity without revealing it)
    const hash = createHash("sha256").update(data).digest("hex");

    return {
      iv: Buffer.from(iv).toString("hex"),
      content: Buffer.from(encrypted).toString("hex"),
      hash,
    };
  }

  /**
   * Decrypt a payload previously encrypted by this vault.
   */
  async decrypt(payload: EncryptedPayload): Promise<string> {
    if (!this.key) throw new Error("VaultCrypto not initialized — call init() first");

    const iv = Buffer.from(payload.iv, "hex");
    const content = Buffer.from(payload.content, "hex");

    const decrypted = await webcrypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      this.key,
      content
    );

    return new TextDecoder().decode(decrypted);
  }
}
