import { leagueConfig, type Position } from "../../../config/league.js";
import type { PricingConfig } from "../basePricing.js";
import { threeRbPathRules } from "../draftPlan.js";
import type { LiveDraftStrategyDefinition } from "../liveDraftStrategies.js";
import type { LiveDraftOwnerState } from "./contracts.js";
import type { LiveDraftPlayerRecord } from "./internalTypes.js";
import { roundPrice } from "./numbers.js";

export const ownerPositionSpend = (
  owner: LiveDraftOwnerState,
  position: Position,
): number => owner.roster
  .filter(player => player.position === position)
  .reduce((total, player) => total + player.price, 0);

export const canWatchOwnerRosterPlayer = (
  player: LiveDraftPlayerRecord,
  watchOwner: LiveDraftOwnerState,
): boolean => watchOwner.rosterSlotsRemaining > 0
  && watchOwner.positionCounts[player.position] < leagueConfig.rosterMaximums[player.position];

const positionNeedMultiplierFor = (
  player: LiveDraftPlayerRecord,
  watchOwner: LiveDraftOwnerState,
  strategy: LiveDraftStrategyDefinition,
): number => {
  const counts = watchOwner.positionCounts;
  let multiplier = 1;
  if (counts[player.position] < leagueConfig.lineup[player.position]) {
    multiplier += strategy.needMultiplier[player.position] ?? 0;
  }
  const anchorTarget = strategy.anchorTargets?.[player.position] ?? 0;
  if (anchorTarget > 0 && counts[player.position] < anchorTarget) {
    multiplier += Math.max(0, (strategy.needMultiplier[player.position] ?? 0) * 0.65);
  }
  if (
    (player.position === "RB" || player.position === "WR" || player.position === "TE")
    && counts.RB + counts.WR + counts.TE < 5
  ) multiplier += Math.max(0, strategy.needMultiplier[player.position] ?? 0) * 0.35;
  if (player.position === "K" || player.position === "DST") {
    multiplier += strategy.needMultiplier[player.position] ?? -0.4;
  }
  return multiplier;
};

const personalPremiumFor = (
  player: LiveDraftPlayerRecord,
  watchOwner: LiveDraftOwnerState,
  strategy: LiveDraftStrategyDefinition,
): number => {
  const counts = watchOwner.positionCounts;
  let premium = counts[player.position] < leagueConfig.lineup[player.position]
    ? strategy.starterPremium[player.position] ?? 0
    : 0;
  const anchorTarget = strategy.anchorTargets?.[player.position] ?? 0;
  if (anchorTarget > 0 && counts[player.position] < anchorTarget) {
    premium += strategy.depthPremium[player.position] ?? 0;
  }
  if (
    (player.position === "RB" || player.position === "WR" || player.position === "TE")
    && counts.RB + counts.WR + counts.TE < 5
  ) premium += Math.max(0, strategy.depthPremium[player.position] ?? 0);
  if (player.position === "K" || player.position === "DST") {
    premium += strategy.starterPremium[player.position] ?? -1;
  }
  return premium;
};

export const personalValueForStrategy = ({
  player,
  watchOwner,
  liveExpectedPrice,
  strategy,
  pricingConfig,
}: {
  player: LiveDraftPlayerRecord;
  watchOwner: LiveDraftOwnerState;
  liveExpectedPrice: number;
  strategy: LiveDraftStrategyDefinition;
  pricingConfig: PricingConfig;
}): number => Math.min(
  watchOwner.maxBid,
  pricingConfig.hardPriceCeilings[player.position],
  player.expectedPrice + 12,
  Math.max(1, roundPrice(liveExpectedPrice + personalPremiumFor(player, watchOwner, strategy))),
);

export const targetNeedMultiplierFor = positionNeedMultiplierFor;

const slotMaxBidsFor = (
  strategy: LiveDraftStrategyDefinition,
  position: Position,
): readonly number[] | undefined => strategy.key === "three-rb"
  ? position === "QB" ? undefined : threeRbPathRules.slotMaxBids[position]
  : undefined;

export const strategyPathMaxBidFor = (
  player: LiveDraftPlayerRecord,
  watchOwner: LiveDraftOwnerState,
  strategy: LiveDraftStrategyDefinition,
): number | undefined => {
  const slotMaxBid = slotMaxBidsFor(strategy, player.position)?.[
    watchOwner.positionCounts[player.position]
  ];
  const coreBudgetMaxBid = strategy.key === "three-rb" && player.position === "RB"
    && watchOwner.positionCounts.RB < threeRbPathRules.rbCoreBudget.targetCount
    ? Math.floor(
      threeRbPathRules.rbCoreBudget.hardBudget
      - ownerPositionSpend(watchOwner, "RB")
      - Math.max(0, threeRbPathRules.rbCoreBudget.targetCount - watchOwner.positionCounts.RB - 1)
        * threeRbPathRules.rbCoreBudget.minimumFutureCorePrice,
    )
    : undefined;
  const maxBids = [slotMaxBid, coreBudgetMaxBid]
    .filter((value): value is number => value !== undefined);
  return maxBids.length
    ? Math.min(watchOwner.maxBid, Math.max(1, Math.min(...maxBids)))
    : undefined;
};
