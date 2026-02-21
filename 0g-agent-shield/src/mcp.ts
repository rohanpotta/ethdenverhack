/**
 * SILO — MCP Server
 *
 * Exposes the vault as MCP tools for any compatible AI client:
 *   - Claude Desktop
 *   - OpenClaw
 *   - Cursor
 *   - Any MCP-compatible agent
 *
 * Tools (Core):
 *   vault_store          — Encrypt + store data on 0G
 *   vault_retrieve       — Download + decrypt data from 0G
 *   vault_session_log    — Show current session's attestation log
 *   session_commit       — Finalize session, publish Merkle root
 *   vault_balance        — Check wallet balance
 *   vault_status         — Show vault status and session info
 *   vault_share          — Store + generate share descriptor for another agent
 *   vault_import         — Retrieve shared memory from another agent
 *
 * Tools (Shared Memory):
 *   memory_write         — Write data to a named shared memory channel
 *   memory_read          — Read recent entries from a shared memory channel
 *   memory_channels      — List all shared memory channels
 *
 * Tools (Autonomy):
 *   autonomy_status      — Show heartbeat, agent tree, and autonomy engine status
 *   autonomy_set_level   — Set autonomy level (off/monitor/suggest/autonomous)
 *   agent_spawn          — Spawn a sub-agent with shared context
 *   agent_list           — List all sub-agents and their status
 *   agent_message        — Send a message to a sub-agent
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { AgentVault } from "./lib/vault.js";
import { SharedMemoryBus } from "./lib/shared-memory.js";
import { MemoryCoordinator } from "./lib/memory-coordinator.js";
import { HeartbeatDaemon } from "./lib/heartbeat.js";
import { AgentRouter } from "./lib/agent-router.js";
import { AutonomyEngine } from "./lib/autonomy.js";
import dotenv from "dotenv";

dotenv.config();

// --- Dashboard bridge (fire-and-forget) ---
const DASHBOARD_API = process.env.DASHBOARD_API || 'http://localhost:3000';
function pushToDashboard(type: string, data: Record<string, any>) {
  fetch(`${DASHBOARD_API}/api/push-event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, data }),
  }).catch((err) => {
    if (process.env.DEBUG_DASHBOARD === "true") {
      console.error(`[MCP] Failed to push event to dashboard (${DASHBOARD_API}):`, err.message);
    }
  }); // silent unless debug is on
}

// --- Validation ---
const required = ["PRIVATE_KEY", "EVM_RPC", "INDEXER_RPC"] as const;
for (const key of required) {
  if (!process.env[key]) {
    console.error(`❌ Missing env var: ${key}. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
}

// --- Initialize Vault + Subsystems ---
const vault = new AgentVault({
  privateKey: process.env.PRIVATE_KEY!,
  evmRpc: process.env.EVM_RPC!,
  indexerRpc: process.env.INDEXER_RPC!,
  vaultSecret: process.env.VAULT_SECRET,
});

const coordinator = new MemoryCoordinator({
  onForkDetected: (fork) => pushToDashboard('memory_fork', fork),
  onHeadUpdated: (receipt) => pushToDashboard('memory_head_updated', receipt),
});
const sharedMemory = new SharedMemoryBus(vault);
sharedMemory.attachCoordinator(coordinator);
const heartbeat = new HeartbeatDaemon(vault, sharedMemory, {
  autonomousMode: process.env.AUTONOMY_MODE === "true",
  baseIntervalMs: parseInt(process.env.HEARTBEAT_INTERVAL_MS ?? "30000", 10),
});
const agentRouter = new AgentRouter(vault, sharedMemory);
const autonomyEngine = new AutonomyEngine(vault, sharedMemory, heartbeat, agentRouter, {
  level: (process.env.AUTONOMY_LEVEL as any) ?? "monitor",
});

sharedMemory.setBroadcastHandler((channel, entry) => {
  pushToDashboard('shared_memory', { channel, entry });
});
agentRouter.setEventHandlers({
  onSpawn: (desc) => pushToDashboard('agent_spawned', desc),
  onMessage: (ch, msg) => pushToDashboard('agent_message', { channel: ch, message: msg }),
});

// --- MCP Server ---
const server = new McpServer({
  name: "silo",
  version: "2.0.0",
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

// =========================================================================
// SHARED MEMORY TOOLS
// =========================================================================

// TOOL 9: Write to shared memory channel
server.tool(
  "memory_write",
  {
    channel: z.string().describe("Named channel to write to (created automatically if new)"),
    data: z.string().describe("Data to write to the shared memory channel"),
    metadata: z.string().optional().describe("Optional JSON metadata"),
  },
  async ({ channel, data, metadata }) => {
    try {
      const parsedMeta = metadata ? JSON.parse(metadata) : undefined;
      const entry = await sharedMemory.write(channel, data, parsedMeta);
      pushToDashboard('memory_write', { channel, rootHash: entry.rootHash, entryId: entry.id });
      return {
        content: [{
          type: "text",
          text: [
            `✅ Written to shared memory channel "${channel}"`,
            `   Entry ID:   ${entry.id}`,
            `   Root Hash:  ${entry.rootHash}`,
            `   Linked to:  ${entry.prevRootHash ?? "none (first entry)"}`,
            ``,
            `   Other agents subscribed to "${channel}" will receive this in real-time.`,
          ].join("\n"),
        }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `❌ Memory write failed: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// TOOL 10: Read from shared memory channel
server.tool(
  "memory_read",
  {
    channel: z.string().describe("Channel name to read from"),
    limit: z.number().optional().describe("Max entries to return (default 10)"),
  },
  async ({ channel, limit }) => {
    try {
      const entries = sharedMemory.read(channel, limit ?? 10);
      if (entries.length === 0) {
        return {
          content: [{
            type: "text",
            text: `📭 Channel "${channel}" is empty or does not exist.`,
          }],
        };
      }

      const formatted = entries.map((e, i) =>
        `  ${i + 1}. [${new Date(e.timestamp).toISOString()}] ${e.data.slice(0, 200)}${e.data.length > 200 ? "..." : ""}`
      ).join("\n");

      return {
        content: [{
          type: "text",
          text: [
            `📋 Shared Memory — "${channel}" (${entries.length} entries)`,
            ``,
            formatted,
          ].join("\n"),
        }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `❌ Memory read failed: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// TOOL 11: List shared memory channels
server.tool(
  "memory_channels",
  {},
  async () => {
    try {
      const channels = sharedMemory.listChannels();
      if (channels.length === 0) {
        return {
          content: [{
            type: "text",
            text: "📭 No shared memory channels exist yet. Use memory_write to create one.",
          }],
        };
      }

      const formatted = channels.map(c =>
        `  • ${c.name} — ${c.entryCount} entries, ${c.subscribers.length} subscribers`
      ).join("\n");

      return {
        content: [{
          type: "text",
          text: [
            `📡 Shared Memory Channels (${channels.length})`,
            ``,
            formatted,
          ].join("\n"),
        }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `❌ Channel list failed: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// =========================================================================
// AUTONOMY + HEARTBEAT TOOLS
// =========================================================================

// TOOL 12: Autonomy status
server.tool(
  "autonomy_status",
  {},
  async () => {
    try {
      const status = autonomyEngine.status();
      const hb = status.heartbeat;
      const agents = status.agents;

      return {
        content: [{
          type: "text",
          text: [
            `🤖 SILO — Autonomy Engine`,
            ``,
            `   Level:        ${status.level}`,
            `   Running:      ${status.running}`,
            `   Heartbeat:    ${hb.running ? "active" : "stopped"} (${hb.sequenceNumber} beats)`,
            `   Uptime:       ${Math.round(hb.uptime / 1000)}s`,
            `   Sub-agents:   ${agents.childCount}`,
            `   Decisions:    ${status.recentDecisions.length}`,
            `   Fixes:        ${status.recentFixes.length}`,
            `   Diagnostics:  ${status.diagnosticHandlers.join(", ") || "none"}`,
            ``,
            `   Tasks:`,
            ...hb.registeredTasks.map(t =>
              `     • ${t.name} (${t.type}) — ${t.enabled ? "active" : "disabled"}, ran ${t.runCount}x`
            ),
            ``,
            `   Sub-agents:`,
            ...(agents.children.length === 0
              ? ["     (none)"]
              : agents.children.map(c =>
                `     • ${c.id.slice(0, 8)} [${c.role}] — ${c.status} (${c.autonomy})`
              )),
          ].join("\n"),
        }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `❌ Status failed: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// TOOL 13: Set autonomy level
server.tool(
  "autonomy_set_level",
  {
    level: z.enum(["off", "monitor", "suggest", "autonomous"]).describe(
      "Autonomy level: off (disabled), monitor (observe only), suggest (recommend fixes), autonomous (auto-fix)"
    ),
  },
  async ({ level }) => {
    try {
      autonomyEngine.setLevel(level);

      if (level !== "off" && !autonomyEngine.isRunning) {
        autonomyEngine.start();
      } else if (level === "off" && autonomyEngine.isRunning) {
        autonomyEngine.stop();
      }

      pushToDashboard('autonomy_level_changed', { level });

      return {
        content: [{
          type: "text",
          text: [
            `⚙️ Autonomy level set to: ${level}`,
            ``,
            level === "off" ? "   Engine stopped. No autonomous actions will occur." :
              level === "monitor" ? "   Monitoring mode. Issues will be logged but not acted on." :
                level === "suggest" ? "   Suggest mode. Fixes will be recommended but not applied." :
                  "   🚀 FULLY AUTONOMOUS. Heartbeat active. Fixes will be applied automatically.",
            ``,
            level === "autonomous" ? "   The heartbeat daemon is now running periodic health checks,\n   auto-committing sessions, and syncing shared memory." : "",
          ].join("\n"),
        }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `❌ Failed to set level: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// TOOL 14: Spawn a sub-agent
server.tool(
  "agent_spawn",
  {
    role: z.string().describe("Role/purpose of the sub-agent (e.g. 'code-reviewer', 'bug-fixer', 'researcher')"),
    context: z.string().optional().describe("Initial context/instructions to pass to the sub-agent"),
    contextRootHashes: z.string().optional().describe("Comma-separated 0G root hashes of shared memory to inherit"),
    autonomy: z.enum(["supervised", "autonomous"]).optional().describe("Autonomy level for the sub-agent"),
  },
  async ({ role, context, contextRootHashes, autonomy }) => {
    try {
      const rootHashes = contextRootHashes?.split(",").map(h => h.trim()).filter(Boolean) ?? [];

      const descriptor = await agentRouter.spawn({
        role,
        contextData: context,
        contextRootHashes: rootHashes,
        autonomy: autonomy ?? "supervised",
      });

      pushToDashboard('agent_spawned', descriptor);

      return {
        content: [{
          type: "text",
          text: [
            `🚀 Sub-agent spawned`,
            ``,
            `   ID:        ${descriptor.id}`,
            `   Role:      ${descriptor.role}`,
            `   Channel:   ${descriptor.channelName}`,
            `   Autonomy:  ${descriptor.autonomy}`,
            `   Status:    ${descriptor.status}`,
            ``,
            `   Context:   ${rootHashes.length > 0 ? `${rootHashes.length} shared memory entries inherited` : "inline context provided"}`,
            ``,
            `   Use agent_message to communicate with this agent.`,
            `   Use memory_read on channel "${descriptor.channelName}" to see messages.`,
          ].join("\n"),
        }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `❌ Spawn failed: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// TOOL 15: List sub-agents
server.tool(
  "agent_list",
  {},
  async () => {
    try {
      const status = agentRouter.status();

      if (status.children.length === 0) {
        return {
          content: [{
            type: "text",
            text: "📭 No sub-agents spawned. Use agent_spawn to create one.",
          }],
        };
      }

      const formatted = status.children.map(c => [
        `  • ${c.id.slice(0, 8)}... [${c.role}]`,
        `    Status:   ${c.status}`,
        `    Channel:  ${c.channelName}`,
        `    Autonomy: ${c.autonomy}`,
        `    Context:  ${c.contextRootHashes.length} inherited entries`,
        `    Created:  ${new Date(c.createdAt).toISOString()}`,
      ].join("\n")).join("\n\n");

      return {
        content: [{
          type: "text",
          text: [
            `🤖 Sub-agents (${status.children.length})`,
            ``,
            formatted,
          ].join("\n"),
        }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `❌ List failed: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// TOOL 16: Send message to a sub-agent
server.tool(
  "agent_message",
  {
    agentId: z.string().describe("The sub-agent ID to message"),
    message: z.string().describe("The message/instruction to send"),
  },
  async ({ agentId, message }) => {
    try {
      const entry = await agentRouter.instruct(agentId, message);
      pushToDashboard('agent_message', { agentId, channel: entry.channel });

      return {
        content: [{
          type: "text",
          text: [
            `📨 Message sent to sub-agent ${agentId.slice(0, 8)}...`,
            `   Channel:    ${entry.channel}`,
            `   Root Hash:  ${entry.rootHash}`,
            ``,
            `   The message is now on the shared memory channel,`,
            `   encrypted and persisted on 0G.`,
          ].join("\n"),
        }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `❌ Message failed: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// =========================================================================
// MEMORY INDEX + COORDINATION TOOLS
// =========================================================================

// TOOL 17: Search the memory index
server.tool(
  "memory_search",
  {
    label: z.string().optional().describe("Search by label (fuzzy match)"),
    tags: z.string().optional().describe("Comma-separated tags to filter by"),
    channel: z.string().optional().describe("Filter by channel name"),
    contentType: z.string().optional().describe("Filter by type: data, shared_memory, attestation_trace, snapshot, agent_descriptor, fix_record, heartbeat"),
    limit: z.number().optional().describe("Max results (default 20)"),
  },
  async ({ label, tags, channel, contentType, limit }) => {
    try {
      const index = sharedMemory.getIndex();
      const results = index.search({
        label,
        tags: tags?.split(",").map(t => t.trim()).filter(Boolean),
        channel,
        contentType: contentType as any,
        limit: limit ?? 20,
      });

      if (results.length === 0) {
        return {
          content: [{
            type: "text",
            text: "📭 No entries match your search. Try broader criteria or use memory_index_stats to see what's indexed.",
          }],
        };
      }

      const formatted = results.map((e, i) => [
        `  ${i + 1}. ${e.label}`,
        `     Root Hash:  ${e.rootHash.slice(0, 20)}...`,
        `     Tags:       ${e.tags.join(", ")}`,
        `     Channel:    ${e.channel ?? "none"}`,
        `     Type:       ${e.contentType}`,
        `     Author:     ${e.authorId.slice(0, 10)}...`,
        `     Created:    ${new Date(e.createdAt).toISOString()}`,
      ].join("\n")).join("\n\n");

      return {
        content: [{
          type: "text",
          text: [
            `🔍 Memory Index — ${results.length} result${results.length !== 1 ? "s" : ""}`,
            ``,
            formatted,
            ``,
            `Use vault_retrieve with a Root Hash above to decrypt its contents.`,
          ].join("\n"),
        }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `❌ Search failed: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// TOOL 18: Look up what a root hash contains
server.tool(
  "memory_lookup",
  {
    rootHash: z.string().describe("The 0G root hash to look up in the index"),
  },
  async ({ rootHash }) => {
    try {
      const entry = sharedMemory.lookupRootHash(rootHash);
      if (!entry) {
        return {
          content: [{
            type: "text",
            text: `📭 Root hash not found in the index. It may exist on 0G but wasn't stored through SILO's indexed channels.`,
          }],
        };
      }

      return {
        content: [{
          type: "text",
          text: [
            `📋 Index Entry for ${rootHash.slice(0, 20)}...`,
            ``,
            `   Label:        ${entry.label}`,
            `   Tags:         ${entry.tags.join(", ")}`,
            `   Channel:      ${entry.channel ?? "none"}`,
            `   Content Type: ${entry.contentType}`,
            `   Author:       ${entry.authorId.slice(0, 10)}...`,
            `   Size:          ${entry.size} bytes`,
            `   Created:      ${new Date(entry.createdAt).toISOString()}`,
            `   Content Hash: ${entry.contentHash.slice(0, 16)}...`,
            entry.description ? `   Description:  ${entry.description}` : "",
          ].filter(Boolean).join("\n"),
        }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `❌ Lookup failed: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// TOOL 19: Memory index stats
server.tool(
  "memory_index_stats",
  {},
  async () => {
    try {
      const index = sharedMemory.getIndex();
      const stats = index.stats();
      const allTags = index.allTags();
      const channels = sharedMemory.listChannels();
      const coordStatus = coordinator.listChannels();

      return {
        content: [{
          type: "text",
          text: [
            `📊 SILO — Memory Index Stats`,
            ``,
            `   Total Indexed:   ${stats.totalEntries}`,
            `   Unique Tags:     ${stats.uniqueTags}`,
            `   Channels:        ${stats.uniqueChannels}`,
            `   Authors:         ${stats.uniqueAuthors}`,
            ``,
            `   By Content Type:`,
            ...Object.entries(stats.byContentType).map(([type, count]) =>
              `     • ${type}: ${count}`
            ),
            ``,
            `   Tags: ${allTags.slice(0, 20).join(", ")}${allTags.length > 20 ? ` (+${allTags.length - 20} more)` : ""}`,
            ``,
            `   Channel Coordination:`,
            ...coordStatus.map(c =>
              `     • ${c.head.channel} — v${c.head.version}${c.locked ? ` 🔒 (${c.lockHolder?.slice(0, 8)}...)` : ""}`
            ),
            ...(coordStatus.length === 0 ? ["     (no coordinated channels)"] : []),
            ``,
            `   Detected Forks: ${coordinator.getForks().filter(f => !f.resolved).length} unresolved`,
          ].join("\n"),
        }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `❌ Stats failed: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// --- Launch ---
async function main() {
  await vault.init();

  if (process.env.AUTONOMY_MODE === "true") {
    autonomyEngine.start();
    console.error("🤖 Autonomy engine started in autonomous mode");
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("🛡️ SILO MCP server running (v2.0 — shared memory + autonomy + coordination)");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
