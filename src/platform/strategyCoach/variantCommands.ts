import type {
  StrategyCoachGuardrail,
  StrategyCoachPlayerConstraint,
} from "./contracts.js";
import {
  globalCapConflictGuardrailFor,
  missingPriceGuardrailFor,
  priceCappedGuardrailFor,
} from "./guardrails.js";

export const commandForDraft = (
  constraint: StrategyCoachPlayerConstraint,
  globalMaxPrice: number | undefined,
  guardrails: StrategyCoachGuardrail[],
): string => {
  if (constraint.price === undefined) {
    guardrails.push(missingPriceGuardrailFor(constraint));
    return `draft ${constraint.playerName}`;
  }

  if (globalMaxPrice !== undefined && constraint.price > globalMaxPrice) {
    guardrails.push(globalCapConflictGuardrailFor(constraint, globalMaxPrice));
  }

  return `draft ${constraint.playerName} for $${constraint.price}`;
};

export const commandForTarget = (
  constraint: StrategyCoachPlayerConstraint,
  globalMaxPrice: number | undefined,
  guardrails: StrategyCoachGuardrail[],
): string => {
  if (constraint.maxBid === undefined) {
    guardrails.push(missingPriceGuardrailFor(constraint));
    return `target ${constraint.playerName}`;
  }

  const maxBid = globalMaxPrice === undefined
    ? constraint.maxBid
    : Math.min(constraint.maxBid, globalMaxPrice);
  if (globalMaxPrice !== undefined && constraint.maxBid > globalMaxPrice) {
    guardrails.push(priceCappedGuardrailFor(constraint, globalMaxPrice));
  }

  return `target ${constraint.playerName} max $${maxBid}`;
};
