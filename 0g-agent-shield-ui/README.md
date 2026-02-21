# SILO Dashboard UI

React + Vite dashboard for visualizing SILO vault activity in real time.

## What You Can See

- Live vault events (`store`, `retrieve`, `session_commit`)
- DeFAI Safe Execution Copilot tab (`intent -> plan -> guardrails -> approval`)
- Merkle tree and attestation flow visualization
- Multi-agent memory-sharing panel
- Event log stream from API + MCP bridge

## Prerequisites

- Node.js 18+
- Backend running from `0g-agent-shield/` (`npm start`)

Default backend URL is `http://localhost:3000`.

## Run Locally

```bash
cd 0g-agent-shield-ui
npm install
npm run dev
```

Open `http://localhost:5173`.

## Build

```bash
npm run build
npm run preview
```

## Demo Pairing (Recommended)

Terminal 1:
```bash
cd 0g-agent-shield
npm start
```

Terminal 2:
```bash
cd 0g-agent-shield-ui
npm run dev
```

Then trigger actions via:
- dashboard controls, or
- MCP tools (`vault_store`, `vault_retrieve`, `session_commit`)

The UI should update immediately via WebSocket events.
