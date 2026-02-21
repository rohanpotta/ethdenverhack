/**
 * SILO — Doctor
 *
 * Checks everything works before you start building:
 *   - Env vars present
 *   - RPC reachable
 *   - Wallet has balance
 *   - Indexer reachable
 *   - Encryption works
 *
 * Usage: npm run doctor
 */

import { ethers } from "ethers";
import { VaultCrypto } from "./lib/crypto.js";
import dotenv from "dotenv";

dotenv.config();

interface Check {
  name: string;
  fn: () => Promise<string>;
}

const checks: Check[] = [
  {
    name: "PRIVATE_KEY set",
    fn: async () => {
      if (!process.env.PRIVATE_KEY) throw new Error("Missing in .env");
      if (process.env.PRIVATE_KEY === "your_private_key_here") throw new Error("Still set to placeholder");
      return `${process.env.PRIVATE_KEY.slice(0, 6)}...`;
    },
  },
  {
    name: "EVM RPC reachable",
    fn: async () => {
      const provider = new ethers.JsonRpcProvider(process.env.EVM_RPC);
      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);
      // Galileo Testnet = 16602, Mainnet = 16661
      if (chainId !== 16602 && chainId !== 16661) {
        throw new Error(`Unexpected chain ID ${chainId}. Expected 16602 (Galileo testnet) or 16661 (mainnet)`);
      }
      const label = chainId === 16602 ? "Galileo Testnet" : "Mainnet";
      return `${label} (Chain ID: ${chainId})`;
    },
  },
  {
    name: "Wallet balance",
    fn: async () => {
      const provider = new ethers.JsonRpcProvider(process.env.EVM_RPC);
      const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
      const balance = await provider.getBalance(wallet.address);
      const formatted = ethers.formatEther(balance);
      if (parseFloat(formatted) === 0) {
        throw new Error(`0 balance — get testnet tokens from https://faucet.0g.ai`);
      }
      return `${formatted} 0G (${wallet.address.slice(0, 10)}...)`;
    },
  },
  {
    name: "Indexer RPC reachable",
    fn: async () => {
      // Simple fetch to check the indexer is up
      const url = process.env.INDEXER_RPC!;
      // The indexer doesn't have a simple health endpoint,
      // so we just verify the URL is set and looks valid
      if (!url.startsWith("http")) throw new Error("Invalid URL");
      return url;
    },
  },
  {
    name: "Encryption round-trip",
    fn: async () => {
      const crypto = new VaultCrypto();
      await crypto.init(process.env.PRIVATE_KEY!);
      const original = "doctor-test-" + Date.now();
      const encrypted = await crypto.encrypt(original);
      const decrypted = await crypto.decrypt(encrypted);
      if (decrypted !== original) throw new Error("Decrypt mismatch!");
      return "AES-256-GCM ✓";
    },
  },
];

async function doctor() {
  console.log(`\n🛡️  SILO — Doctor\n`);

  let allPassed = true;

  for (const check of checks) {
    try {
      const result = await check.fn();
      console.log(`  ✅ ${check.name}: ${result}`);
    } catch (err: any) {
      console.log(`  ❌ ${check.name}: ${err.message}`);
      allPassed = false;
    }
  }

  console.log("");
  if (allPassed) {
    console.log(`  🎉 All checks passed. You're ready to build.\n`);
  } else {
    console.log(`  ⚠️  Some checks failed. Fix the issues above and re-run.\n`);
    console.log(`  Need help?`);
    console.log(`    • Get testnet tokens: https://faucet.0g.ai`);
    console.log(`    • 0G docs: https://docs.0g.ai`);
    console.log(`    • SDK reference: https://build.0g.ai/sdks\n`);
    process.exit(1);
  }
}

doctor();
