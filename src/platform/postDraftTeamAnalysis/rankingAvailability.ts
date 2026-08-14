import type { AnalyzePostDraftTeamInput, PostDraftProjection } from "./contracts/projections.js";
import type { TeamRankingUnavailableReason } from "./contracts/ranking.js";
import type { TeamComponentValues } from "./internalTypes.js";

export const projectionRankingIssue = (
  input: AnalyzePostDraftTeamInput,
): TeamRankingUnavailableReason | undefined => {
  const metadata = input.projectionSnapshot.metadata;
  if (metadata.scoringSettingsId === undefined || metadata.source?.scoringSpecific === false) {
    return {
      code: "projection_scoring_settings_unverified",
      message: `Projection snapshot ${metadata.snapshotId} was not calculated for this league's scoring settings.`,
      projectionSnapshotId: metadata.snapshotId,
    };
  }
  if (metadata.scoringSettingsId !== input.leagueSettings.scoring.id) {
    return {
      code: "projection_scoring_settings_mismatch",
      message: `Projection snapshot ${metadata.snapshotId} uses ${metadata.scoringSettingsId}, not ${input.leagueSettings.scoring.id}.`,
      projectionSnapshotId: metadata.snapshotId,
    };
  }
  return undefined;
};

export const projectionCoverageIssue = (
  input: AnalyzePostDraftTeamInput,
  projections: ReadonlyMap<string, PostDraftProjection>,
): TeamRankingUnavailableReason | undefined => {
  const missingPlayerIds = [...new Set(
    input.completedDraftRoster.teams.flatMap(team => team.players
      .filter(player => !Number.isFinite(projections.get(player.playerId)?.seasonProjectedPoints))
      .map(player => player.playerId)),
  )].sort();
  return missingPlayerIds.length === 0 ? undefined : {
    code: "projection_coverage_incomplete",
    message: "Season projections do not cover every player in the completed draft roster.",
    projectionSnapshotId: input.projectionSnapshot.metadata.snapshotId,
    playerIds: missingPlayerIds,
  };
};

export const incompleteRosterIssue = (
  input: AnalyzePostDraftTeamInput,
  ownedTeam: TeamComponentValues,
): TeamRankingUnavailableReason | undefined => {
  const roster = input.completedDraftRoster.teams.find(team => team.teamId === input.ownership.teamId);
  if (roster === undefined) return undefined;
  const requiredSlots = input.leagueSettings.roster.starterSlots.length;
  if (roster.players.length > 0 && ownedTeam.filledSlots >= requiredSlots) return undefined;
  return {
    code: "roster_materially_incomplete",
    message: roster.players.length === 0
      ? "The roster is empty, so draft rank and strengths are unavailable."
      : `The roster fills ${ownedTeam.filledSlots} of ${requiredSlots} required starter slots, so draft rank and strengths are unavailable.`,
    projectionSnapshotId: input.projectionSnapshot.metadata.snapshotId,
  };
};
