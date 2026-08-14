import type { PostDraftTeamRoster } from "../contracts/core.js";
import type { AnalyzePostDraftTeamInput } from "../contracts/projections.js";
import type { StartSitRecommendationRecord } from "../contracts/recommendations.js";
import { round } from "../numbers.js";
import { selectStarters } from "../starterSelection.js";
import { projectedPlayer } from "./projectedPlayer.js";
import { weeklyProjectionMap } from "./weeklyProjectionMap.js";

export const startSitRecommendationRecords = (
  input: AnalyzePostDraftTeamInput,
): StartSitRecommendationRecord[] => {
  const currentRosterPlayers = input.currentRosterSnapshot?.players;
  if (currentRosterPlayers === undefined) return [];
  const currentRoster: PostDraftTeamRoster = {
    teamId: input.ownership.teamId,
    ownerId: input.ownership.ownerId,
    players: currentRosterPlayers,
  };
  const projections = new Map(
    input.projectionSnapshot.projections.map(projection => [projection.playerId, projection]),
  );
  const lineup = selectStarters(
    currentRoster,
    weeklyProjectionMap(input.projectionSnapshot.projections),
    input.leagueSettings.roster.starterSlots,
  ).lineup;
  const selectedPlayerIds = new Set(lineup.map(player => player.playerId));

  return lineup.map(start => {
    const slot = input.leagueSettings.roster.starterSlots.find(candidate => candidate.slot === start.slot);
    const startPlayer = currentRoster.players.find(player => player.playerId === start.playerId);
    if (slot === undefined || startPlayer === undefined) {
      throw new Error("Weekly starter recommendation references unavailable roster inputs.");
    }
    const projectedStart = projectedPlayer(startPlayer, projections);
    if (projectedStart === undefined) {
      throw new Error("Weekly starter recommendation references an unavailable projection.");
    }
    const projectedSit = currentRoster.players
      .filter(player => !selectedPlayerIds.has(player.playerId) && slot.eligiblePositions.includes(player.position))
      .flatMap(player => {
        const contribution = projectedPlayer(player, projections);
        return contribution === undefined ? [] : [contribution];
      })
      .sort((left, right) =>
        right.projectedPoints - left.projectedPoints || left.playerId.localeCompare(right.playerId)
      )[0];

    if (projectedSit === undefined) {
      return {
        recommendationId: `start-sit:${start.slot}:${start.playerId}`,
        slot: start.slot,
        start: projectedStart,
        explanation: `${projectedStart.playerName} is the projected starter in the ${start.slot} slot at ${projectedStart.projectedPoints} points.`,
      };
    }
    const projectedPointEdge = round(projectedStart.projectedPoints - projectedSit.projectedPoints);
    return {
      recommendationId: `start-sit:${start.slot}:${start.playerId}`,
      slot: start.slot,
      start: projectedStart,
      sit: projectedSit,
      projectedPointEdge,
      explanation: `${projectedStart.playerName} projects for ${projectedPointEdge} more points than ${projectedSit.playerName} in the ${start.slot} slot.`,
    };
  });
};
