import { analyzeRosterSlots } from "../leagueCreation.js";
import { assessLeagueSeasonReadiness, type LeagueSeason } from "../leagueSeason.js";
import { LiveDraftRoomError } from "./error.js";

export const assertHostedLiveDraftRoomFormat = (season: LeagueSeason): void => {
  if (season.settings.draftFormat === "snake") {
    throw new LiveDraftRoomError(
      "snake_live_room_unavailable",
      "Hosted live rooms currently support auction drafts. Use Mock Draft for this snake league.",
    );
  }
};

export const assertSeasonReady = (season: LeagueSeason): void => {
  assertHostedLiveDraftRoomFormat(season);
  const readiness = assessLeagueSeasonReadiness(season);
  const unsupportedSlot = analyzeRosterSlots(season.settings.roster.lineup).unsupportedSlots[0];

  if (unsupportedSlot !== undefined) {
    throw new LiveDraftRoomError(
      "season_not_ready",
      `Roster slot ${unsupportedSlot} is unsupported. Review the league roster settings before creating a live draft room.`,
    );
  }

  if (season.setupStatus === "draft" || readiness.blockers.length > 0) {
    throw new LiveDraftRoomError(
      "season_not_ready",
      "League season must be published or locked before creating a live draft room.",
    );
  }
};
