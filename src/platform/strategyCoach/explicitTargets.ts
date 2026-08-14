import { resolvePlayer } from "./catalog.js";
import { constraintFor, uniqueConstraints } from "./constraints.js";
import type {
  StrategyCoachGuardrail,
  StrategyCoachPlayerConstraint,
} from "./contracts.js";
import type { CatalogCandidate } from "./internalTypes.js";

export const extractExplicitTargetMentions = (
  promptText: string,
  candidates: readonly CatalogCandidate[],
  guardrails: StrategyCoachGuardrail[],
): StrategyCoachPlayerConstraint[] => {
  const pattern = /\btarget\s+([^,.;\n]+?)(?:\s+(?:max|maximum|up\s+to|under|<=)\s*\$?(\d+))?(?=$|[,.;\n])/gi;
  const constraints: StrategyCoachPlayerConstraint[] = [];

  for (const match of promptText.matchAll(pattern)) {
    const rawMention = match[1];
    if (rawMention === undefined) continue;

    const promptMaxBid = match[2] === undefined ? undefined : Number(match[2]);
    const resolved = resolvePlayer(rawMention, candidates);
    if (resolved.guardrail) {
      guardrails.push(resolved.guardrail);
      continue;
    }
    if (resolved.resolved === undefined) continue;

    constraints.push(constraintFor(resolved.resolved, "target", rawMention, {
      pricePreference: "target",
      ...(promptMaxBid !== undefined && Number.isInteger(promptMaxBid) && promptMaxBid >= 0
        ? { promptMaxBid }
        : {}),
    }));
  }

  return uniqueConstraints(constraints);
};
