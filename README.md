# SILO — Encrypted Agent Memory on 0G

**Drop-in encrypted memory + execution attestation for AI agents, powered by 0G Storage.**

AI agents handle sensitive data — medical records, financial info, personal preferences — and store it in plaintext. SILO fixes this: every piece of agent memory is encrypted with AES-256-GCM, stored on 0G's decentralized network, and attested in a Merkle tree that proves exactly what the agent did — without revealing what it stored.

## What's Inside

| Directory | What it does |
|---|---|
| **`0g-agent-shield/`** | Core library + MCP server (21 tools total, including DeFAI tools) + CLI tools (doctor, verify, demo) |
| **`0g-agent-shield-ui/`** | Real-time dashboard — Merkle tree visualization, event log, onboarding guide |
| **`create-silo-app/`** | Scaffold CLI — `npx create-silo-app my-agent` generates a working project |

## Judge Path (3 Minutes)

Run this exact flow to validate the core promise: encrypted memory on 0G + verifiable attestation.

1. Install and configure:
```bash
cd 0g-agent-shield
npm install
cp .env.example .env
# Edit .env: PRIVATE_KEY, EVM_RPC, INDEXER_RPC
npm run build
```
2. Validate environment:
```bash
npm run doctor
```
Expected: `✅ PRIVATE_KEY set`, `✅ EVM RPC reachable`, `✅ Wallet balance`, `✅ Encryption round-trip`, then `🎉 All checks passed`.

3. Run end-to-end memory + proof flow:
```bash
npm run demo
```
Expected: `Stored!`, `Decrypted`, `Session attestation committed to 0G`, plus a `Merkle Root` and `Trace Hash`.

## Friction Metric (Measured)

- **One-command bootstrap artifact:** `npx create-silo-app my-agent`
- **Measured on February 21, 2026:** `0.63s` to generate a ready project skeleton in offline-fast-fail mode
- **Commands from scaffold to first full run:** `3` (`npm install`, `npm run build`, `npm run demo`)

Full command transcript and measurement notes: `docs/friction-metrics.md`.

## DeFAI + 0G Compute MVP Path

SILO now includes a **DeFAI Safe Execution Copilot** flow:

- Intent -> structured execution plan
- Guardrails (`maxSlippageBps`, allowlist, timeout, notional caps)
- Risk explanation + simulation preview
- Explicit user approval gate before execution
- Encrypted plan + approval artifacts stored on 0G with attestation trail

Run terminal demo:

```bash
cd 0g-agent-shield
npm run build
npm run defai:demo
```

Optional 0G Compute integration:

```bash
export OG_COMPUTE_URL="https://your-0g-compute-endpoint"
```

When set, SILO attempts to fetch planning rationale from 0G Compute and falls back safely to local heuristics if unavailable.

For the 0G starter-kit query API (`/api/services/query`), also set:

```bash
export OG_COMPUTE_PROVIDER_ADDRESS="0xyour_provider"
export OG_COMPUTE_FALLBACK_FEE="0.01"
```

### One-Prompt MCP Demo (Compute)

In Claude Desktop (with SILO MCP configured), paste:

```text
Use SILO MCP tools only. Do not use autonomy tools.
1) Run defai_plan with:
   intent: "Rebalance 500 USD from ETH to USDC with strict risk limits"
   tokenIn: "ETH"
   tokenOut: "USDC"
   amountUsd: 500
   maxSlippageBps: 75
   timeoutSec: 90
   maxNotionalUsd: 1000
   tokenAllowlist: "ETH,USDC,DAI,WBTC"
2) Save returned planId.
3) Run defai_approve with:
   planId: <that planId>
   approved: true
   reason: "User approved after reviewing simulation and risk rationale"
4) Summarize compute provider used, rationale, and artifact root hashes.
```

On the dashboard/event log you should see `defai_plan` and `defai_approved` events.

### DeFAI Scenario Card (Judge-Ready)

- Intent: `Rebalance 500 USD from ETH to USDC`
- Guardrails: `maxSlippageBps=75`, `timeoutSec=90`, `maxNotionalUsd=1000`, allowlist=`ETH,USDC,DAI,WBTC`
- AI output: structured plan with route preview, risk rationale, and simulation (`expectedOutUsd`, `minOutUsd`)
- User control: explicit `defai_approve` / `defai_reject` gate before any execution
- Evidence: plan + approval artifacts encrypted to 0G with attestation trail
- Execution mode in this MVP: `dry_run_only` (no automatic transaction broadcast)

### DeFAI Safety Guarantees

- No transaction is auto-broadcast by SILO DeFAI MVP.
- Guardrail violations block planning before approval.
- User approval is mandatory and explicit for every plan.
- Rejection path is first-class (`defai_rejected`) and halts execution intent.
- Plan and approval artifacts are persisted on 0G for post-hoc auditability.

### DeFAI Scope Boundary (Honest MVP)

SILO currently stops at planning + safety + approval + dry-run execution payload.  
Execution adapters are pluggable via `execute(plan)` style integration and intentionally out-of-scope for this MVP.

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

## Common Failures (Fast Fixes)

- `EADDRINUSE: address already in use :::3000`
  - Cause: another process already uses port `3000`.
  - Fix:
    ```bash
    lsof -i :3000
    kill -9 <PID>
    npm start
    ```
- `ngrok ERR_NGROK_334` endpoint already online
  - Cause: previous tunnel is still active.
  - Fix:
    ```bash
    pkill -f ngrok
    ngrok http 3000
    ```
- `MCP silo: ... is not valid JSON`
  - Cause: non-protocol logs leaked to MCP stdout.
  - Fix:
    - Upgrade to latest `silo-agent`.
    - Keep MCP as `npx silo-agent mcp` (do not wrap in extra shell logging).
    - Restart Claude Desktop after config updates.
- `0 balance — get testnet tokens from https://faucet.0g.ai`
  - Cause: wallet is unfunded.
  - Fix:
    - Fund the exact address in your MCP/backend `PRIVATE_KEY` via faucet.
    - Re-run `npm run doctor`.

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

DeFAI MCP tools are also available: `defai_plan`, `defai_approve`.

If your MCP process pushes events through a public URL (for example ngrok), set the same `PUSH_EVENT_TOKEN` in both backend `.env` and MCP env to authorize `/api/push-event`.

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
│         21 tools for any AI client              │
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
