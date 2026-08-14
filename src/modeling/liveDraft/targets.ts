import { leagueConfig } from "../../../config/league.js";
import type { PricingConfig } from "../basePricing.js";
import {
  type LiveDraftStrategyDefinition,
} from "../liveDraftStrategies.js";
import type { LiveDraftOwnerState, LiveDraftRoomState, LiveDraftTarget } from "./contracts.js";
import type { LiveDraftPlayerRecord } from "./internalTypes.js";
import { draftPriorityScoreFor, roundPrice, roundToTwo } from "./numbers.js";
import {
  canWatchOwnerRosterPlayer,
  strategyPathMaxBidFor,
  targetNeedMultiplierFor,
} from "./strategyValuation.js";
import { strategyValuesFor } from "./strategyValues.js";

const targetTagsFor = (
  player: LiveDraftPlayerRecord,
  watchOwner: LiveDraftOwnerState,
  strategy: LiveDraftStrategyDefinition,
): string[] => {
  const tags: string[] = [];
  const counts = watchOwner.positionCounts;
  if (watchOwner.rosterSlotsRemaining <= 0) tags.push("roster full");
  if (counts[player.position] >= leagueConfig.rosterMaximums[player.position]) tags.push("roster max");
  if (counts[player.position] < leagueConfig.lineup[player.position]) tags.push("starter need");
  const anchorTarget = strategy.anchorTargets?.[player.position] ?? 0;
  const strategyTag = strategy.tags[player.position];
  if (strategyTag && anchorTarget > 0 && counts[player.position] < anchorTarget) tags.push(strategyTag);
  if ((player.position === "WR" || player.position === "TE") && counts.RB + counts.WR + counts.TE < 5) {
    tags.push("flex need");
  }
  if (player.source === "projectionFallback") tags.push("projection fallback");
  if (player.expectedPrice > watchOwner.maxBid) tags.push("not affordable");
  return tags;
};

const liveExpectedPriceFor = (
  player: LiveDraftPlayerRecord,
  room: LiveDraftRoomState,
): number => room.remainingRosterSlots <= 0
  ? 0
  : roundPrice(player.expectedPrice * room.liveInflationFactor);

const targetFor = ({
  player, watchOwner, room, strategy, pricingConfig,
}: {
  player: LiveDraftPlayerRecord;
  watchOwner: LiveDraftOwnerState;
  room: LiveDraftRoomState;
  strategy: LiveDraftStrategyDefinition;
  pricingConfig: PricingConfig;
}): LiveDraftTarget => {
  const fitsRoster = canWatchOwnerRosterPlayer(player, watchOwner);
  const liveExpectedPrice = liveExpectedPriceFor(player, room);
  const strategyValues = strategyValuesFor(
    player, watchOwner, liveExpectedPrice, pricingConfig, fitsRoster,
  );
  const personalValue = strategyValues[strategy.key];
  const pathMax = strategyPathMaxBidFor(player, watchOwner, strategy);
  const recommendedMaxBid = fitsRoster ? Math.min(personalValue, pathMax ?? personalValue) : 0;
  const tags = targetTagsFor(player, watchOwner, strategy);
  if (pathMax !== undefined && pathMax < personalValue) tags.push(`path max $${pathMax}`);
  return {
    name: player.name,
    position: player.position,
    ...(player.teamAbbreviation === undefined ? {} : { teamAbbreviation: player.teamAbbreviation }),
    ...(player.byeWeek === undefined ? {} : { byeWeek: player.byeWeek }),
    expectedPrice: player.expectedPrice,
    liveExpectedPrice,
    personalValue,
    strategyValues,
    recommendedMaxBid,
    valueScore: draftPriorityScoreFor({
      player,
      needMultiplier: targetNeedMultiplierFor(player, watchOwner, strategy),
      liveExpectedPrice,
    }),
    week1Projection: roundToTwo(player.week1),
    weeks1To4: roundToTwo(player.weeks1To4),
    seasonProjection: roundToTwo(player.seasonProjection),
    ...(player.projectionRank === undefined ? {} : { projectionRank: player.projectionRank }),
    ...(player.espnRank === undefined ? {} : { espnRank: player.espnRank }),
    ...(player.draftRoomRank === undefined ? {} : { draftRoomRank: player.draftRoomRank }),
    source: player.source,
    tags,
  };
};

export const buildTargets = ({
  records, soldNames, watchOwner, room, targetLimit, strategy, pricingConfig,
}: {
  records: readonly LiveDraftPlayerRecord[];
  soldNames: ReadonlySet<string>;
  watchOwner: LiveDraftOwnerState;
  room: LiveDraftRoomState;
  targetLimit: number;
  strategy: LiveDraftStrategyDefinition;
  pricingConfig: PricingConfig;
}): LiveDraftTarget[] => records
  .filter(player => !soldNames.has(player.normalizedName))
  .map(player => targetFor({ player, watchOwner, room, strategy, pricingConfig }))
  .sort((left, right) =>
    Number(!right.tags.includes("not affordable")) - Number(!left.tags.includes("not affordable"))
    || right.liveExpectedPrice - left.liveExpectedPrice
    || right.seasonProjection - left.seasonProjection
    || right.expectedPrice - left.expectedPrice
    || left.name.localeCompare(right.name))
  .slice(0, targetLimit);
