import { resolvePlayer } from "./catalog.js";
import { constraintFor, uniqueConstraints } from "./constraints.js";
import type {
  StrategyCoachGuardrail,
  StrategyCoachPlayerConstraint,
} from "./contracts.js";
import type { CatalogCandidate } from "./internalTypes.js";

export const extractHardLocks = (
  promptText: string,
  candidates: readonly CatalogCandidate[],
  guardrails: StrategyCoachGuardrail[],
): StrategyCoachPlayerConstraint[] => {
  const hardLocks: StrategyCoachPlayerConstraint[] = [];
  const pattern = /\bdraft\s+([^,.;\n]+?)\s+as\s+((?:RB|WR)\d|QB|TE|FLEX|K|DST)\b/gi;

  for (const match of promptText.matchAll(pattern)) {
    const rawMention = match[1];
    const slot = match[2];
    if (rawMention === undefined || slot === undefined) continue;

    const resolved = resolvePlayer(rawMention, candidates);
    if (resolved.guardrail) {
      guardrails.push(resolved.guardrail);
      continue;
    }
    if (resolved.resolved === undefined) continue;

    hardLocks.push(constraintFor(resolved.resolved, "draft", rawMention, {
      pricePreference: "draft",
      slot,
    }));
  }

  return uniqueConstraints(hardLocks);
};
