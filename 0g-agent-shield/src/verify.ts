/**
 * SILO — Verify CLI
 *
 * Usage:
 *   npm run verify -- <rootHash>
 *   npm run verify -- <rootHash> --trace    (for attestation traces)
 *
 * This is the tool you demo to judges:
 *   1. Store something via the MCP server
 *   2. Copy the root hash
 *   3. Run: npm run verify -- 0xabc123...
 *   4. Watch it download, decrypt, and display
 */

import { AgentVault } from "./lib/vault.js";
import dotenv from "dotenv";

dotenv.config();

async function verify() {
  const rootHash = process.argv[2];
  const isTrace = process.argv.includes("--trace");

  if (!rootHash) {
    console.log(`
🛡️  SILO — Verifier

Usage:
  npm run verify -- <rootHash>          Decrypt a stored memory
  npm run verify -- <rootHash> --trace  Decrypt an attestation trace

Example:
  npm run verify -- 0x1a2b3c...
`);
    process.exit(1);
  }

  const vault = new AgentVault({
    privateKey: process.env.PRIVATE_KEY!,
    evmRpc: process.env.EVM_RPC!,
    indexerRpc: process.env.INDEXER_RPC!,
    vaultSecret: process.env.VAULT_SECRET,
  });
  await vault.init();

  console.log(`\n🔍 Fetching from 0G Storage: ${rootHash.slice(0, 20)}...`);

  try {
    const decrypted = await vault.retrieve(rootHash, "verify-cli");

    if (isTrace) {
      // Pretty-print attestation trace
      const trace = JSON.parse(decrypted);
      console.log(`\n🔏 Attestation Trace`);
      console.log(`${"─".repeat(50)}`);
      console.log(`   Session:     ${trace.sessionId}`);
      console.log(`   Agent:       ${trace.agentAddress?.slice(0, 12)}...`);
      console.log(`   Events:      ${trace.eventCount}`);
      console.log(`   Merkle Root: ${trace.merkleRoot?.slice(0, 24)}...`);
      console.log(`   Started:     ${new Date(trace.startedAt).toISOString()}`);
      console.log(`   Ended:       ${new Date(trace.endedAt).toISOString()}`);
      console.log(`\n   Event Log:`);
      for (const [i, event] of (trace.events ?? []).entries()) {
        console.log(`   ${i + 1}. [${event.type}] ${new Date(event.timestamp).toISOString()} — ${event.metadata ?? ""}`);
        console.log(`      in:  ${event.inputHash.slice(0, 16)}...`);
        console.log(`      out: ${event.outputHash.slice(0, 16)}...`);
      }
      console.log(`${"─".repeat(50)}`);
    } else {
      // Regular memory
      console.log(`\n✅ Download successful. Decrypting...`);
      console.log(`\n🔓 Decrypted Content:`);
      console.log(`${"─".repeat(50)}`);
      console.log(decrypted);
      console.log(`${"─".repeat(50)}`);
    }
  } catch (err: any) {
    console.error(`\n❌ Verification failed: ${err.message}`);
    process.exit(1);
  }
}

verify();
