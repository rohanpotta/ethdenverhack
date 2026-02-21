# SILO

**Encrypted private memory + execution attestation for AI agents, powered by 0G.**

AI agents are accumulating sensitive personal data — medical records, financial info, personal preferences — and storing it in plaintext. SILO fixes this by giving any agent framework encrypted, decentralized memory backed by 0G Storage, with cryptographic proof of every action the agent takes.

---

## What It Does

| Feature | Description |
|---|---|
| **Encrypted Vault** | AES-256-GCM encryption with PBKDF2 key derivation. Data is encrypted in-memory and stored on 0G — never at rest in plaintext. |
| **Execution Attestation** | Every store/retrieve is hashed into a Merkle tree. Commit a session to publish a verifiable proof of agent behavior without revealing content. |
| **Multi-Agent Sharing** | Agents can securely share encrypted memories via `vault_share` and `vault_import` — enabling cross-agent collaboration with cryptographic accountability. |
| **MCP Server** | 8 tools for Claude Desktop, Cursor, or any MCP-compatible client. |
| **Real-Time Dashboard** | Live WebSocket-powered UI showing stores, retrieves, Merkle tree visualization, and session attestation ceremonies. |
| **CLI Tools** | `verify` to prove data exists, `doctor` to validate setup, `demo` to run the full cycle. |

---

## Quick Start

```bash
# Clone and install
git clone https://github.com/rohanpotta/ethdenverhack.git
cd silo

# Install backend
cd 0g-agent-shield
npm install

# Configure
cp .env.example .env
# Edit .env with your private key (get testnet tokens: https://faucet.0g.ai)

# Validate setup
npm run build
npm run doctor

# Start the API server + dashboard backend
npm start

# In a second terminal — start the dashboard UI
cd ../0g-agent-shield-ui
npm install
npm run dev
```

Open `http://localhost:5173` to see the SILO dashboard.

---

## Use With Claude Desktop / Cursor

Add to your MCP config (`~/Library/Application Support/Claude/claude_desktop_config.json` or Cursor MCP settings):

```json
{
  "mcpServers": {
    "silo": {
      "command": "npx",
      "args": ["silo", "mcp"],
      "env": {
        "PRIVATE_KEY": "your_private_key_no_0x_prefix",
        "EVM_RPC": "https://evmrpc-testnet.0g.ai",
        "INDEXER_RPC": "https://indexer-storage-testnet-turbo.0g.ai"
      }
    }
  }
}
```

No build step or absolute paths needed — `npx` resolves the package from npm.

1. Ask Claude: *"Store my medical diagnosis securely"*
2. Claude responds with a root hash and attestation event number
3. Verify: `npx silo verify <rootHash>`

---

## MCP Tools (8)

| Tool | Description |
|---|---|
| `vault_store` | Encrypt data and upload to 0G Storage |
| `vault_retrieve` | Download from 0G and decrypt |
| `vault_session_log` | View the current attestation session |
| `session_commit` | Finalize session: Merkle root + encrypted trace to 0G |
| `vault_balance` | Check wallet balance |
| `vault_status` | Show agent address, session ID, network |
| `vault_share` | Encrypt, store, and generate a share descriptor for another agent |
| `vault_import` | Retrieve and decrypt shared memory from another agent's descriptor |

---

## Multi-Agent Sharing

SILO enables agents to share encrypted memories without exposing plaintext:

```
Agent A (Claude Desktop)              Agent B (Cursor)
    │                                      │
    ├─ vault_share("patient data")         │
    │   → rootHash: 0xabc...              │
    │   → share descriptor ─────────────► │
    │                                      ├─ vault_import("0xabc...")
    │                                      │   → decrypted data
    │                                      │
    └─── Both actions are attested ────────┘
         in their respective Merkle trees
```

Both agents' actions are independently recorded in their attestation sessions. The shared secret (VAULT_SECRET or PRIVATE_KEY) must match for cross-agent decryption.

---

## Dashboard

The real-time dashboard provides:

- **Vault Panel** — Store and retrieve data with live encryption visualization
- **Merkle Tree** — D3.js visualization of the attestation tree building in real-time
- **Agents Panel** — Multi-agent sharing demo with transfer animation
- **Event Log** — Full audit trail of all vault operations
- **SDK Fix Panel** — Documents SILO's contribution to the 0G SDK ecosystem

The dashboard connects to the API server via WebSocket for live event streaming.

---

## Use As a Library

```bash
npm install silo
```

```typescript
import { AgentVault } from "silo";

const vault = new AgentVault({
  privateKey: "abc123...",
  evmRpc: "https://evmrpc-testnet.0g.ai",
  indexerRpc: "https://indexer-storage-testnet-turbo.0g.ai",
});
await vault.init();

// Store encrypted data
const { rootHash } = await vault.store("Patient has arrhythmia");

// Retrieve and decrypt
const data = await vault.retrieve(rootHash);

// Commit attestation (Merkle root + encrypted trace → 0G)
const proof = await vault.commitSession();
console.log(proof.merkleRoot); // public commitment
```

---

## How Attestation Works

```
  Agent Action #1 ──hash──┐
  Agent Action #2 ──hash──┤
  Agent Action #3 ──hash──┼──► Merkle Root (public commitment)
  Agent Action #4 ──hash──┘         │
                                    ▼
                          Published on-chain or
                          stored as verifiable proof

  Full trace (encrypted) ──────────► 0G Storage
                                    (only vault holder can decrypt)
```

**What this proves:**
- The agent performed exactly N actions in this session
- The actions occurred in a specific order
- No actions were added or removed after the fact
- The full trace is available for audit — but only to the key holder

**What this does NOT reveal:**
- What the actual data was
- What the agent's prompts or memory contained
- Any personally identifiable information

---

## Architecture

```
┌────────────────────────────────────────────────────────┐
│                   MCP Server (mcp.ts)                  │
│              8 tools for any AI client                 │
│        pushes events to dashboard via REST             │
└────────────────────┬───────────────────────────────────┘
                     │
┌────────────────────▼───────────────────────────────────┐
│                AgentVault (vault.ts)                    │
│         Unified API: store / retrieve / commit         │
└──┬──────────────┬──────────────────┬───────────────────┘
   │              │                  │
   ▼              ▼                  ▼
┌────────┐  ┌──────────┐  ┌──────────────────┐
│ Crypto │  │ Storage  │  │  Attestation     │
│ AES-256│  │ 0G SDK   │  │  Merkle Tree     │
│ GCM    │  │ Upload/  │  │  Event Hashing   │
│ PBKDF2 │  │ Download │  │  Session Commit  │
└────────┘  └──────────┘  └──────────────────┘

┌────────────────────────────────────────────────────────┐
│              API Server (server.ts)                     │
│    Express REST + Socket.IO WebSocket                  │
│    /api/store  /api/retrieve  /api/attest              │
│    /api/push-event (MCP bridge)  /api/events           │
└────────────────────┬───────────────────────────────────┘
                     │ WebSocket
                     ▼
┌────────────────────────────────────────────────────────┐
│              Dashboard (React + Vite)                   │
│    VaultPanel │ MerkleTree │ AgentsPanel │ EventLog    │
└────────────────────────────────────────────────────────┘
```

---

## CLI Tools

```bash
# Validate your environment
npm run doctor

# Run the full demo cycle
npm run demo

# Verify a specific stored memory
npm run verify -- <rootHash>

# Inspect an attestation trace
npm run verify -- <traceRootHash> --trace

# Check 0G Flow contract state
npm run verify-flow
```

---

## Project Structure

```
silo/
├── 0g-agent-shield/              # Backend — Node.js TypeScript
│   ├── src/
│   │   ├── lib/
│   │   │   ├── crypto.ts         # AES-256-GCM encryption (WebCrypto)
│   │   │   ├── storage.ts        # 0G Storage SDK wrapper + ABI fix
│   │   │   ├── attestation.ts    # Merkle-based execution proofs
│   │   │   └── vault.ts          # Unified public API (AgentVault)
│   │   ├── mcp.ts                # MCP server (8 tools)
│   │   ├── server.ts             # Express API + WebSocket server
│   │   ├── verify.ts             # CLI: verify stored data
│   │   ├── doctor.ts             # CLI: validate environment
│   │   ├── demo.ts               # CLI: full end-to-end demo
│   │   ├── verify-flow.ts        # CLI: 0G Flow contract debugger
│   │   ├── index.ts              # Library exports
│   │   └── tests/                # Unit tests (node:test)
│   │       ├── crypto.test.ts    # 14 tests — encryption round-trips, tamper detection
│   │       └── attestation.test.ts # 21 tests — Merkle tree, session lifecycle
│   ├── claude-desktop-config.json
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
│
├── 0g-agent-shield-ui/           # Frontend — React + Vite + Tailwind
│   ├── src/
│   │   ├── App.tsx               # Dashboard shell (5 views)
│   │   ├── components/
│   │   │   ├── ColdOpen.tsx      # Particle assembly splash screen
│   │   │   ├── VaultPanel.tsx    # Store/Retrieve with HexCascade effect
│   │   │   ├── MerkleTree.tsx    # D3.js Merkle proof visualization
│   │   │   ├── AgentsPanel.tsx   # Multi-agent sharing demo
│   │   │   ├── EventLog.tsx      # Audit trail table
│   │   │   ├── CommitCeremony.tsx # Session commit celebration
│   │   │   ├── SdkDiffPanel.tsx  # SDK contribution showcase
│   │   │   └── effects/          # Visual effects (HexCascade, DotGrid)
│   │   └── hooks/
│   │       └── useHashScramble.ts
│   └── package.json
│
├── .env.example
└── README.md
```

---

## SDK Contribution

During development, we discovered and fixed a breaking ABI mismatch in the 0G TS SDK for the Galileo testnet. The SDK's `submit()` function was missing the required `submitter` address parameter. SILO's storage layer includes a transparent proxy fix that upgrades the transaction payload automatically.

---

## Testing

```bash
cd 0g-agent-shield
npm test
```

Runs 35 unit tests covering:
- **Crypto** (14 tests): Encrypt/decrypt round-trips, tamper detection, cross-key isolation, unicode handling
- **Attestation** (21 tests): Merkle tree construction, session lifecycle, event ordering, edge cases

---

## Why This Matters

Every AI agent project on 0G today builds its own storage integration from scratch. None of them encrypt agent memory. None of them provide verifiable execution proofs.

**SILO is the missing middleware:**
- Drop-in encrypted memory for any agent framework
- Execution attestation that proves agent behavior without revealing data
- Multi-agent sharing with cryptographic accountability
- MCP-native, so it works with the entire AI tooling ecosystem
- Real-time dashboard for monitoring and demo purposes

---

## License

MIT
