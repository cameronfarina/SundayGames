import type { KeeperDeclaration } from "../../../config/keepers.js";
import { leagueConfig, primaryOwner, type Position } from "../../../config/league.js";
import { normalizePlayerName } from "../../data/normalizePlayerName.js";
import type { ProjectionRecord } from "../../projections.js";
import { buildKeeperScenarios, type KeeperScenarioKey } from "../keeperInflation.js";
import type { ForcedAuctionSale } from "../mockBatch.js";
import type {
  StrategyLabForcedStart,
  StrategyLabForcedStartPlayer,
} from "./scenarioContracts.js";

const minimumBid = 1;

const projectionPositionFor = (
  projections: readonly ProjectionRecord[],
  playerName: string,
): Position => {
  const normalizedName = normalizePlayerName(playerName);
  const projection = projections.find(
    candidate => normalizePlayerName(candidate.name) === normalizedName,
  );
  if (!projection) {
    throw new Error(`Unable to find projection for strategy-lab player "${playerName}".`);
  }
  return projection.position;
};

const keeperPlayerFor = (keeper: KeeperDeclaration): StrategyLabForcedStartPlayer => ({
  player: keeper.player,
  position: keeper.position,
  price: keeper.newCost,
  source: "keeper",
});

const forcedPlayerFor = (
  sale: ForcedAuctionSale,
  projections: readonly ProjectionRecord[],
): StrategyLabForcedStartPlayer => ({
  player: sale.player,
  position: projectionPositionFor(projections, sale.player),
  price: sale.price,
  source: "forced-sale",
});

export const forcedStartFor = ({
  keepers,
  projections,
  scenarioKey,
  forcedSales,
}: {
  keepers: readonly KeeperDeclaration[];
  projections: readonly ProjectionRecord[];
  scenarioKey: KeeperScenarioKey;
  forcedSales: readonly ForcedAuctionSale[];
}): StrategyLabForcedStart => {
  const keeperScenario = buildKeeperScenarios(keepers).find(
    candidate => candidate.key === scenarioKey,
  );
  if (!keeperScenario) throw new Error(`Unknown keeper scenario "${scenarioKey}".`);

  const keeperPlayers = keepers
    .filter(keeper =>
      keeper.owner === primaryOwner
      && keeperScenario.includedKeeperStatuses.includes(keeper.status),
    )
    .map(keeperPlayerFor);
  const forcedPlayers = forcedSales.map(sale => forcedPlayerFor(sale, projections));
  const players = [...keeperPlayers, ...forcedPlayers];
  const spend = players.reduce((total, player) => total + player.price, 0);
  const slotsRemaining = Math.max(0, leagueConfig.rosterSize - players.length);
  const budgetRemaining = leagueConfig.auctionBudget - spend;
  const maxBid = slotsRemaining === 0
    ? 0
    : Math.max(0, budgetRemaining - Math.max(0, slotsRemaining - 1) * minimumBid);

  return { spend, budgetRemaining, slotsRemaining, maxBid, players };
};
