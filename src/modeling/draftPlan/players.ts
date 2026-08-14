import type { Position } from "../../../config/league.js";
import type { Player } from "../../types.js";
import type { PlayerBatchSummary } from "../mockBatch.js";
import type {
  DraftPlanCandidate,
  DraftPlanPlayer,
  DraftPlanPlayerMarket,
} from "./contracts.js";

export const sortPlayers = (players: readonly Player[]): Player[] =>
  [...players].sort(
    (left, right) =>
      right.price - left.price ||
      right.weeks1To4 - left.weeks1To4 ||
      left.name.localeCompare(right.name),
  );

export const playerMarketByName = (
  players: readonly PlayerBatchSummary[],
): ReadonlyMap<string, DraftPlanPlayerMarket> =>
  new Map(players.map(player => [
    player.name,
    {
      averageMarketPrice: player.averageMarketPrice,
      averageSalePrice: player.averageSalePrice,
      minimumSalePrice: player.minimumSalePrice,
      maximumSalePrice: player.maximumSalePrice,
      draftedRate: player.draftedRate,
    },
  ]));

export const draftPlanPlayerFor = (
  player: Player,
  marketByName: ReadonlyMap<string, DraftPlanPlayerMarket>,
): DraftPlanPlayer => {
  const market = marketByName.get(player.name);
  return {
    name: player.name,
    position: player.position,
    price: player.price,
    weeks1To4: player.weeks1To4,
    ...(market ? { market } : {}),
  };
};

export const playerAtPosition = (
  candidate: DraftPlanCandidate,
  position: Position,
  index: number,
): DraftPlanPlayer | undefined =>
  candidate.players.filter(player => player.position === position)[index];
