/**
 * test-agent — AI Agent with Encrypted Memory on 0G
 *
 * Scaffolded with create-silo-app
 *
 * This example demonstrates:
 *   1. Storing encrypted data on 0G
 *   2. Retrieving and decrypting it
 *   3. Committing a Merkle attestation of the session
 */

import { AgentVault } from "silo-agent";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  // ── Initialize the vault ──
  const vault = new AgentVault({
    privateKey: process.env.PRIVATE_KEY!,
    evmRpc: process.env.EVM_RPC!,
    indexerRpc: process.env.INDEXER_RPC!,
    vaultSecret: process.env.VAULT_SECRET,
  });
  await vault.init();

  console.log(`\n${"═".repeat(50)}`);
  console.log(`  SILO — ${vault.address.slice(0, 10)}...`);
  console.log(`${"═".repeat(50)}\n`);

  // ── 1. Store encrypted data ──
  console.log("1. Storing encrypted data on 0G...");
  const { rootHash, contentHash, size } = await vault.store(
    "Sensitive agent memory: patient vitals HR 72, BP 120/80",
    "medical_data"
  );
  console.log(`   Root Hash:    ${rootHash}`);
  console.log(`   Content Hash: ${contentHash.slice(0, 16)}...`);
  console.log(`   Size:         ${size} bytes\n`);

  // ── 2. Retrieve and decrypt ──
  console.log("2. Retrieving and decrypting from 0G...");
  const decrypted = await vault.retrieve(rootHash);
  console.log(`   Decrypted:    ${decrypted}\n`);

  // ── 3. Commit attestation ──
  console.log("3. Committing Merkle attestation to 0G...");
  const proof = await vault.commitSession();
  console.log(`   Session ID:   ${proof.sessionId}`);
  console.log(`   Events:       ${proof.eventCount}`);
  console.log(`   Merkle Root:  ${proof.merkleRoot.slice(0, 32)}...`);
  console.log(`   Trace Hash:   ${proof.traceRootHash}\n`);

  console.log("Done. Your agent's memory is encrypted and attested on 0G.");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
