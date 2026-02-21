import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { VaultCrypto, type EncryptedPayload } from "../lib/crypto.js";

describe("VaultCrypto", () => {
  let crypto: VaultCrypto;

  before(async () => {
    crypto = new VaultCrypto();
    await crypto.init("test-secret-key-for-unit-tests");
  });

  // ── Initialization ──

  it("throws if encrypt called before init", async () => {
    const uninit = new VaultCrypto();
    await assert.rejects(
      () => uninit.encrypt("hello"),
      { message: /not initialized/i }
    );
  });

  it("throws if decrypt called before init", async () => {
    const uninit = new VaultCrypto();
    await assert.rejects(
      () => uninit.decrypt({ iv: "00", content: "00", hash: "00" }),
      { message: /not initialized/i }
    );
  });

  // ── Encrypt / Decrypt round-trip ──

  it("round-trips a simple string", async () => {
    const original = "patient has arrhythmia";
    const encrypted = await crypto.encrypt(original);
    const decrypted = await crypto.decrypt(encrypted);
    assert.equal(decrypted, original);
  });

  it("round-trips an empty string", async () => {
    const encrypted = await crypto.encrypt("");
    const decrypted = await crypto.decrypt(encrypted);
    assert.equal(decrypted, "");
  });

  it("round-trips unicode / emoji content", async () => {
    const original = "日本語テスト 🔐🛡️ données chiffrées";
    const encrypted = await crypto.encrypt(original);
    const decrypted = await crypto.decrypt(encrypted);
    assert.equal(decrypted, original);
  });

  it("round-trips a large payload (10KB)", async () => {
    const original = "A".repeat(10_000);
    const encrypted = await crypto.encrypt(original);
    const decrypted = await crypto.decrypt(encrypted);
    assert.equal(decrypted, original);
  });

  it("round-trips JSON data", async () => {
    const obj = { apiKey: "sk-123", tokens: [1, 2, 3], nested: { ok: true } };
    const original = JSON.stringify(obj);
    const encrypted = await crypto.encrypt(original);
    const decrypted = await crypto.decrypt(encrypted);
    assert.deepEqual(JSON.parse(decrypted), obj);
  });

  // ── Payload structure ──

  it("returns a valid EncryptedPayload shape", async () => {
    const encrypted = await crypto.encrypt("test");
    assert.equal(typeof encrypted.iv, "string");
    assert.equal(typeof encrypted.content, "string");
    assert.equal(typeof encrypted.hash, "string");
    // IV should be 12 bytes = 24 hex chars
    assert.equal(encrypted.iv.length, 24);
    // Hash should be SHA-256 = 64 hex chars
    assert.equal(encrypted.hash.length, 64);
  });

  it("produces a deterministic content hash (SHA-256 of plaintext)", async () => {
    const a = await crypto.encrypt("same-input");
    const b = await crypto.encrypt("same-input");
    assert.equal(a.hash, b.hash);
  });

  it("uses a unique IV for each encryption (ciphertext differs)", async () => {
    const a = await crypto.encrypt("same-input");
    const b = await crypto.encrypt("same-input");
    // IVs must differ (random)
    assert.notEqual(a.iv, b.iv);
    // Ciphertext must differ due to different IV
    assert.notEqual(a.content, b.content);
  });

  // ── Cross-key isolation ──

  it("fails to decrypt with a different key", async () => {
    const encrypted = await crypto.encrypt("secret");

    const otherCrypto = new VaultCrypto();
    await otherCrypto.init("different-secret-key");

    await assert.rejects(
      () => otherCrypto.decrypt(encrypted),
      // AES-GCM auth tag mismatch throws a generic error
      (err: any) => err instanceof Error
    );
  });

  // ── Tamper detection ──

  it("rejects tampered ciphertext (AES-GCM auth tag)", async () => {
    const encrypted = await crypto.encrypt("important data");

    // Flip a byte in the middle of the ciphertext
    const chars = encrypted.content.split("");
    const mid = Math.floor(chars.length / 2);
    chars[mid] = chars[mid] === "a" ? "b" : "a";
    const tampered: EncryptedPayload = { ...encrypted, content: chars.join("") };

    await assert.rejects(
      () => crypto.decrypt(tampered),
      (err: any) => err instanceof Error
    );
  });

  it("rejects tampered IV", async () => {
    const encrypted = await crypto.encrypt("important data");

    const chars = encrypted.iv.split("");
    chars[0] = chars[0] === "a" ? "b" : "a";
    const tampered: EncryptedPayload = { ...encrypted, iv: chars.join("") };

    await assert.rejects(
      () => crypto.decrypt(tampered),
      (err: any) => err instanceof Error
    );
  });

  // ── Re-init with same secret produces same key ──

  it("re-init with same secret can decrypt previous ciphertext", async () => {
    const encrypted = await crypto.encrypt("persistent data");

    const newCrypto = new VaultCrypto();
    await newCrypto.init("test-secret-key-for-unit-tests");
    const decrypted = await newCrypto.decrypt(encrypted);
    assert.equal(decrypted, "persistent data");
  });
});
