/**
 * SILO DeFAI Demo
 *
 * Demonstrates:
 *  1) Intent -> structured DeFi plan
 *  2) Guardrails + risk explanation
 *  3) Simulation preview
 *  4) Explicit user approval gate
 *  5) Encrypted attestation artifacts on 0G
 *
 * Usage:
 *   npm run defai:demo
 */

import dotenv from "dotenv";
import { AgentVault } from "./lib/vault.js";
import { buildStructuredPlan, guardrailViolations, type PlanInput } from "./lib/defai.js";

dotenv.config();

async function run() {
  const vault = new AgentVault({
    privateKey: process.env.PRIVATE_KEY!,
    evmRpc: process.env.EVM_RPC!,
    indexerRpc: process.env.INDEXER_RPC!,
    vaultSecret: process.env.VAULT_SECRET,
  });
  await vault.init();

  const input: PlanInput = {
    intent: "Rebalance 500 USD from ETH to USDC with strict risk limits",
    tokenIn: "ETH",
    tokenOut: "USDC",
    amountUsd: 500,
    guardrails: {
      maxSlippageBps: 75,
      timeoutSec: 90,
      tokenAllowlist: ["ETH", "USDC", "DAI", "WBTC"],
      maxNotionalUsd: 1000,
    },
  };

  console.log("\n=== SILO DeFAI Demo ===");
  console.log(`Agent: ${vault.address}`);
  console.log(`Intent: ${input.intent}`);

  const violations = guardrailViolations(input);
  if (violations.length > 0) {
    console.log("Guardrail violations:");
    for (const v of violations) console.log(`  - ${v}`);
    process.exit(1);
  }

  const plan = await buildStructuredPlan(input);
  console.log(`\nPlan ID: ${plan.planId}`);
  console.log(`Risk: ${plan.risk.level.toUpperCase()} — ${plan.risk.explanation}`);
  console.log(`Preview: expectedOut=$${plan.preview.expectedOutUsd}, minOut=$${plan.preview.minOutUsd}, impact=${plan.preview.simulatedPriceImpactBps}bps`);
  console.log(`Compute: ${plan.compute.provider} (${plan.compute.used ? "used" : "fallback"})`);
  console.log(`Approval required: ${plan.userApprovalRequired ? "yes" : "no"}`);

  const planStore = await vault.store(JSON.stringify(plan, null, 2), "defai_plan");
  console.log(`Plan artifact rootHash: ${planStore.rootHash}`);

  const approved = true; // Demo path: explicit user approval
  const approval = {
    planId: plan.planId,
    approved,
    reason: "User reviewed preview and accepted guardrails",
    timestamp: Date.now(),
  };
  const approvalStore = await vault.store(JSON.stringify(approval, null, 2), "defai_user_approved");
  console.log(`Approval artifact rootHash: ${approvalStore.rootHash}`);

  const commit = await vault.commitSession();
  console.log(`\nCommitted session ${commit.sessionId}`);
  console.log(`Merkle root: ${commit.merkleRoot}`);
  console.log(`Trace rootHash: ${commit.traceRootHash}`);
  console.log("\nDeFAI flow complete: intent -> plan -> approval -> attestation.");
}

run().catch((err) => {
  console.error("DeFAI demo failed:", err.message);
  process.exit(1);
});
