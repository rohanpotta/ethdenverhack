# SILO DeFAI Demo Prompt (Approve + Reject Paths)

Paste this into Claude Desktop/Cursor with SILO MCP enabled.

```text
Use SILO MCP tools only. Do not use autonomy tools.

Run one end-to-end DeFAI scenario with strict safety:

1) defai_plan with:
   intent: "Rebalance 500 USD from ETH to USDC with strict risk controls"
   tokenIn: "ETH"
   tokenOut: "USDC"
   amountUsd: 500
   maxSlippageBps: 75
   timeoutSec: 90
   maxNotionalUsd: 1000
   tokenAllowlist: "ETH,USDC,DAI,WBTC"

2) Summarize:
   - planId
   - risk level + explanation
   - preview (expectedOutUsd, minOutUsd, priceImpactBps, route)
   - compute provider used

3) defai_approve with:
   planId: <planId from step 1>
   approved: true
   reason: "User approved after reviewing risk and dry-run payload"

4) defai_approve again (rejection path) with:
   planId: <same planId>
   approved: false
   reason: "User rejected to verify explicit halt behavior"

5) Final report:
   - approval artifact root hashes / tx hashes
   - rejection artifact root hashes / tx hashes
   - confirmation that execution mode is dry_run_only (no auto broadcast)
```

## What Judges Should See

- AI produces a structured decision, not chat-only output.
- Guardrails and simulation preview are explicit.
- User remains in control via approve/reject gate.
- Both outcomes are auditable with 0G artifact hashes.
- Execution stays non-custodial/non-autonomous in this MVP.
