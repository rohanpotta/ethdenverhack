/**
 * SILO — MCP Server
 *
 * Exposes the vault as MCP tools for any compatible AI client:
 *   - Claude Desktop
 *   - OpenClaw
 *   - Cursor
 *   - Any MCP-compatible agent
 *
 * Tools:
 *   vault_store          — Encrypt + store data on 0G
 *   vault_retrieve       — Download + decrypt data from 0G
 *   vault_session_log    — Show current session's attestation log
 *   session_commit       — Finalize session, publish Merkle root
 *   vault_balance        — Check wallet balance
 *   vault_status         — Show vault status and session info
 *   vault_share          — Store + generate share descriptor for another agent
 *   vault_import         — Retrieve shared memory from another agent
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { AgentVault } from "./lib/vault.js";
import dotenv from "dotenv";

dotenv.config();

// --- Dashboard bridge (fire-and-forget) ---
const DASHBOARD_API = process.env.DASHBOARD_API || 'http://localhost:3000';
function pushToDashboard(type: string, data: Record<string, any>) {
  fetch(`${DASHBOARD_API}/api/push-event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, data }),
  }).catch(() => { }); // silent — dashboard may not be running
}

// --- Validation ---
const required = ["PRIVATE_KEY", "EVM_RPC", "INDEXER_RPC"] as const;
for (const key of required) {
  if (!process.env[key]) {
    console.error(`❌ Missing env var: ${key}. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
}

// --- Initialize Vault ---
const vault = new AgentVault({
  privateKey: process.env.PRIVATE_KEY!,
  evmRpc: process.env.EVM_RPC!,
  indexerRpc: process.env.INDEXER_RPC!,
  vaultSecret: process.env.VAULT_SECRET, // uses PRIVATE_KEY if not set
});

// --- MCP Server ---
const server = new McpServer({
  name: "silo",
  version: "1.0.0",
});

// TOOL 1: Store encrypted memory
server.tool(
  "vault_store",
  {
    data: z.string().describe("The sensitive data to encrypt and store on 0G"),
    label: z.string().optional().describe("Optional label for the attestation log"),
  },
  async ({ data, label }) => {
    try {
      const result = await vault.store(data, label);
      pushToDashboard('store', { rootHash: result.rootHash, txHash: result.txHash, contentHash: result.contentHash, size: result.size, sessionEvent: result.sessionEvent, label });
      return {
        content: [{
          type: "text",
          text: [
            `✅ Data encrypted and stored on 0G.`,
            `   Root Hash:    ${result.rootHash}`,
            `   Content Hash: ${result.contentHash.slice(0, 16)}...`,
            `   Tx:           ${result.txHash}`,
            `   Size:         ${result.size} bytes`,
            `   Session Event #${result.sessionEvent}`,
          ].join("\n"),
        }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `❌ Store failed: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// TOOL 2: Retrieve and decrypt memory
server.tool(
  "vault_retrieve",
  {
    rootHash: z.string().describe("The 0G Storage root hash to retrieve and decrypt"),
    label: z.string().optional().describe("Optional label for the attestation log"),
  },
  async ({ rootHash, label }) => {
    try {
      const decrypted = await vault.retrieve(rootHash, label);
      pushToDashboard('retrieve', { rootHash, decryptedLength: decrypted.length, label });
      return {
        content: [{
          type: "text",
          text: `🔓 Decrypted content:\n${decrypted}`,
        }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `❌ Retrieve failed: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// TOOL 3: View current session attestation log
server.tool(
  "vault_session_log",
  {},
  async () => {
    try {
      const summary = vault.sessionSummary();
      return {
        content: [{
          type: "text",
          text: `📋 Current Attestation Session:\n\n${summary}`,
        }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `❌ Error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// TOOL 4: Commit session — publish Merkle root + encrypted trace
server.tool(
  "session_commit",
  {},
  async () => {
    try {
      const result = await vault.commitSession();
      pushToDashboard('session_commit', { merkleRoot: result.merkleRoot, sessionId: result.sessionId, eventCount: result.eventCount, traceRootHash: result.traceRootHash, traceTxHash: result.traceTxHash });
      return {
        content: [{
          type: "text",
          text: [
            `🔏 Session attestation committed to 0G.`,
            ``,
            `   Session ID:   ${result.sessionId}`,
            `   Events:       ${result.eventCount}`,
            `   Merkle Root:  ${result.merkleRoot.slice(0, 32)}...`,
            `   Trace Hash:   ${result.traceRootHash}`,
            `   Trace Tx:     ${result.traceTxHash}`,
            ``,
            `   The Merkle root proves this agent performed exactly`,
            `   ${result.eventCount} actions in this session.`,
            `   The encrypted trace is stored on 0G for audit.`,
          ].join("\n"),
        }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `❌ Commit failed: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// TOOL 5: Check balance
server.tool(
  "vault_balance",
  {},
  async () => {
    try {
      const balance = await vault.getBalance();
      return {
        content: [{
          type: "text",
          text: `💰 Wallet ${vault.address}\n   Balance: ${balance} 0G`,
        }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `❌ Balance check failed: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// TOOL 6: Status
server.tool(
  "vault_status",
  {},
  async () => {
    return {
      content: [{
        type: "text",
        text: [
          `🛡️ SILO — Status`,
          `   Agent:    ${vault.address.slice(0, 10)}...`,
          `   Session:  ${vault.sessionId}`,
          `   Network:  ${process.env.EVM_RPC}`,
          `   Indexer:  ${process.env.INDEXER_RPC}`,
        ].join("\n"),
      }],
    };
  }
);

// TOOL 7: Share — Store encrypted data and generate a share descriptor
server.tool(
  "vault_share",
  {
    data: z.string().describe("The data to encrypt, store, and share with another agent"),
    label: z.string().optional().describe("Optional description of what is being shared"),
  },
  async ({ data, label }) => {
    try {
      const result = await vault.store(data, label ?? "shared_memory");
      pushToDashboard('store', { rootHash: result.rootHash, txHash: result.txHash, contentHash: result.contentHash, size: result.size, label: label ?? 'shared_memory' });
      const shareDescriptor = [
        `--- SILO — SHARED MEMORY ---`,
        `Root Hash: ${result.rootHash}`,
        `Content Hash: ${result.contentHash}`,
        `Tx: ${result.txHash}`,
        `Size: ${result.size} bytes`,
        `--- END SHARE DESCRIPTOR ---`,
      ].join("\n");

      return {
        content: [{
          type: "text",
          text: [
            `✅ Memory shared on 0G.`,
            ``,
            `Share this with another agent so it can retrieve the data:`,
            ``,
            shareDescriptor,
            ``,
            `The other agent should use the vault_import tool with the Root Hash above.`,
          ].join("\n"),
        }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `❌ Share failed: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// TOOL 8: Import — Retrieve and decrypt shared memory from another agent
server.tool(
  "vault_import",
  {
    rootHash: z.string().describe("The 0G Storage root hash from the share descriptor of another agent"),
    label: z.string().optional().describe("Optional label describing the import"),
  },
  async ({ rootHash, label }) => {
    try {
      const decrypted = await vault.retrieve(rootHash, label ?? "shared_import");
      pushToDashboard('retrieve', { rootHash, decryptedLength: decrypted.length, label: label ?? 'shared_import' });
      return {
        content: [{
          type: "text",
          text: [
            `🔓 Shared memory imported successfully.`,
            ``,
            `Root Hash: ${rootHash}`,
            `Decrypted content:`,
            `${decrypted}`,
            ``,
            `This data was stored on 0G by another agent and has been`,
            `successfully decrypted using this vault's shared secret.`,
          ].join("\n"),
        }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `❌ Import failed: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// --- Launch ---
async function main() {
  await vault.init();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("🛡️ SILO MCP server running"); // stderr so it doesn't interfere with MCP stdio
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
