import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { buildStructuredPlan, guardrailViolations, maybeComputeRationale, type PlanInput } from "../lib/defai.js";

function baseInput(overrides: Partial<PlanInput> = {}): PlanInput {
  return {
    intent: "Rebalance 500 USD from ETH to USDC",
    tokenIn: "ETH",
    tokenOut: "USDC",
    amountUsd: 500,
    guardrails: {
      maxSlippageBps: 75,
      timeoutSec: 90,
      tokenAllowlist: ["ETH", "USDC", "DAI", "WBTC"],
      maxNotionalUsd: 1000,
    },
    ...overrides,
  };
}

describe("defai", () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.OG_COMPUTE_URL;
    delete process.env.OG_COMPUTE_API_KEY;
    delete process.env.OG_COMPUTE_PROVIDER_ADDRESS;
    delete process.env.OG_COMPUTE_FALLBACK_FEE;
    globalThis.fetch = originalFetch;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
  });

  it("returns no guardrail violations for valid input", () => {
    const violations = guardrailViolations(baseInput());
    assert.equal(violations.length, 0);
  });

  it("returns violations for allowlist and notional cap breaks", () => {
    const violations = guardrailViolations(baseInput({
      tokenIn: "SOL",
      tokenOut: "ARB",
      amountUsd: 1500,
    }));
    assert.equal(violations.length, 3);
    assert.ok(violations.some(v => v.includes("SOL is not in token allowlist.")));
    assert.ok(violations.some(v => v.includes("ARB is not in token allowlist.")));
    assert.ok(violations.some(v => v.includes("exceeds max notional")));
  });

  it("builds deterministic preview values for standard plan inputs", async () => {
    const plan = await buildStructuredPlan(baseInput({ amountUsd: 1000 }));
    assert.equal(plan.steps.length, 4);
    assert.equal(plan.userApprovalRequired, true);
    assert.equal(plan.preview.simulatedPriceImpactBps, 35);
    assert.equal(plan.preview.expectedOutUsd, 996.5);
    assert.equal(plan.preview.minOutUsd, 994.5);
    assert.deepEqual(plan.preview.route, ["ETH", "USDC", "USDC"]);
    assert.match(plan.planId, /^plan_[a-z0-9]+_[a-z0-9]{6}$/);
  });

  it("sets high risk when multiple risk signals are present", async () => {
    const plan = await buildStructuredPlan(baseInput({
      amountUsd: 9000,
      guardrails: {
        maxSlippageBps: 250,
        timeoutSec: 90,
        tokenAllowlist: ["ETH", "USDC", "DAI", "WBTC"],
        maxNotionalUsd: 10000,
      },
    }));

    assert.equal(plan.risk.level, "high");
    assert.ok(plan.risk.reasons.length >= 2);
  });

  it("uses heuristic rationale when compute URL is unset", async () => {
    const result = await maybeComputeRationale(baseInput());
    assert.equal(result.used, false);
    assert.equal(result.provider, "heuristic");
    assert.ok(result.rationale.toLowerCase().includes("heuristic"));
  });

  it("uses 0g-compute rationale when endpoint responds with rationale", async () => {
    process.env.OG_COMPUTE_URL = "https://compute.example/v1";
    globalThis.fetch = (async () => new Response(
      JSON.stringify({ rationale: "Route through deepest pool with strict slippage." }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )) as typeof fetch;

    const result = await maybeComputeRationale(baseInput());
    assert.equal(result.used, true);
    assert.equal(result.provider, "0g-compute");
    assert.equal(result.rationale, "Route through deepest pool with strict slippage.");
  });

  it("falls back to heuristic when compute call fails", async () => {
    process.env.OG_COMPUTE_URL = "https://compute.example/v1";
    globalThis.fetch = (async () => {
      throw new Error("network down");
    }) as typeof fetch;

    const result = await maybeComputeRationale(baseInput());
    assert.equal(result.used, false);
    assert.equal(result.provider, "heuristic");
    assert.ok(result.rationale.toLowerCase().includes("fallback heuristic"));
  });

  it("uses starter-kit query format when /api/services/query endpoint is configured", async () => {
    process.env.OG_COMPUTE_URL = "https://starter.example/api/services/query";
    process.env.OG_COMPUTE_PROVIDER_ADDRESS = "0xprovider";
    process.env.OG_COMPUTE_FALLBACK_FEE = "0.02";

    let capturedBody = "";
    globalThis.fetch = (async (_url, init) => {
      capturedBody = String(init?.body ?? "");
      return new Response(
        JSON.stringify({ response: { content: "starter kit rationale" } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    const result = await maybeComputeRationale(baseInput());
    assert.equal(result.used, true);
    assert.equal(result.provider, "0g-compute");

    const parsed = JSON.parse(capturedBody) as { providerAddress: string; fallbackFee: number; query: string };
    assert.equal(parsed.providerAddress, "0xprovider");
    assert.equal(parsed.fallbackFee, 0.02);
    assert.ok(parsed.query.includes("Intent:"));
  });
});
