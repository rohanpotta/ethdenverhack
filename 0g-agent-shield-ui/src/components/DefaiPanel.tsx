import { useMemo, useState } from "react";

interface DefaiPanelProps {
  apiUrl: string;
}

interface PlanResponse {
  plan: {
    planId: string;
    input: {
      intent: string;
      tokenIn: string;
      tokenOut: string;
      amountUsd: number;
    };
    constraints: {
      maxSlippageBps: number;
      timeoutSec: number;
      maxNotionalUsd: number;
      tokenAllowlist: string[];
    };
    risk: {
      level: "low" | "medium" | "high";
      reasons: string[];
      explanation: string;
    };
    preview: {
      expectedOutUsd: number;
      minOutUsd: number;
      simulatedPriceImpactBps: number;
      route: string[];
    };
    compute: {
      used: boolean;
      provider: string;
      rationale: string;
    };
  };
  dryRunExecution?: {
    mode: string;
    adapter: string;
    broadcast: boolean;
    route: string[];
    minOutUsd: number;
    maxSlippageBps: number;
    timeoutSec: number;
    allowlist: string[];
    steps: Array<{ id: string; action: string; description: string }>;
    note: string;
  };
  artifact: {
    rootHash: string;
    txHash: string;
  };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Unexpected error";
}

export function DefaiPanel({ apiUrl }: DefaiPanelProps) {
  const [intent, setIntent] = useState("Rebalance 500 USD from ETH to USDC with low risk.");
  const [tokenIn, setTokenIn] = useState("ETH");
  const [tokenOut, setTokenOut] = useState("USDC");
  const [amountUsd, setAmountUsd] = useState(500);
  const [maxSlippageBps, setMaxSlippageBps] = useState(75);
  const [timeoutSec, setTimeoutSec] = useState(90);
  const [maxNotionalUsd, setMaxNotionalUsd] = useState(1000);
  const [tokenAllowlist, setTokenAllowlist] = useState("ETH,USDC,DAI,WBTC");
  const [loading, setLoading] = useState(false);
  const [planData, setPlanData] = useState<PlanResponse | null>(null);
  const [approvalState, setApprovalState] = useState<string>("");
  const [error, setError] = useState("");

  const guardrailSummary = useMemo(
    () => `${maxSlippageBps} bps max slip · ${timeoutSec}s timeout · ${maxNotionalUsd} USD cap`,
    [maxNotionalUsd, maxSlippageBps, timeoutSec]
  );

  async function generatePlan() {
    setLoading(true);
    setError("");
    setApprovalState("");
    try {
      const res = await fetch(`${apiUrl}/api/defai/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent,
          tokenIn,
          tokenOut,
          amountUsd,
          guardrails: {
            maxSlippageBps,
            timeoutSec,
            maxNotionalUsd,
            tokenAllowlist: tokenAllowlist
              .split(",")
              .map((t) => t.trim().toUpperCase())
              .filter(Boolean),
          },
        }),
      });
      const data = (await res.json()) as PlanResponse & { error?: string; violations?: string[] };
      if (!res.ok) {
        const details = data.violations?.join(" ") ?? data.error ?? "Plan generation failed.";
        throw new Error(details);
      }
      setPlanData(data);
    } catch (err: unknown) {
      setError(errorMessage(err));
      setPlanData(null);
    } finally {
      setLoading(false);
    }
  }

  async function approvePlan(approved: boolean) {
    if (!planData) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${apiUrl}/api/defai/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: planData.plan.planId,
          approved,
          reason: approved ? "User confirmed after preview" : "User rejected after review",
        }),
      });
      const data = (await res.json()) as { error?: string; nextAction?: string };
      if (!res.ok) throw new Error(data.error ?? "Approval request failed.");
      setApprovalState(
        approved
          ? `Approved. ${data.nextAction ?? "Ready for wallet signature."}`
          : "Rejected. Execution was halted."
      );
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="font-sans text-lg font-semibold tracking-wide">DeFAI Safe Execution Copilot</h2>
        <p className="text-sm text-text-muted mt-2">
          Intent to structured plan with guardrails, simulation preview, and explicit user approval.
        </p>
      </div>

      <div className="glass-panel rounded-lg p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-xs text-text-muted">
            Intent
            <textarea
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              rows={3}
              className="mt-1 w-full bg-base border border-border rounded px-3 py-2 text-sm text-text-primary"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-text-muted">
              Token In
              <input value={tokenIn} onChange={(e) => setTokenIn(e.target.value.toUpperCase())} className="mt-1 w-full bg-base border border-border rounded px-3 py-2 text-sm text-text-primary" />
            </label>
            <label className="text-xs text-text-muted">
              Token Out
              <input value={tokenOut} onChange={(e) => setTokenOut(e.target.value.toUpperCase())} className="mt-1 w-full bg-base border border-border rounded px-3 py-2 text-sm text-text-primary" />
            </label>
            <label className="text-xs text-text-muted">
              Amount (USD)
              <input type="number" value={amountUsd} onChange={(e) => setAmountUsd(Number(e.target.value))} className="mt-1 w-full bg-base border border-border rounded px-3 py-2 text-sm text-text-primary" />
            </label>
            <label className="text-xs text-text-muted">
              Max Slippage (bps)
              <input type="number" value={maxSlippageBps} onChange={(e) => setMaxSlippageBps(Number(e.target.value))} className="mt-1 w-full bg-base border border-border rounded px-3 py-2 text-sm text-text-primary" />
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-xs text-text-muted">
            Timeout (seconds)
            <input type="number" value={timeoutSec} onChange={(e) => setTimeoutSec(Number(e.target.value))} className="mt-1 w-full bg-base border border-border rounded px-3 py-2 text-sm text-text-primary" />
          </label>
          <label className="text-xs text-text-muted">
            Max Notional (USD)
            <input type="number" value={maxNotionalUsd} onChange={(e) => setMaxNotionalUsd(Number(e.target.value))} className="mt-1 w-full bg-base border border-border rounded px-3 py-2 text-sm text-text-primary" />
          </label>
          <label className="text-xs text-text-muted md:col-span-2">
            Token Allowlist (comma separated)
            <input value={tokenAllowlist} onChange={(e) => setTokenAllowlist(e.target.value)} className="mt-1 w-full bg-base border border-border rounded px-3 py-2 text-sm text-text-primary" />
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={generatePlan}
            disabled={loading}
            className="px-4 py-2 rounded bg-primary/20 border border-primary/40 text-primary text-xs font-mono uppercase tracking-wider hover:bg-primary/30 disabled:opacity-50"
          >
            {loading ? "Planning..." : "Generate Plan"}
          </button>
          <span className="text-xs text-text-muted">{guardrailSummary}</span>
        </div>

        {error && <div className="text-xs text-accent-danger">{error}</div>}
      </div>

      {planData && (
        <div className="glass-panel rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-text-muted">Plan ID: <span className="mono-hash text-text-primary">{planData.plan.planId}</span></div>
            <div className="text-xs text-text-muted">Artifact: <span className="mono-hash text-text-primary">{planData.artifact.rootHash}</span></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-base rounded border border-border p-3">
              <div className="label-caps text-text-muted">Risk</div>
              <div className={`mt-1 text-sm font-semibold ${planData.plan.risk.level === "high" ? "text-accent-danger" : planData.plan.risk.level === "medium" ? "text-accent-gold" : "text-primary"}`}>
                {planData.plan.risk.level.toUpperCase()}
              </div>
              <div className="text-xs text-text-muted mt-1">{planData.plan.risk.explanation}</div>
            </div>
            <div className="bg-base rounded border border-border p-3">
              <div className="label-caps text-text-muted">Preview</div>
              <div className="text-xs text-text-muted mt-1">Expected out: ${planData.plan.preview.expectedOutUsd}</div>
              <div className="text-xs text-text-muted">Minimum out: ${planData.plan.preview.minOutUsd}</div>
              <div className="text-xs text-text-muted">Impact: {planData.plan.preview.simulatedPriceImpactBps} bps</div>
            </div>
            <div className="bg-base rounded border border-border p-3">
              <div className="label-caps text-text-muted">Compute</div>
              <div className="text-xs text-text-muted mt-1">Provider: {planData.plan.compute.provider}</div>
              <div className="text-xs text-text-muted">Used: {planData.plan.compute.used ? "yes" : "no"}</div>
            </div>
          </div>

          <div className="bg-base rounded border border-border p-3">
            <div className="label-caps text-text-muted">Why This Plan</div>
            <p className="text-xs text-text-muted mt-1">{planData.plan.compute.rationale}</p>
          </div>

          {planData.dryRunExecution && (
            <div className="bg-base rounded border border-border p-3 space-y-2">
              <div className="label-caps text-text-muted">Dry-Run Execution (No Broadcast)</div>
              <div className="text-xs text-text-muted">
                Adapter: <span className="text-text-primary">{planData.dryRunExecution.adapter}</span> · Broadcast:{" "}
                <span className="text-text-primary">{planData.dryRunExecution.broadcast ? "yes" : "no"}</span>
              </div>
              <div className="text-xs text-text-muted">
                Route: <span className="text-text-primary">{planData.dryRunExecution.route.join(" -> ")}</span>
              </div>
              <div className="text-xs text-text-muted">
                Min Out: ${planData.dryRunExecution.minOutUsd} · Max Slip: {planData.dryRunExecution.maxSlippageBps} bps · Timeout: {planData.dryRunExecution.timeoutSec}s
              </div>
              <div className="text-xs text-text-muted">
                Note: {planData.dryRunExecution.note}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={() => approvePlan(true)}
              disabled={loading}
              className="px-4 py-2 rounded bg-primary/20 border border-primary/40 text-primary text-xs font-mono uppercase tracking-wider hover:bg-primary/30 disabled:opacity-50"
            >
              Approve Plan
            </button>
            <button
              onClick={() => approvePlan(false)}
              disabled={loading}
              className="px-4 py-2 rounded bg-accent-danger/10 border border-accent-danger/40 text-accent-danger text-xs font-mono uppercase tracking-wider hover:bg-accent-danger/20 disabled:opacity-50"
            >
              Reject Plan
            </button>
            <span className="text-xs text-text-muted">No transaction can execute without this explicit approval.</span>
          </div>

          {approvalState && (
            <div className="text-xs text-primary">{approvalState}</div>
          )}
        </div>
      )}
    </div>
  );
}
