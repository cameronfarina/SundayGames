import { ownerOrder } from "../../../config/league.js";
import {
  simulateAuction,
  type AuctionDiagnosticsMode,
  type AuctionEngineConfigOverrides,
  type OwnerAuctionBehaviors,
  type OwnerDemandMultipliers,
  type OwnerRosterMaximums,
} from "../auctionEngine.js";
import { buildMockAuctionConfig } from "./auctionConfiguration.js";
import type { ForcedAuctionSale, MockRun } from "./contracts.js";
import { applyForcedSales } from "./forcedSales.js";
import type { PreparedScenario } from "./internalContracts.js";
import { summarizeRoster } from "./rosterSummary.js";

interface RunPreparedScenarioOptions {
  preparedScenario: PreparedScenario;
  ownerDemandMultipliers: OwnerDemandMultipliers;
  ownerBehaviors: OwnerAuctionBehaviors;
  ownerRosterMaximums: OwnerRosterMaximums;
  seed: string;
  auctionConfigOverrides?: AuctionEngineConfigOverrides;
  forcedSales?: readonly ForcedAuctionSale[];
  diagnosticsMode?: AuctionDiagnosticsMode;
}

export const runPreparedScenario = ({
  preparedScenario,
  ownerDemandMultipliers,
  ownerBehaviors,
  ownerRosterMaximums,
  seed,
  auctionConfigOverrides = {},
  forcedSales = [],
  diagnosticsMode = "full",
}: RunPreparedScenarioOptions): MockRun => {
  const auctionConfig = buildMockAuctionConfig({
    ownerDemandMultipliers,
    ownerBehaviors,
    ownerRosterMaximums,
    seed,
    overrides: auctionConfigOverrides,
  });
  const preparedRun = applyForcedSales(
    preparedScenario,
    forcedSales,
    auctionConfig.minimumBid,
  );
  const result = simulateAuction({
    players: preparedRun.auctionPlayers,
    config: auctionConfig,
    initialRostersByOwner: preparedRun.initialRostersByOwner,
    diagnosticsMode,
  });
  const rosters = ownerOrder.map(owner => {
    const roster = result.rosters[owner];
    if (!roster) throw new Error(`Missing roster for ${owner}.`);
    return summarizeRoster(owner, roster);
  });

  return {
    seed,
    keeperScenario: preparedRun.scenario,
    inputCounts: preparedRun.inputCounts,
    pickCount: result.picks.length,
    picks: result.picks,
    budgetTrajectory: result.budgetTrajectory,
    rosters,
    invalidRosterCount: rosters.filter(roster => !roster.valid).length,
    unsoldPlayerCount: result.unsoldPlayers.length,
  };
};
