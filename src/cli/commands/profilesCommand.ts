import {
  buildOwnerAuctionBehaviors,
  buildOwnerDemandMultipliers,
  buildOwnerRosterMaximums,
} from "../../modeling/auctionEngine.js";
import {
  buildLeagueOpenAuctionSpendTargets,
  buildOwnerProfiles,
  defaultHistoricalWeights,
} from "../../modeling/ownerProfiles.js";
import { loadHistoricalAuctionRecords } from "../../data/parseHistoricalBoards.js";

export const runProfilesCommand = async (): Promise<void> => {
  const historicalRecords = await loadHistoricalAuctionRecords();
  const profiles = buildOwnerProfiles(historicalRecords);
  console.log(JSON.stringify({
    weights: defaultHistoricalWeights,
    profiles,
    ownerDemandMultipliers: buildOwnerDemandMultipliers(profiles),
    ownerAuctionBehaviors: buildOwnerAuctionBehaviors(profiles),
    ownerRosterMaximums: buildOwnerRosterMaximums(profiles),
    openAuctionSpendTargets: buildLeagueOpenAuctionSpendTargets(historicalRecords),
  }, null, 2));
};
