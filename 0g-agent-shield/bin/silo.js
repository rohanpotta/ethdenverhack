#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const buildDir = join(__dirname, "..", "build");

const commands = {
  mcp:         join(buildDir, "mcp.js"),
  doctor:      join(buildDir, "doctor.js"),
  demo:        join(buildDir, "demo.js"),
  verify:      join(buildDir, "verify.js"),
  start:       join(buildDir, "server.js"),
  "verify-flow": join(buildDir, "verify-flow.js"),
};

const cmd = process.argv[2];

if (!cmd || cmd === "--help" || cmd === "-h") {
  console.log(`
\x1b[1m\x1b[35msilo\x1b[0m — Encrypted Agent Memory on 0G

\x1b[1mUsage:\x1b[0m
  silo <command> [args]

\x1b[1mCommands:\x1b[0m
  mcp           Start the MCP server (for Claude Desktop / Cursor)
  doctor        Validate environment (key, RPC, balance, encryption)
  demo          Run full demo (store → retrieve → commit)
  verify <hash> Verify stored data by root hash
  start         Start the API + WebSocket server
  verify-flow   Debug 0G Flow contract

\x1b[1mExamples:\x1b[0m
  npx silo mcp
  npx silo doctor
  npx silo demo
  npx silo verify 0xabc123...
`);
  process.exit(0);
}

if (!commands[cmd]) {
  console.error(`Unknown command: ${cmd}\nRun 'silo --help' for available commands.`);
  process.exit(1);
}

const args = [commands[cmd], ...process.argv.slice(3)];
try {
  execFileSync("node", args, { stdio: "inherit", env: process.env });
} catch (e) {
  process.exit(e.status ?? 1);
}
