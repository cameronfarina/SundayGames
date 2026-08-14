import type { Position } from "../../../config/league.js";
import { normalizePlayerName } from "../../data/normalizePlayerName.js";
import type { Player } from "../../types.js";
import { buildProjectionRankings } from "../projectionRankings.js";
import { defaultReplacementPrice, defaultReplacementPriceLadder } from "./constants.js";
import { isPremiumPosition } from "./coreMath.js";
import { projectionWeekOne } from "./keeperRosters.js";
import { compareAuctionPlayers } from "./nominationTypes.js";
import { AuctionPricedPlayer, BuildAuctionPlayerPoolOptions, ReplacementPriceTier } from "./poolContracts.js";

export const playerFromPricedRecord = (record: AuctionPricedPlayer): Player => {
  const id = record.id === undefined ? {} : { id: record.id };
  const contextAdjustment = record.contextAdjustmentPercent === undefined
    ? {}
    : { contextAdjustmentPercent: record.contextAdjustmentPercent };
  const contextEvidenceCount = record.contextEvidenceCount ?? record.contextEvidence?.length;
  return {
    ...id,
    name: record.name,
    position: record.position,
    ...(record.proTeamId === undefined ? {} : { proTeamId: record.proTeamId }),
    price: record.scenarioPrice ?? record.price,
    week1: record.week1 ?? record.weeks?.[1] ?? 0,
    weeks1To4: record.weeks1To4,
    ...(record.seasonProjection === undefined ? {} : { seasonProjection: record.seasonProjection }),
    ...contextAdjustment,
    ...(contextEvidenceCount === undefined ? {} : { contextEvidenceCount }),
  };
};

export const replacementPriceFor = (
  replacementIndex: number,
  position: Position,
  ladder: readonly ReplacementPriceTier[],
  fallbackPrice: number,
): number => {
  if (!isPremiumPosition(position)) return fallbackPrice;

  let pricedCount = 0;

  for (const tier of ladder) {
    if (tier.count <= 0) continue;
    if (replacementIndex < pricedCount + tier.count) return tier.price;
    pricedCount += tier.count;
  }

  return fallbackPrice;
};

export const buildAuctionPlayerPool = ({
  pricedPlayers,
  projections,
  excludedNames = [],
  targetCount,
  replacementPrice = defaultReplacementPrice,
  replacementPriceLadder = defaultReplacementPriceLadder,
}: BuildAuctionPlayerPoolOptions): Player[] => {
  const players = pricedPlayers.map(playerFromPricedRecord);
  const usedNames = new Set([
    ...players.map(player => normalizePlayerName(player.name)),
    ...excludedNames.map(normalizePlayerName),
  ]);
  const requestedCount = targetCount ?? players.length;

  if (players.length < requestedCount) {
    const replacements = buildProjectionRankings(projections)
      .sort(
        (left, right) =>
          (right.seasonProjection ?? right.weeks1To4 * 4) - (left.seasonProjection ?? left.weeks1To4 * 4) ||
          right.weeks1To4 - left.weeks1To4 ||
          left.name.localeCompare(right.name),
      );
    let premiumReplacementIndex = 0;

    for (const replacement of replacements) {
      if (players.length >= requestedCount) break;
      if (usedNames.has(replacement.normalizedName)) continue;

      const price = replacementPriceFor(
        premiumReplacementIndex,
        replacement.position,
        replacementPriceLadder,
        replacementPrice,
      );
      players.push({
        id: replacement.id,
        name: replacement.name,
        position: replacement.position,
        ...(replacement.proTeamId === undefined ? {} : { proTeamId: replacement.proTeamId }),
        price,
        week1: projectionWeekOne(replacement),
        weeks1To4: replacement.weeks1To4,
        ...(replacement.seasonProjection === undefined ? {} : { seasonProjection: replacement.seasonProjection }),
      });
      usedNames.add(replacement.normalizedName);
      if (isPremiumPosition(replacement.position)) premiumReplacementIndex += 1;
    }
  }

  return players.sort(compareAuctionPlayers);
};
