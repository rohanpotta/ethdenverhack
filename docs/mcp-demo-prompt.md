# SILO MCP Demo Prompt (Manual, No Autonomy)

Use this exact prompt in Claude Desktop or Cursor.

```text
Use SILO MCP tools only. Do not use autonomy tools.

Run this sequence exactly and report outputs after each step:

1) vault_status
2) vault_store with:
   data: "Demo note: lot #A17, temp 6C, custodian Node-1"
   label: "demo_note"
3) vault_retrieve using the rootHash from step 2
4) vault_share with:
   data: "Shared memo: release approved by QA"
   withAgent: "agent-b"
5) vault_import using the share rootHash from step 4
6) memory_write with:
   channel: "app:backend"
   data: "checkpoint: backend online"
7) memory_read with:
   channel: "app:backend"
   limit: 5
8) vault_session_log
9) session_commit
10) vault_balance

Rules:
- Keep all actions manual (no autonomous planner/heartbeat/sub-agents).
- Include all root hashes, tx hashes, session id, and event count in the final summary.
```

## Expected Demo Signals

- You see encrypted store/retrieve lifecycle and returned `rootHash`.
- `vault_session_log` shows event count and Merkle root.
- `session_commit` returns attestation metadata (`traceRootHash`, `traceTxHash`).
- Dashboard event log updates in real time if connected.
