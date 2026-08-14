import type {
  StrategyCoachGuardrail,
  StrategyCoachPlayerConstraint,
} from "./contracts.js";

export const missingPriceGuardrailFor = (
  constraint: StrategyCoachPlayerConstraint,
): StrategyCoachGuardrail => ({
  code: "missing_price",
  severity: "block",
  message: `No catalog price or cap was supplied for ${constraint.playerName}.`,
  rawMention: constraint.rawMention,
  playerName: constraint.playerName,
});

export const globalCapConflictGuardrailFor = (
  constraint: StrategyCoachPlayerConstraint,
  globalMaxPrice: number,
): StrategyCoachGuardrail => ({
  code: "global_cap_conflict",
  severity: "block",
  message: `${constraint.playerName} is priced at $${constraint.price ?? constraint.maxBid}, above the $${globalMaxPrice} cap.`,
  rawMention: constraint.rawMention,
  playerName: constraint.playerName,
});

export const priceCappedGuardrailFor = (
  constraint: StrategyCoachPlayerConstraint,
  globalMaxPrice: number,
): StrategyCoachGuardrail => ({
  code: "price_capped",
  severity: "warn",
  message: `${constraint.playerName} is above the $${globalMaxPrice} cap, so the runnable command caps the target at $${globalMaxPrice}.`,
  rawMention: constraint.rawMention,
  playerName: constraint.playerName,
});

export const dedupeGuardrails = (
  guardrails: readonly StrategyCoachGuardrail[],
): StrategyCoachGuardrail[] => {
  const seen = new Set<string>();
  const deduped: StrategyCoachGuardrail[] = [];

  for (const guardrail of guardrails) {
    const key = `${guardrail.code}:${guardrail.severity}:${guardrail.playerName ?? ""}:${guardrail.rawMention ?? ""}`;
    if (seen.has(key)) continue;

    seen.add(key);
    deduped.push(guardrail);
  }

  return deduped;
};
