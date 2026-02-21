# test-agent

AI agent with encrypted memory on 0G, powered by [SILO](https://github.com/rohanpotta/ethdenverhack).

## Quick Start

```bash
# Install dependencies
npm install

# Add your private key to .env
# Get testnet tokens: https://faucet.0g.ai

# Build and run the demo
npm run build
npm run doctor
npm start

# Or to run the standalone demo script
npm run demo
```

## Connect to Claude Desktop

Copy `claude-desktop-config.json` contents into:
- **Mac**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\\Claude\\claude_desktop_config.json`

Then restart Claude Desktop. Your agent now has 8 vault tools available.

## What This Does

- **`vault_store`** — Encrypts data with AES-256-GCM and uploads to 0G Storage
- **`vault_retrieve`** — Downloads and decrypts from 0G
- **`vault_share`** / **`vault_import`** — Share encrypted memories between agents
- **`session_commit`** — Publishes a Merkle root proving what the agent did

## Learn More

- [SILO Documentation](https://github.com/rohanpotta/ethdenverhack)
- [0G Docs](https://docs.0g.ai)
- [0G Faucet](https://faucet.0g.ai)
