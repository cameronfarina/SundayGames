import type {
  StrategyCoachConstraintIntent,
  StrategyCoachPlayerConstraint,
} from "./contracts.js";
import type { PricePreference, PriceValue, ResolvedPlayer } from "./internalTypes.js";
import { priceValueFor } from "./prices.js";
import { cleanMention } from "./text.js";

interface ConstraintOptions {
  pricePreference: PricePreference;
  slot?: string;
  promptMaxBid?: number;
}

export const constraintFor = (
  resolved: ResolvedPlayer,
  intent: StrategyCoachConstraintIntent,
  rawMention: string,
  options: ConstraintOptions,
): StrategyCoachPlayerConstraint => {
  const promptedPrice: PriceValue | undefined = options.promptMaxBid === undefined
    ? undefined
    : { value: options.promptMaxBid, source: "prompt" };
  const price = promptedPrice ?? priceValueFor(resolved.entry, options.pricePreference);

  return {
    intent,
    rawMention: cleanMention(rawMention),
    playerName: resolved.entry.name,
    normalizedName: resolved.normalizedName,
    position: resolved.entry.position,
    ...(resolved.entry.playerId === undefined ? {} : { playerId: resolved.entry.playerId }),
    ...(options.slot === undefined ? {} : { slot: options.slot.toUpperCase() }),
    ...(intent === "draft" && price !== undefined ? { price: price.value } : {}),
    ...(intent === "target" && price !== undefined ? { maxBid: price.value } : {}),
    ...(price === undefined ? {} : { priceSource: price.source }),
  };
};

export const uniqueConstraints = (
  constraints: readonly StrategyCoachPlayerConstraint[],
): StrategyCoachPlayerConstraint[] => {
  const seen = new Set<string>();
  const uniqueValues: StrategyCoachPlayerConstraint[] = [];

  for (const constraint of constraints) {
    const key = `${constraint.intent}:${constraint.slot ?? ""}:${constraint.normalizedName}`;
    if (seen.has(key)) continue;

    seen.add(key);
    uniqueValues.push(constraint);
  }

  return uniqueValues;
};
