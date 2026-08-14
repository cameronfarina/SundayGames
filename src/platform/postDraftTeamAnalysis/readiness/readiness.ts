import type { PostDraftTeamAnalysis } from "../contracts/analysis.js";
import type { AnalyzePostDraftTeamInput } from "../contracts/projections.js";
import type { CoachRecommendationReadiness } from "../contracts/recommendations.js";
import { currentRosterReadinessReasons } from "./currentRosterReasons.js";
import { pickupDropReadinessReasons } from "./pickupDropReasons.js";
import { projectionReadinessReasons } from "./projectionReasons.js";
import { readinessStatusFor } from "./status.js";

export const initialRecommendationReadiness = (
  input: AnalyzePostDraftTeamInput,
): PostDraftTeamAnalysis["recommendationReadiness"] => {
  const projections = new Map(
    input.projectionSnapshot.projections.map(projection => [projection.playerId, projection]),
  );
  const playersWithoutWeeklyProjections = (input.currentRosterSnapshot?.players ?? [])
    .filter(player => !Number.isFinite(projections.get(player.playerId)?.weeklyProjectedPoints))
    .map(player => player.playerId);
  const weeklyReasons = [
    ...projectionReadinessReasons(input, playersWithoutWeeklyProjections),
    ...currentRosterReadinessReasons(input),
  ];
  const startSit: CoachRecommendationReadiness = {
    status: readinessStatusFor(weeklyReasons),
    reasons: weeklyReasons,
    snapshotIds: [
      input.projectionSnapshot.metadata.snapshotId,
      ...(input.currentRosterSnapshot === undefined ? [] : [input.currentRosterSnapshot.snapshotId]),
    ],
  };
  const pickupDropReasons = [...weeklyReasons, ...pickupDropReadinessReasons(input, projections)];
  return {
    startSit,
    pickupDrop: {
      status: readinessStatusFor(pickupDropReasons),
      reasons: pickupDropReasons,
      snapshotIds: [
        input.projectionSnapshot.metadata.snapshotId,
        ...(input.currentRosterSnapshot === undefined ? [] : [input.currentRosterSnapshot.snapshotId]),
        ...(input.freeAgentSnapshot === undefined ? [] : [input.freeAgentSnapshot.snapshotId]),
      ],
    },
  };
};
