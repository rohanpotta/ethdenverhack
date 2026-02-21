# SILO — Encrypted Agent Memory on 0G

**Drop-in encrypted memory + execution attestation for AI agents, powered by 0G Storage.**

AI agents handle sensitive data — medical records, financial info, personal preferences — and store it in plaintext. SILO fixes this: every piece of agent memory is encrypted with AES-256-GCM, stored on 0G's decentralized network, and attested in a Merkle tree that proves exactly what the agent did — without revealing what it stored.

## What's Inside

| Directory | What it does |
|---|---|
| **`0g-agent-shield/`** | Core library + MCP server (8 tools) + CLI tools (doctor, verify, demo) |
| **`0g-agent-shield-ui/`** | Real-time dashboard — Merkle tree visualization, event log, onboarding guide |
| **`create-silo-app/`** | Scaffold CLI — `npx create-silo-app my-agent` generates a working project |

## Quick Start

### Option A: Scaffold a new agent (recommended)

```bash
npx create-silo-app my-agent
cd my-agent
# Edit .env: add your 0G wallet private key (64-char hex, no 0x prefix)
# Get testnet tokens: https://faucet.0g.ai
npm run build && npm run demo
```

### Option B: Add to an existing project

```bash
npm install silo-agent
```

```typescript
import { AgentVault } from "silo-agent";

const vault = new AgentVault({
  privateKey: process.env.PRIVATE_KEY!,
  evmRpc: process.env.EVM_RPC!,
  indexerRpc: process.env.INDEXER_RPC!,
});
await vault.init();

const { rootHash } = await vault.store("sensitive data", "label");
const decrypted = await vault.retrieve(rootHash);
```

### Option C: From source

```bash
git clone https://github.com/rohanpotta/ethdenverhack.git
cd ethdenverhack/0g-agent-shield
npm install
cp .env.example .env
# Edit .env: add your 0G wallet private key (64-char hex, no 0x prefix)

npm run build
npm run doctor    # Checks: key, RPC, balance, encryption
npm run demo      # Store → Retrieve → Commit attestation
```

## Connect to Claude Desktop / Cursor

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "silo": {
      "command": "npx",
      "args": ["silo-agent", "mcp"],
      "env": {
        "PRIVATE_KEY": "your_0g_wallet_private_key_no_0x_prefix",
        "EVM_RPC": "https://evmrpc-testnet.0g.ai",
        "INDEXER_RPC": "https://indexer-storage-testnet-turbo.0g.ai"
      }
    }
  }
}
```

No absolute paths needed — `npx` resolves the package automatically.

Restart Claude Desktop. Your agent now has 8 vault tools: `vault_store`, `vault_retrieve`, `vault_share`, `vault_import`, `session_commit`, `vault_session_log`, `vault_balance`, `vault_status`.

### CLI Tools

```bash
npx silo-agent mcp           # Start MCP server
npx silo-agent doctor        # Validate environment
npx silo-agent demo          # Full demo cycle
npx silo-agent verify <hash> # Verify stored data
npx silo-agent start         # API + WebSocket server
```

## Multi-Agent Sharing

Two agents with the same `VAULT_SECRET` can pass encrypted memories through 0G:

```
Agent A:  vault_share("patient vitals: HR 72, BP 120/80")
          → rootHash: 0xabc123...

Agent B:  vault_import("0xabc123...")
          → decrypted: "patient vitals: HR 72, BP 120/80"
```

Both actions are recorded in each agent's Merkle attestation tree.

## Dashboard

```bash
# Terminal 1: API server
cd 0g-agent-shield && npm start

# Terminal 2: Dashboard
cd 0g-agent-shield-ui && npm run dev
# Open http://localhost:5173
```

Real-time monitoring: live event feed, D3 Merkle tree visualization, agent sandbox, and a step-by-step onboarding guide.

## Architecture

```
┌─────────────────────────────────────────────────┐
│            MCP Server (mcp.ts)                  │
│         8 tools for any AI client               │
└───────────────────┬─────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────┐
│             AgentVault (vault.ts)                │
│       Unified API: store / retrieve / commit    │
└──┬──────────────┬──────────────────┬────────────┘
   │              │                  │
   ▼              ▼                  ▼
┌────────┐  ┌──────────┐  ┌──────────────────┐
│ Crypto │  │ Storage  │  │  Attestation     │
│AES-256 │  │ 0G SDK   │  │  Merkle Tree     │
│GCM     │  │ Upload/  │  │  Event Hashing   │
│PBKDF2  │  │ Download │  │  Session Commit  │
└────────┘  └──────────┘  └──────────────────┘
```

## Tests

```bash
cd 0g-agent-shield
npm test    # 35 tests: crypto (14) + attestation (21)
```

## License

MIT
