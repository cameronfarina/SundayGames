import type { AnalyzeEndedLiveDraftRoomTeamInput } from "./contracts.js";
import { PostDraftLiveRoomAdapterError } from "./errors.js";
import { postDraftScoringSettingsIdForSeason } from "./scoring.js";

const assertRoomLifecycle = (input: AnalyzeEndedLiveDraftRoomTeamInput): void => {
  if (input.room.status !== "ended") {
    throw new PostDraftLiveRoomAdapterError(
      "room_not_ended",
      "My Team analysis is available only after the live draft room has ended.",
    );
  }
  if (input.ownership.userId !== input.ownership.privateOwnerUserId) {
    throw new PostDraftLiveRoomAdapterError(
      "private_owner_mismatch",
      "My Team analysis must be private to the requesting user.",
    );
  }
};

const assertRoomIdentity = (input: AnalyzeEndedLiveDraftRoomTeamInput): void => {
  const { room } = input;
  if (
    room.season.id !== room.seasonId
    || room.season.leagueId !== room.leagueId
    || room.season.league.id !== room.leagueId
    || room.projection.roomId !== room.roomId
    || room.projection.leagueId !== room.leagueId
    || room.projection.seasonId !== room.seasonId
    || room.projection.status !== room.status
  ) {
    throw new PostDraftLiveRoomAdapterError(
      "context_mismatch",
      "Live draft room context is internally inconsistent.",
    );
  }
};

const assertExternalContext = (input: AnalyzeEndedLiveDraftRoomTeamInput): void => {
  const { ownership, projectionSnapshot, room } = input;
  if (ownership.leagueId !== room.leagueId || ownership.seasonId !== room.seasonId) {
    throw new PostDraftLiveRoomAdapterError(
      "context_mismatch",
      "Claimed ownership does not match the live draft room league and season.",
    );
  }
  if (
    projectionSnapshot.metadata.leagueId !== room.leagueId
    || projectionSnapshot.metadata.seasonId !== room.seasonId
  ) {
    throw new PostDraftLiveRoomAdapterError(
      "context_mismatch",
      "Projection snapshot does not match the live draft room league and season.",
    );
  }
  const scoringId = projectionSnapshot.metadata.scoringSettingsId;
  if (scoringId !== undefined && scoringId !== postDraftScoringSettingsIdForSeason(room.season)) {
    throw new PostDraftLiveRoomAdapterError(
      "context_mismatch",
      "Projection snapshot scoring does not match the live draft room settings.",
    );
  }
};

export const assertAnalysisContext = (input: AnalyzeEndedLiveDraftRoomTeamInput): void => {
  assertRoomLifecycle(input);
  assertRoomIdentity(input);
  assertExternalContext(input);
};
