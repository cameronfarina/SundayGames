import type { AnalyzePostDraftTeamInput } from "../contracts/projections.js";
import type { PickupDropRecommendationRecord } from "../contracts/recommendations.js";
import { round } from "../numbers.js";
import { projectedPlayer } from "./projectedPlayer.js";

export const pickupDropRecommendationRecords = (
  input: AnalyzePostDraftTeamInput,
): PickupDropRecommendationRecord[] => {
  const currentRoster = input.currentRosterSnapshot?.players;
  const freeAgents = input.freeAgentSnapshot?.players;
  if (currentRoster === undefined || freeAgents === undefined) return [];
  const projections = new Map(
    input.projectionSnapshot.projections.map(projection => [projection.playerId, projection]),
  );
  const positions = [...new Set(freeAgents.map(player => player.position))].sort();

  return positions.flatMap(position => {
    const add = freeAgents
      .filter(player => player.position === position)
      .flatMap(player => {
        const contribution = projectedPlayer(player, projections);
        return contribution === undefined ? [] : [contribution];
      })
      .sort((left, right) =>
        right.projectedPoints - left.projectedPoints || left.playerId.localeCompare(right.playerId)
      )[0];
    const drop = currentRoster
      .filter(player => player.position === position)
      .flatMap(player => {
        const contribution = projectedPlayer(player, projections);
        return contribution === undefined ? [] : [contribution];
      })
      .sort((left, right) =>
        left.projectedPoints - right.projectedPoints || left.playerId.localeCompare(right.playerId)
      )[0];
    if (add === undefined || drop === undefined) return [];
    const projectedPointGain = round(add.projectedPoints - drop.projectedPoints);
    if (projectedPointGain <= 0) return [];
    return [{
      recommendationId: `pickup-drop:${add.playerId}:${drop.playerId}`,
      add,
      drop,
      projectedPointGain,
      explanation: `${add.playerName} projects for ${projectedPointGain} more points than ${drop.playerName} this week at ${position}.`,
    }];
  }).sort((left, right) =>
    right.projectedPointGain - left.projectedPointGain ||
    left.recommendationId.localeCompare(right.recommendationId)
  );
};
