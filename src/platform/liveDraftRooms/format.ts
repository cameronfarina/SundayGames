import { analyzeRosterSlots } from "../leagueCreation.js";
import {
  assessLeagueSeasonReadiness,
  type AnyLeagueSeason,
  type ExplicitLeagueSeason,
} from "../leagueSeason.js";
import { LiveDraftRoomError } from "./error.js";

export function assertHostedLiveDraftRoomFormat(
  season: AnyLeagueSeason,
): asserts season is ExplicitLeagueSeason {
  if (season.settings.draftFormat === undefined && season.settings.auction === undefined) {
    throw new LiveDraftRoomError(
      "season_not_ready",
      "This league has no draft format. Choose auction or snake in league settings.",
    );
  }
}

export function assertSeasonReady(season: AnyLeagueSeason): asserts season is ExplicitLeagueSeason {
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
}
