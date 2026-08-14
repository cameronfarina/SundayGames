import { positions } from "../../../config/league.js";
import { playerOverrides } from "../../../config/playerOverrides.js";
import { normalizePlayerName } from "../../data/normalizePlayerName.js";
import type { HistoricalAuctionRecord } from "../../data/parseHistoricalBoards.js";
import type { ProjectionRecord } from "../../projections.js";
import { buildProjectionRankings } from "../projectionRankings.js";
import { allocateIntegerPrices } from "./allocation.js";
import { candidateForRanking } from "./candidates.js";
import { defaultPricingConfig } from "./config.js";
import type { BasePrice, PricingConfig } from "./contracts.js";
import { buildHistoricalAuctionRecordsByName } from "./historicalPrior.js";
import { deriveAuditedSpendTargets } from "./spendTargets.js";
import { applyTopPriceVolumeCaps } from "./volumeCaps.js";

export const buildBasePrices = (
  projections: readonly ProjectionRecord[],
  historicalRecords: readonly HistoricalAuctionRecord[],
  config: PricingConfig = defaultPricingConfig,
): BasePrice[] => {
  const spendTargets = deriveAuditedSpendTargets(historicalRecords, config);
  const overrideByName = new Map(
    playerOverrides.map(override => [normalizePlayerName(override.player), override]),
  );
  const historicalByName = buildHistoricalAuctionRecordsByName(
    historicalRecords,
    config,
  );
  const rankings = buildProjectionRankings(projections);
  const candidates = positions.flatMap(position => {
    const poolCount = config.draftedPoolCounts[position];
    const positionRankings = rankings
      .filter(ranking => ranking.position === position)
      .slice(0, poolCount);
    if (positionRankings.length < poolCount) {
      throw new Error(
        `Only found ${positionRankings.length} ${position} projections for ${poolCount} price slots.`,
      );
    }
    return positionRankings.map(ranking => candidateForRanking(
      ranking,
      spendTargets[position],
      overrideByName,
      historicalByName,
      config,
    ));
  });
  const cappedCandidates = applyTopPriceVolumeCaps(candidates, config);
  return positions.flatMap(position => allocateIntegerPrices(
    cappedCandidates.filter(candidate => candidate.position === position),
    spendTargets[position],
  )).sort((left, right) =>
    right.price - left.price ||
    right.weeks1To4 - left.weeks1To4 ||
    left.name.localeCompare(right.name));
};
