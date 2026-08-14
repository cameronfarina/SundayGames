import type { AnalyzePostDraftTeamInput } from "./contracts/projections.js";
import { PostDraftTeamAnalysisError } from "./errors.js";

interface SharedContext {
  label: string;
  leagueId: string;
  seasonId: string;
}

const sharedContextsFor = (input: AnalyzePostDraftTeamInput): readonly SharedContext[] => [
  {
    label: "league settings",
    leagueId: input.leagueSettings.leagueId,
    seasonId: input.leagueSettings.seasonId,
  },
  {
    label: "completed draft roster",
    leagueId: input.completedDraftRoster.leagueId,
    seasonId: input.completedDraftRoster.seasonId,
  },
  {
    label: "projection snapshot",
    leagueId: input.projectionSnapshot.metadata.leagueId,
    seasonId: input.projectionSnapshot.metadata.seasonId,
  },
  ...(input.currentRosterSnapshot === undefined ? [] : [{
    label: "current roster snapshot",
    leagueId: input.currentRosterSnapshot.leagueId,
    seasonId: input.currentRosterSnapshot.seasonId,
  }]),
  ...(input.freeAgentSnapshot === undefined ? [] : [{
    label: "free-agent snapshot",
    leagueId: input.freeAgentSnapshot.leagueId,
    seasonId: input.freeAgentSnapshot.seasonId,
  }]),
];

export const assertAnalysisContext = (input: AnalyzePostDraftTeamInput): void => {
  const { ownership } = input;
  if (ownership.userId !== ownership.privateOwnerUserId) {
    throw new PostDraftTeamAnalysisError(
      "private_owner_mismatch",
      "My Team analysis must be private to the requesting user.",
    );
  }
  const mismatch = sharedContextsFor(input).find(context =>
    context.leagueId !== ownership.leagueId || context.seasonId !== ownership.seasonId
  );
  if (mismatch !== undefined) {
    throw new PostDraftTeamAnalysisError(
      "snapshot_context_mismatch",
      `${mismatch.label} does not match the owned league and season.`,
    );
  }
  const ownedRoster = input.completedDraftRoster.teams.find(team => team.teamId === ownership.teamId);
  if (ownedRoster === undefined) {
    throw new PostDraftTeamAnalysisError(
      "owned_team_missing",
      `Completed draft roster does not include owned team ${ownership.teamId}.`,
    );
  }
  if (ownedRoster.ownerId !== ownership.ownerId) {
    throw new PostDraftTeamAnalysisError(
      "owned_team_mismatch",
      `Owned team ${ownership.teamId} belongs to ${ownedRoster.ownerId}, not ${ownership.ownerId}.`,
    );
  }
  if (
    input.currentRosterSnapshot !== undefined &&
    (
      input.currentRosterSnapshot.teamId !== ownership.teamId ||
      input.currentRosterSnapshot.privateOwnerUserId !== ownership.privateOwnerUserId
    )
  ) {
    throw new PostDraftTeamAnalysisError(
      "snapshot_context_mismatch",
      "Current roster snapshot does not match the private owned team.",
    );
  }
};
