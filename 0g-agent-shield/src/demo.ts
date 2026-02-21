/**
 * SILO — Demo
 *
 * Runs a complete end-to-end cycle that you can show judges:
 *   1. Store encrypted data
 *   2. Retrieve and decrypt it
 *   3. Store a second piece of data
 *   4. Commit the attestation session
 *   5. Verify the attestation trace
 *
 * Usage: npm run demo
 */

import { AgentVault } from "./lib/vault.js";
import dotenv from "dotenv";

dotenv.config();

async function demo() {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  🛡️  SILO — Full Demo`);
  console.log(`${"═".repeat(60)}\n`);

  const vault = new AgentVault({
    privateKey: process.env.PRIVATE_KEY!,
    evmRpc: process.env.EVM_RPC!,
    indexerRpc: process.env.INDEXER_RPC!,
    vaultSecret: process.env.VAULT_SECRET,
  });
  await vault.init();

  console.log(`Agent: ${vault.address}`);
  console.log(`Balance: ${await vault.getBalance()} 0G\n`);

  // --- Step 1: Store sensitive data ---
  console.log(`${"─".repeat(60)}`);
  console.log(`Step 1: Encrypting and storing sensitive data on 0G...\n`);

  const sensitiveData = "Patient: Jane Doe | Diagnosis: Type 2 Diabetes | A1C: 7.2% | Medication: Metformin 500mg";
  console.log(`  Plaintext: "${sensitiveData.slice(0, 40)}..."`);

  const store1 = await vault.store(sensitiveData, "medical_record");
  console.log(`  ✅ Stored!`);
  console.log(`     Root Hash:    ${store1.rootHash}`);
  console.log(`     Content Hash: ${store1.contentHash.slice(0, 24)}...`);
  console.log(`     Size:         ${store1.size} bytes (encrypted)\n`);

  // --- Step 2: Retrieve and decrypt ---
  console.log(`${"─".repeat(60)}`);
  console.log(`Step 2: Retrieving and decrypting from 0G...\n`);

  const retrieved = await vault.retrieve(store1.rootHash, "medical_record_read");
  console.log(`  🔓 Decrypted: "${retrieved.slice(0, 40)}..."`);
  console.log(`  ✅ Match: ${retrieved === sensitiveData ? "EXACT MATCH" : "MISMATCH!"}\n`);

  // --- Step 3: Store another piece of data ---
  console.log(`${"─".repeat(60)}`);
  console.log(`Step 3: Storing additional agent memory...\n`);

  const moreData = "User preference: Do not share data with insurance providers. Emergency contact: John Doe, 555-0123.";
  const store2 = await vault.store(moreData, "user_preferences");
  console.log(`  ✅ Stored second record.`);
  console.log(`     Root Hash: ${store2.rootHash}\n`);

  // --- Step 4: View session log ---
  console.log(`${"─".repeat(60)}`);
  console.log(`Step 4: Current attestation session:\n`);
  console.log(vault.sessionSummary().split("\n").map(l => `  ${l}`).join("\n"));
  console.log("");

  // --- Step 5: Commit attestation ---
  console.log(`${"─".repeat(60)}`);
  console.log(`Step 5: Committing attestation to 0G...\n`);

  const commit = await vault.commitSession();
  console.log(`  🔏 Attestation committed!`);
  console.log(`     Session ID:   ${commit.sessionId}`);
  console.log(`     Events:       ${commit.eventCount}`);
  console.log(`     Merkle Root:  ${commit.merkleRoot.slice(0, 32)}...`);
  console.log(`     Trace stored: ${commit.traceRootHash}`);

  // --- Summary ---
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  Demo Complete!`);
  console.log(`${"═".repeat(60)}`);
  console.log(`
  What just happened:
    1. Sensitive medical data was encrypted client-side (AES-256-GCM)
    2. Encrypted blob was stored on 0G's decentralized storage
    3. Data was retrieved and decrypted — only the agent holder can read it
    4. Every action was recorded in an attestation session
    5. The session was finalized into a Merkle root commitment
    6. The encrypted full trace was stored on 0G for future audit

  To verify any stored data:
    npm run verify -- ${store1.rootHash}

  To inspect the attestation trace:
    npm run verify -- ${commit.traceRootHash} --trace
`);
}

demo().catch((err) => {
  console.error("\n❌ Demo failed:", err.message);
  console.error("\nRun 'npm run doctor' to diagnose setup issues.");
  process.exit(1);
});
