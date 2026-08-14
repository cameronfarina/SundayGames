import { keepers } from "../../../config/keepers.js";
import { runMock } from "../../modeling/mockBatch.js";
import type { CliArguments } from "../arguments.js";
import { loadPricingInputs } from "../inputs.js";
import { scenarioOption } from "../options/commonOptions.js";

export const runMockCommand = async (arguments_: CliArguments): Promise<void> => {
  const { pricingConfig, players, historicalRecords } = await loadPricingInputs(arguments_);
  const result = runMock({
    projections: players,
    historicalRecords,
    keepers,
    scenarioKey: scenarioOption(arguments_),
    seed: arguments_.option("--seed") ?? "mockd-default",
    pricingConfig,
  });
  console.log(JSON.stringify({
    seed: result.seed,
    keeperScenario: {
      key: result.keeperScenario.key,
      label: result.keeperScenario.label,
      totalKeeperCost: result.keeperScenario.totalKeeperCost,
      openAuctionDollars: result.keeperScenario.openAuctionDollars,
      globalFactor: result.keeperScenario.globalFactor,
      positionFactors: result.keeperScenario.positionFactors,
    },
    economics: {
      marketAnchor: "Base or scenario-adjusted player price remains the market input.",
      salePrice: "Auction result price is resolved from owner-local max bids, need, historical owner demand, and scarcity pressure.",
      budgetRule: "$1 is held back for every unfilled roster slot; overspent owners are capped individually.",
      scarcityRule: "Comparable-player scarcity can push good players above anchor while full-budget owners are still bidding.",
    },
    inputCounts: {
      pricedPlayers: result.inputCounts.pricedPlayers,
      auctionPlayers: result.inputCounts.auctionPlayers,
      lockedKeepers: result.inputCounts.lockedKeepers,
    },
    pickCount: result.pickCount,
    firstPicks: result.picks.slice(0, 30),
    draftBoard: result.picks,
    budgetTrajectory: result.budgetTrajectory,
    rosters: result.rosters.map(roster => ({
      owner: roster.owner,
      spend: roster.spend,
      budgetRemaining: roster.budgetRemaining,
      week1Score: roster.week1Score,
      weeks1To4Score: roster.weeks1To4Score,
      valid: roster.valid,
      errors: roster.errors,
      players: roster.players.map(player => ({
        name: player.name,
        position: player.position,
        price: player.price,
        weeks1To4: player.weeks1To4,
      })),
    })),
    unsoldPlayerCount: result.unsoldPlayerCount,
  }, null, 2));
};
