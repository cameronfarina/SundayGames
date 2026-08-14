import type {
  BuildStrategyCoachPlanInput,
  StrategyCoachPlan,
} from "./contracts.js";
import { extractConstraints } from "./extractConstraints.js";
import { dedupeGuardrails } from "./guardrails.js";
import { stableId } from "./identity.js";
import { buildVariants } from "./variants.js";

const now = (): Date => new Date();

export const buildStrategyCoachPlan = (
  input: BuildStrategyCoachPlanInput,
): StrategyCoachPlan => {
  const createdAt = input.createdAt ?? now();
  const extracted = extractConstraints(input.promptText, input.playerCatalog);
  const planSeed = {
    userId: input.userId,
    leagueId: input.leagueId,
    seasonId: input.seasonId,
    privateOwnerUserId: input.privateOwnerUserId,
    owner: input.owner,
    promptText: input.promptText,
    createdAt: createdAt.toISOString(),
  };
  const builtVariants = buildVariants({
    hardLocks: extracted.constraints.hardLocks,
    rb2Alternatives: extracted.constraints.rb2Alternatives,
    wrCandidates: extracted.constraints.wrCandidates,
    ...(extracted.constraints.desiredWrCount === undefined
      ? {}
      : { desiredWrCount: extracted.constraints.desiredWrCount }),
    ...(extracted.constraints.globalMaxPrice === undefined
      ? {}
      : { globalMaxPrice: extracted.constraints.globalMaxPrice }),
    planSeed,
  });

  return {
    id: stableId("strategy_plan", planSeed),
    userId: input.userId,
    leagueId: input.leagueId,
    seasonId: input.seasonId,
    privateOwnerUserId: input.privateOwnerUserId,
    owner: input.owner,
    promptText: input.promptText,
    extractedConstraints: extracted.constraints,
    variants: builtVariants.variants,
    guardrails: dedupeGuardrails([...extracted.guardrails, ...builtVariants.guardrails]),
    createdAt,
    ...(input.conversationId === undefined ? {} : { conversationId: input.conversationId }),
  };
};
