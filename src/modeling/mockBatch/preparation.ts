import type { InitialRostersByOwner } from "../auctionEngine.js";
import {
  buildAuctionPlayerPool,
  buildInitialRostersFromKeepers,
  buildOwnerAuctionBehaviors,
  buildOwnerDemandMultipliers,
  buildOwnerRosterMaximums,
} from "../auctionEngine.js";
import { buildBasePrices, defaultPricingConfig } from "../basePricing.js";
import {
  applyKeeperScenarioToPrices,
  buildKeeperScenarios,
  type KeeperScenario,
  type KeeperScenarioKey,
} from "../keeperInflation.js";
import { buildOwnerProfiles } from "../ownerProfiles.js";
import { leagueConfig } from "../../../config/league.js";
import { defaultScenarioKeys, replacementDepthBuffer } from "./constants.js";
import type { RunMockBatchOptions } from "./contracts.js";
import type { MockPreparation } from "./internalContracts.js";

const scenarioByKey = (
  scenarioKey: KeeperScenarioKey,
  scenarios: readonly KeeperScenario[],
): KeeperScenario => {
  const scenario = scenarios.find(candidate => candidate.key === scenarioKey);
  if (!scenario) throw new Error(`Unknown keeper scenario "${scenarioKey}".`);
  return scenario;
};

const keeperCountFor = (rosters: InitialRostersByOwner): number =>
  Object.values(rosters).reduce((count, roster) => count + (roster?.length ?? 0), 0);

export const prepareMockInputs = ({
  projections,
  historicalRecords,
  keepers,
  scenarioKeys = defaultScenarioKeys,
  pricingConfig = defaultPricingConfig,
}: Omit<RunMockBatchOptions, "runsPerScenario" | "seedPrefix">): MockPreparation => {
  const prices = buildBasePrices(projections, historicalRecords, pricingConfig);
  const keeperScenarios = buildKeeperScenarios(keepers);
  const ownerProfiles = buildOwnerProfiles(historicalRecords);
  const totalRosterSlots = leagueConfig.teams * leagueConfig.rosterSize;

  return {
    ownerDemandMultipliers: buildOwnerDemandMultipliers(ownerProfiles),
    ownerBehaviors: buildOwnerAuctionBehaviors(ownerProfiles),
    ownerRosterMaximums: buildOwnerRosterMaximums(ownerProfiles),
    scenarios: scenarioKeys.map(scenarioKey => {
      const scenario = scenarioByKey(scenarioKey, keeperScenarios);
      const adjustedPrices = applyKeeperScenarioToPrices(prices, scenario, keepers);
      const initialRostersByOwner = buildInitialRostersFromKeepers(
        keepers,
        projections,
        scenario.includedKeeperStatuses,
      );
      const lockedKeepers = keeperCountFor(initialRostersByOwner);
      const auctionPlayers = buildAuctionPlayerPool({
        pricedPlayers: adjustedPrices.availablePrices,
        projections,
        excludedNames: adjustedPrices.unavailableKeepers.map(keeper => keeper.player),
        targetCount: totalRosterSlots - lockedKeepers + replacementDepthBuffer,
      });

      return {
        scenario,
        initialRostersByOwner,
        auctionPlayers,
        inputCounts: {
          pricedPlayers: adjustedPrices.availablePrices.length,
          auctionPlayers: auctionPlayers.length,
          lockedKeepers,
        },
      };
    }),
  };
};
