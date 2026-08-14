import type { PostDraftRosterPlayer } from "../contracts/core.js";
import type { PostDraftProjection } from "../contracts/projections.js";
import type { CoachProjectedPlayer } from "../contracts/recommendations.js";
import { round } from "../numbers.js";

export const projectedPlayer = (
  player: PostDraftRosterPlayer,
  projectionsByPlayerId: ReadonlyMap<string, PostDraftProjection>,
): CoachProjectedPlayer | undefined => {
  const projectedPoints = projectionsByPlayerId.get(player.playerId)?.weeklyProjectedPoints;
  if (typeof projectedPoints !== "number" || !Number.isFinite(projectedPoints)) return undefined;
  return {
    playerId: player.playerId,
    playerName: player.playerName,
    position: player.position,
    projectedPoints: round(projectedPoints),
  };
};
