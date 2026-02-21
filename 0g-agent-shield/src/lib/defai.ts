export interface Guardrails {
  maxSlippageBps: number;
  timeoutSec: number;
  tokenAllowlist: string[];
  maxNotionalUsd: number;
}

export interface PlanInput {
  intent: string;
  tokenIn: string;
  tokenOut: string;
  amountUsd: number;
  guardrails: Guardrails;
}

export interface PlanStep {
  id: string;
  action: "quote" | "approve" | "swap" | "confirm";
  description: string;
}

export interface RiskReport {
  level: "low" | "medium" | "high";
  reasons: string[];
  explanation: string;
}

export interface PlanPreview {
  expectedOutUsd: number;
  minOutUsd: number;
  simulatedPriceImpactBps: number;
  route: string[];
}

export interface StructuredPlan {
  planId: string;
  createdAt: number;
  input: PlanInput;
  steps: PlanStep[];
  constraints: Guardrails;
  risk: RiskReport;
  preview: PlanPreview;
  userApprovalRequired: true;
  compute: {
    used: boolean;
    provider: "heuristic" | "0g-compute";
    rationale: string;
  };
}

function clamp(num: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, num));
}

function estimateImpactBps(amountUsd: number): number {
  if (amountUsd <= 250) return 15;
  if (amountUsd <= 1000) return 35;
  if (amountUsd <= 5000) return 85;
  return 150;
}

function evaluateRisk(input: PlanInput, impactBps: number): RiskReport {
  const reasons: string[] = [];
  if (impactBps > 100) reasons.push("Estimated price impact is elevated for requested size.");
  if (input.guardrails.maxSlippageBps > 150) reasons.push("Max slippage setting is permissive.");
  if (input.amountUsd > input.guardrails.maxNotionalUsd * 0.8) reasons.push("Trade size is near your configured notional limit.");

  const level: RiskReport["level"] =
    reasons.length >= 2 ? "high" : reasons.length === 1 ? "medium" : "low";

  const explanation =
    level === "low"
      ? "Plan is within configured limits and expected impact is small."
      : level === "medium"
      ? "Plan is executable but has one notable risk signal. Review before approval."
      : "Plan crosses multiple risk signals. Consider reducing size or tightening guardrails.";

  return { level, reasons, explanation };
}

export async function maybeComputeRationale(input: PlanInput): Promise<{ used: boolean; provider: "heuristic" | "0g-compute"; rationale: string; }> {
  const computeUrl = process.env.OG_COMPUTE_URL?.trim();
  if (!computeUrl) {
    return {
      used: false,
      provider: "heuristic",
      rationale: `Heuristic plan for ${input.intent.toLowerCase()} with strict user guardrails.`,
    };
  }

  try {
    const model = process.env.OG_COMPUTE_MODEL?.trim() || "qwen-2.5-7b-instruct";
    const authToken = process.env.OG_COMPUTE_API_KEY?.trim();
    const providerAddress = process.env.OG_COMPUTE_PROVIDER_ADDRESS?.trim();
    const fallbackFee = Number(process.env.OG_COMPUTE_FALLBACK_FEE ?? "0.01");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (authToken) headers.Authorization = `Bearer ${authToken}`;

    // We support three request/response styles:
    // 1) 0G starter kit query endpoint:
    //    POST /api/services/query
    //    { providerAddress, query, fallbackFee }
    //    -> { success: true, response: { content: "..." } }
    // 1) Custom endpoint: { rationale: "..." }
    // 2) OpenAI-compatible chat completions:
    //    { choices: [{ message: { content: "..." } }] }
    const isStarterKitQuery = computeUrl.includes("/api/services/query") && !!providerAddress;
    const starterKitQuery = JSON.stringify({
      providerAddress,
      query: [
        `Intent: ${input.intent}`,
        `Pair: ${input.tokenIn} -> ${input.tokenOut}`,
        `Amount: ${input.amountUsd} USD`,
        `Constraints: ${JSON.stringify(input.guardrails)}`,
        `Return concise risk-aware rationale only.`,
      ].join("\n"),
      fallbackFee,
    });

    const defaultQuery = JSON.stringify({
      model,
      task: "defi-planning-rationale",
      messages: [
        {
          role: "system",
          content: "You are a DeFi risk planner. Return concise rationale aligned to guardrails.",
        },
        {
          role: "user",
          content: JSON.stringify({
            intent: input.intent,
            tokenIn: input.tokenIn,
            tokenOut: input.tokenOut,
            amountUsd: input.amountUsd,
            constraints: input.guardrails,
          }),
        },
      ],
      input: {
        intent: input.intent,
        tokenIn: input.tokenIn,
        tokenOut: input.tokenOut,
        amountUsd: input.amountUsd,
        constraints: input.guardrails,
      }
    });

    const res = await fetch(computeUrl, {
      method: "POST",
      headers,
      body: isStarterKitQuery ? starterKitQuery : defaultQuery,
    });

    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json() as {
      success?: boolean;
      response?: { content?: string };
      rationale?: string;
      output_text?: string;
      text?: string;
      choices?: Array<{ message?: { content?: string } }>;
    };
    const rationale = data.response?.content?.trim()
      || data.rationale?.trim()
      || data.output_text?.trim()
      || data.text?.trim()
      || data.choices?.[0]?.message?.content?.trim();
    if (!rationale) throw new Error("missing rationale");

    return {
      used: true,
      provider: "0g-compute",
      rationale,
    };
  } catch {
    return {
      used: false,
      provider: "heuristic",
      rationale: `Fallback heuristic plan for ${input.intent.toLowerCase()} (0G Compute unavailable).`,
    };
  }
}

export async function buildStructuredPlan(input: PlanInput): Promise<StructuredPlan> {
  const planId = `plan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const impactBps = estimateImpactBps(input.amountUsd);
  const slippageCap = clamp(input.guardrails.maxSlippageBps, 5, 500);
  const effectiveSlip = Math.max(impactBps, Math.min(slippageCap, impactBps + 20));
  const expectedOutUsd = Number((input.amountUsd * (1 - impactBps / 10000)).toFixed(2));
  const minOutUsd = Number((input.amountUsd * (1 - effectiveSlip / 10000)).toFixed(2));
  const risk = evaluateRisk(input, impactBps);
  const compute = await maybeComputeRationale(input);

  return {
    planId,
    createdAt: Date.now(),
    input,
    steps: [
      { id: "s1", action: "quote", description: "Fetch route quote and verify token allowlist." },
      { id: "s2", action: "approve", description: `Set token approval cap to exact notional (${input.amountUsd} USD equivalent).` },
      { id: "s3", action: "swap", description: `Swap ${input.tokenIn} -> ${input.tokenOut} with max slippage ${input.guardrails.maxSlippageBps} bps.` },
      { id: "s4", action: "confirm", description: "Require explicit user confirmation before final transaction broadcast." },
    ],
    constraints: input.guardrails,
    risk,
    preview: {
      expectedOutUsd,
      minOutUsd,
      simulatedPriceImpactBps: impactBps,
      route: [input.tokenIn, "USDC", input.tokenOut],
    },
    userApprovalRequired: true,
    compute,
  };
}

export function guardrailViolations(input: PlanInput): string[] {
  const violations: string[] = [];
  if (!input.guardrails.tokenAllowlist.includes(input.tokenIn)) violations.push(`${input.tokenIn} is not in token allowlist.`);
  if (!input.guardrails.tokenAllowlist.includes(input.tokenOut)) violations.push(`${input.tokenOut} is not in token allowlist.`);
  if (input.amountUsd > input.guardrails.maxNotionalUsd) violations.push(`Amount ${input.amountUsd} exceeds max notional ${input.guardrails.maxNotionalUsd}.`);
  return violations;
}
