#!/usr/bin/env node

import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execSync } from 'node:child_process';

const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const PURPLE = '\x1b[35m';
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';

function log(msg) { console.log(msg); }
function step(msg) { log(`\n${PURPLE}>${RESET} ${msg}`); }
function done(msg) { log(`  ${GREEN}✓${RESET} ${msg}`); }

// ── Parse args ──
const args = process.argv.slice(2);
const projectName = args[0];

if (!projectName || projectName === '--help' || projectName === '-h') {
    log(`
${BOLD}${PURPLE}create-silo-app${RESET} — Scaffold an AI agent with encrypted memory on 0G

${BOLD}Usage:${RESET}
  npx create-silo-app ${CYAN}my-agent${RESET}

${BOLD}What it creates:${RESET}
  my-agent/
  ├── src/
  │   └── agent.ts          ${DIM}# Example: store, retrieve, commit${RESET}
  ├── package.json           ${DIM}# Dependencies pre-configured${RESET}
  ├── tsconfig.json
  ├── .env                   ${DIM}# Add your private key here${RESET}
  ├── claude-desktop-config.json
  └── README.md

${BOLD}Then:${RESET}
  cd my-agent
  npm install
  ${DIM}# Add your private key to .env${RESET}
  npm run build && npm run demo
`);
    process.exit(0);
}

const projectDir = resolve(projectName);

if (existsSync(projectDir)) {
    log(`\n${YELLOW}Error:${RESET} Directory "${projectName}" already exists.\n`);
    process.exit(1);
}

log(`\n${BOLD}${PURPLE}SILO${RESET} ${DIM}— Encrypted Agent Memory on 0G${RESET}\n`);
step(`Creating project: ${BOLD}${projectName}${RESET}`);

mkdirSync(join(projectDir, 'src'), { recursive: true });

// ── package.json ──
writeFileSync(join(projectDir, 'package.json'), JSON.stringify({
    name: projectName,
    version: '0.1.0',
    type: 'module',
    scripts: {
        build: 'tsc',
        demo: 'node build/agent.js',
        doctor: 'npx silo doctor',
    },
    dependencies: {
        '0g-agent-shield': 'github:rohanpotta/ethdenverhack#main',
        dotenv: '^16.4.7',
    },
    devDependencies: {
        '@types/node': '^22.10.10',
        typescript: '^5.7.3',
    },
}, null, 2) + '\n');
done('package.json');

// ── tsconfig.json ──
writeFileSync(join(projectDir, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        outDir: './build',
        rootDir: './src',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        declaration: true,
        sourceMap: true,
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'build'],
}, null, 2) + '\n');
done('tsconfig.json');

// ── .env ──
writeFileSync(join(projectDir, '.env'), `# SILO Configuration
# Get testnet tokens: https://faucet.0g.ai

# Your wallet private key (no 0x prefix)
PRIVATE_KEY=your_private_key_here

# 0G Network RPCs (testnet defaults)
EVM_RPC=https://evmrpc-testnet.0g.ai
INDEXER_RPC=https://indexer-storage-testnet-turbo.0g.ai

# Optional: custom encryption passphrase (defaults to PRIVATE_KEY)
# VAULT_SECRET=your_custom_passphrase
`);
done('.env');

// ── .gitignore ──
writeFileSync(join(projectDir, '.gitignore'), `node_modules/
build/
.env
*.js.map
.DS_Store
`);
done('.gitignore');

// ── claude-desktop-config.json ──
const absPath = join(projectDir, 'build/agent.js').replace(/\\/g, '/');
writeFileSync(join(projectDir, 'claude-desktop-config.json'), JSON.stringify({
    mcpServers: {
        silo: {
            command: 'node',
            args: [absPath],
            env: {
                PRIVATE_KEY: 'your_private_key',
                EVM_RPC: 'https://evmrpc-testnet.0g.ai',
                INDEXER_RPC: 'https://indexer-storage-testnet-turbo.0g.ai',
            },
        },
    },
}, null, 2) + '\n');
done('claude-desktop-config.json');

// ── src/agent.ts ──
writeFileSync(join(projectDir, 'src/agent.ts'), `/**
 * ${projectName} — AI Agent with Encrypted Memory on 0G
 *
 * Scaffolded with create-silo-app
 *
 * This example demonstrates:
 *   1. Storing encrypted data on 0G
 *   2. Retrieving and decrypting it
 *   3. Committing a Merkle attestation of the session
 */

import { AgentVault } from "0g-agent-shield";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  // ── Initialize the vault ──
  const vault = new AgentVault({
    privateKey: process.env.PRIVATE_KEY!,
    evmRpc: process.env.EVM_RPC!,
    indexerRpc: process.env.INDEXER_RPC!,
    vaultSecret: process.env.VAULT_SECRET,
  });
  await vault.init();

  console.log(\`\\n\${"═".repeat(50)}\`);
  console.log(\`  SILO — \${vault.address.slice(0, 10)}...\`);
  console.log(\`\${"═".repeat(50)}\\n\`);

  // ── 1. Store encrypted data ──
  console.log("1. Storing encrypted data on 0G...");
  const { rootHash, contentHash, size } = await vault.store(
    "Sensitive agent memory: patient vitals HR 72, BP 120/80",
    "medical_data"
  );
  console.log(\`   Root Hash:    \${rootHash}\`);
  console.log(\`   Content Hash: \${contentHash.slice(0, 16)}...\`);
  console.log(\`   Size:         \${size} bytes\\n\`);

  // ── 2. Retrieve and decrypt ──
  console.log("2. Retrieving and decrypting from 0G...");
  const decrypted = await vault.retrieve(rootHash);
  console.log(\`   Decrypted:    \${decrypted}\\n\`);

  // ── 3. Commit attestation ──
  console.log("3. Committing Merkle attestation to 0G...");
  const proof = await vault.commitSession();
  console.log(\`   Session ID:   \${proof.sessionId}\`);
  console.log(\`   Events:       \${proof.eventCount}\`);
  console.log(\`   Merkle Root:  \${proof.merkleRoot.slice(0, 32)}...\`);
  console.log(\`   Trace Hash:   \${proof.traceRootHash}\\n\`);

  console.log("Done. Your agent's memory is encrypted and attested on 0G.");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
`);
done('src/agent.ts');

// ── README.md ──
writeFileSync(join(projectDir, 'README.md'), `# ${projectName}

AI agent with encrypted memory on 0G, powered by [SILO](https://github.com/rohanpotta/ethdenverhack).

## Quick Start

\`\`\`bash
# Install dependencies
npm install

# Add your private key to .env
# Get testnet tokens: https://faucet.0g.ai

# Build and run the demo
npm run build
npm run demo
\`\`\`

## Connect to Claude Desktop

Copy \`claude-desktop-config.json\` contents into:
- **Mac**: \`~/Library/Application Support/Claude/claude_desktop_config.json\`
- **Windows**: \`%APPDATA%\\\\Claude\\\\claude_desktop_config.json\`

Then restart Claude Desktop. Your agent now has 8 vault tools available.

## What This Does

- **\`vault_store\`** — Encrypts data with AES-256-GCM and uploads to 0G Storage
- **\`vault_retrieve\`** — Downloads and decrypts from 0G
- **\`vault_share\`** / **\`vault_import\`** — Share encrypted memories between agents
- **\`session_commit\`** — Publishes a Merkle root proving what the agent did

## Learn More

- [SILO Documentation](https://github.com/rohanpotta/ethdenverhack)
- [0G Docs](https://docs.0g.ai)
- [0G Faucet](https://faucet.0g.ai)
`);
done('README.md');

// ── Install ──
step('Installing dependencies...');
try {
    execSync('npm install', { cwd: projectDir, stdio: 'pipe' });
    done('Dependencies installed');
} catch {
    log(`  ${YELLOW}!${RESET} npm install failed — run it manually: cd ${projectName} && npm install`);
}

// ── Done ──
log(`\n${GREEN}${BOLD}Done!${RESET} Your SILO agent is ready.\n`);
log(`  ${CYAN}cd ${projectName}${RESET}`);
log(`  ${DIM}# Edit .env with your private key${RESET}`);
log(`  ${CYAN}npm run build && npm run demo${RESET}\n`);
log(`  ${DIM}To connect to Claude Desktop:${RESET}`);
log(`  ${DIM}Copy claude-desktop-config.json into your Claude config${RESET}\n`);
