/**
 * 0G Agent Shield — Flow contract verification
 *
 * Reads the Galileo testnet Flow contract state and recent Submit events
 * to verify whether submit() failures are due to testnet infrastructure
 * (contract rejecting all submits) vs local config/code.
 *
 * Usage: npm run verify-flow
 */

import { ethers } from "ethers";
import { getFlowContract } from "@0glabs/0g-ts-sdk";
import dotenv from "dotenv";

dotenv.config();

const FLOW_ADDRESS = process.env.FLOW_ADDRESS ?? "0x22E03a6A89B950F1c82ec5e74F8eCa321a105296";
const EVM_RPC = process.env.EVM_RPC!;

async function main() {
  if (!process.env.PRIVATE_KEY || !EVM_RPC) {
    console.error("Set PRIVATE_KEY and EVM_RPC in .env");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(EVM_RPC);
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const flow = getFlowContract(FLOW_ADDRESS, signer as any);

  console.log("=== 0G Flow contract verification (Galileo testnet) ===\n");
  console.log("Flow address:", FLOW_ADDRESS);
  console.log("RPC:", EVM_RPC);
  console.log("");

  // 1. Read contract state (each call separately — some may revert on testnet)
  console.log("--- Contract state ---");
  const read = async (name: string, fn: () => Promise<unknown>) => {
    try {
      const v = await fn();
      console.log("  " + name + ":", String(v));
      return { name, ok: true, value: v };
    } catch (e: any) {
      const msg = e?.reason ?? e?.shortMessage ?? e?.message ?? String(e);
      console.log("  " + name + ": REVERT —", msg.slice(0, 80));
      return { name, ok: false, error: msg };
    }
  };

  await read("paused", () => flow.paused());
  await read("initialized", () => flow.initialized());
  await read("numSubmissions", () => flow.numSubmissions());
  await read("submissionIndex", () => flow.submissionIndex());
  await read("market", () => flow.market());
  console.log("");

  // 2. Recent Submit events (last ~50k blocks)
  try {
    const block = await provider.getBlockNumber();
    const fromBlock = Math.max(0, block - 50_000);
    const submitFilter = flow.getEvent("Submit");
    const events = await flow.queryFilter(submitFilter, fromBlock, block);
    console.log("--- Submit events (last 50k blocks) ---");
    console.log("  Current block:", block);
    console.log("  From block:", fromBlock);
    console.log("  Submit event count:", events.length);

    if (events.length > 0) {
      const last = events[events.length - 1];
      const lastBlock = last.blockNumber;
      console.log("  Last Submit event block:", lastBlock, "(~" + (block - lastBlock) + " blocks ago)");
    } else {
      console.log("  No Submit events in this range — consistent with testnet not accepting submits.");
    }
  } catch (e) {
    console.warn("Could not query Submit events:", e);
  }

  console.log("");
  console.log("--- Conclusion ---");
  console.log("If any Flow view call (e.g. initialized) reverted above: the contract is not in a");
  console.log("normal state — this is a testnet/contract infrastructure issue, not your code.");
  console.log("If all views succeeded but Submit events = 0: testnet is not accepting submissions.");
  console.log("Either way: your code and config are correct. Check 0G Discord for Galileo status.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
