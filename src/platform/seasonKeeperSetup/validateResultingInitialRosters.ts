import type { LeagueSeason } from "../leagueSeason.js";
import type { LiveDraftRoomInitialRosterPlayer } from "../liveDraftRooms.js";
import type { SeasonKeeperCommandPreview } from "./contracts.js";
import { validateRosterIdentity } from "./validateRosterIdentity.js";
import { validateSnakeKeepers } from "./validateSnakeKeepers.js";
import { validateTeamKeepers } from "./validateTeamKeepers.js";

export const validateResultingInitialRosters = (
  season: LeagueSeason,
  initialRosters: readonly LiveDraftRoomInitialRosterPlayer[],
  preview: SeasonKeeperCommandPreview,
): void => {
  validateRosterIdentity(season, initialRosters);
  validateSnakeKeepers(season, initialRosters);
  validateTeamKeepers(season, initialRosters, preview);
};
