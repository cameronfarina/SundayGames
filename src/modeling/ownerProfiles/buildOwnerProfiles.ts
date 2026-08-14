import { ownerOrder, positions } from "../../../config/league.js";
import type { HistoricalAuctionRecord } from "../../data/parseHistoricalBoards.js";
import { defaultHistoricalWeights, profilePositions } from "./constants.js";
import type { HistoricalWeights, OwnerProfile, OwnerProfileData } from "./contracts.js";
import { describeProfile } from "./describeProfile.js";
import { emptyProfileSpend, emptyRosterCounts } from "./profileState.js";
import {
  auctionRecords,
  keeperCost,
  normalSpecialTeamsSpend,
  oneDollarPlayerCount,
  rosterCountForPosition,
  spendForPosition,
  topTwoConcentration,
} from "./recordMetrics.js";
import { roundToOneDecimal, weightedSum } from "./weighting.js";

export const buildOwnerProfiles = (
  records: readonly HistoricalAuctionRecord[],
  weights: HistoricalWeights = defaultHistoricalWeights,
): OwnerProfile[] => ownerOrder.map(owner => {
  const ownerRecords = records.filter(record => record.owner === owner);
  const openAuctionSpend = emptyProfileSpend();
  const rosterCounts = emptyRosterCounts();

  for (const position of profilePositions) {
    openAuctionSpend[position] = roundToOneDecimal(
      weightedSum(ownerRecords, weights, seasonRecords =>
        spendForPosition(auctionRecords(seasonRecords), position)),
    );
  }
  for (const position of positions) {
    rosterCounts[position] = roundToOneDecimal(
      weightedSum(ownerRecords, weights, seasonRecords =>
        rosterCountForPosition(seasonRecords, position)),
    );
  }

  const profile: OwnerProfileData = {
    owner,
    openAuctionSpend,
    rosterCounts,
    normalSpecialTeamsSpend: roundToOneDecimal(
      weightedSum(ownerRecords, weights, normalSpecialTeamsSpend),
    ),
    topTwoConcentration: roundToOneDecimal(
      weightedSum(ownerRecords, weights, topTwoConcentration),
    ),
    oneDollarPlayerCount: roundToOneDecimal(
      weightedSum(ownerRecords, weights, oneDollarPlayerCount),
    ),
    averageKeeperCost: roundToOneDecimal(
      weightedSum(ownerRecords, weights, keeperCost),
    ),
  };
  return { ...profile, profileLabel: describeProfile(profile) };
});
