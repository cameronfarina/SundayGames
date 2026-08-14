import type { PostDraftRosterSettings, PostDraftTeamRoster } from "./contracts/core.js";
import type { PostDraftProjection } from "./contracts/projections.js";
import type { ProjectedRosterPlayerContribution } from "./contracts/ranking.js";
import type { TeamComponentValues } from "./internalTypes.js";
import { round } from "./numbers.js";
import { positionalBalanceFor } from "./positionalBalance.js";
import { selectStarters } from "./starterSelection.js";

export const componentValuesFor = (
  roster: PostDraftTeamRoster,
  settings: PostDraftRosterSettings,
  projectionsByPlayerId: ReadonlyMap<string, PostDraftProjection>,
): TeamComponentValues => {
  const starters = selectStarters(roster, projectionsByPlayerId, settings.starterSlots);
  const availableBenchSlots = Math.max(0, settings.rosterSize - settings.starterSlots.length);
  const benchPlayers = roster.players
    .flatMap((player, playerIndex) => {
      if (starters.selectedPlayerIndexes.has(playerIndex)) return [];
      const projection = projectionsByPlayerId.get(player.playerId);
      return projection === undefined ? [] : [{ player, projectedPoints: projection.seasonProjectedPoints }];
    })
    .sort((left, right) =>
      right.projectedPoints - left.projectedPoints || left.player.playerId.localeCompare(right.player.playerId)
    )
    .slice(0, availableBenchSlots)
    .map(({ player, projectedPoints }): ProjectedRosterPlayerContribution => ({
      playerId: player.playerId,
      playerName: player.playerName,
      position: player.position,
      projectedPoints: round(projectedPoints),
    }));

  return {
    teamId: roster.teamId,
    starterProjectedPoints: starters.projectedPoints,
    filledSlots: starters.filledSlots,
    starterLineup: starters.lineup,
    benchProjectedPoints: round(benchPlayers.reduce((total, player) => total + player.projectedPoints, 0)),
    countedBenchPlayers: benchPlayers.length,
    benchPlayers,
    ...positionalBalanceFor(roster, settings),
  };
};
