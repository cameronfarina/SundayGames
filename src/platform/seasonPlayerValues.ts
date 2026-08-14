import { canonicalPlayerIdentityKey } from "../data/normalizePlayerName.js";
import {
  projectionAdjustedAuctionValue,
  projectionScoringMatches,
  strategyAdjustedAuctionValue,
  type LiveDraftStrategyKey,
} from "../modeling/liveDraftStrategies.js";
import type { ExplicitLeagueSeason } from "./leagueSeason.js";
import type {
  LiveDraftRoomInitialRosterPlayer,
  LiveDraftRoomPlayerCatalogEntry,
} from "./liveDraftRooms.js";

export interface BuildSeasonPlayerValuesInput {
  season: ExplicitLeagueSeason;
  playerCatalog: readonly LiveDraftRoomPlayerCatalogEntry[];
  initialRosters: readonly LiveDraftRoomInitialRosterPlayer[];
  humanTeamId?: string | undefined;
  strategyKey: LiveDraftStrategyKey;
  marketPrices?: ReadonlyMap<string, number> | undefined;
}

export interface SeasonPlayerValues {
  playerExpectedPrices: Readonly<Record<string, number>>;
  playerHumanValues: Readonly<Record<string, number>>;
}

const flexPositions: readonly ("RB" | "WR" | "TE")[] = ["RB", "WR", "TE"];

export const buildSeasonPlayerValues = ({
  season,
  playerCatalog,
  initialRosters,
  humanTeamId,
  strategyKey,
  marketPrices = new Map(),
}: BuildSeasonPlayerValuesInput): SeasonPlayerValues => {
  const humanKeepers = initialRosters.filter(player =>
    player.source === "keeper" && player.teamId === humanTeamId
  );
  const positionCounts = humanKeepers.reduce<Record<string, number>>((counts, keeper) => {
    counts[keeper.position] = (counts[keeper.position] ?? 0) + 1;
    return counts;
  }, {});
  const flexTarget = flexPositions.reduce(
    (total, position) => total + Number(season.settings.roster.lineup[position] ?? 0),
    Number(season.settings.roster.lineup.FLEX ?? 0),
  );
  const currentFlexPlayers = flexPositions.reduce(
    (total, position) => total + (positionCounts[position] ?? 0),
    0,
  );
  const auction = season.settings.draftFormat === "auction" ? season.settings.auction : undefined;
  const budget = auction?.budgetDollars ?? 1;
  const minimumBid = auction?.minimumBidDollars ?? 1;
  const budgetRemaining = budget - humanKeepers.reduce((total, keeper) => total + keeper.price, 0);
  const openRosterSlots = Math.max(0, season.settings.roster.rosterSize - humanKeepers.length);
  const maximumBid = Math.max(
    0,
    budgetRemaining - Math.max(0, openRosterSlots - 1) * minimumBid,
  );

  const playerExpectedPrices = Object.fromEntries(playerCatalog.map(player => {
    const playerKey = canonicalPlayerIdentityKey(player.name);
    return [playerKey, marketPrices.get(playerKey) ?? player.marketPrice ?? player.expectedPrice];
  }));
  const playerHumanValues = Object.fromEntries(playerCatalog.map(player => {
    const playerKey = canonicalPlayerIdentityKey(player.name);
    const marketValue = playerExpectedPrices[playerKey] ?? player.expectedPrice;
    if (auction === undefined) return [playerKey, marketValue];

    const projectionBaseline = projectionAdjustedAuctionValue({
      marketValue,
      projectionAdjustmentFactor: projectionScoringMatches(
        player.seasonProjectionScoring,
        season.settings.scoring,
      ) ? player.seasonProjectionAdjustmentFactor : undefined,
    });
    return [playerKey, strategyAdjustedAuctionValue({
      marketValue: projectionBaseline,
      position: player.position,
      strategyKey,
      positionCount: positionCounts[player.position] ?? 0,
      starterCount: Number(season.settings.roster.lineup[player.position] ?? 0),
      flexNeedsPlayer: currentFlexPlayers < flexTarget,
      maximumBid,
    })];
  }));

  return { playerExpectedPrices, playerHumanValues };
};
