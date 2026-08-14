import type { LeagueSeason } from "../leagueSeason.js";
import type { LiveDraftRoomInitialRosterPlayer } from "../liveDraftRooms.js";
import { SeasonKeeperSetupError } from "./errors.js";
import { existingKeeperTeamName, initialRosterPlayerIdentity } from "./identity.js";

export const validateRosterIdentity = (
  season: LeagueSeason,
  initialRosters: readonly LiveDraftRoomInitialRosterPlayer[],
): void => {
  const seenPlayerIdentities = new Set<string>();
  for (const player of initialRosters) {
    if (!season.teams.some(team => team.id === player.teamId)) {
      throw new SeasonKeeperSetupError(
        "keeper_team_missing",
        `Keeper team "${player.teamId}" no longer belongs to this season.`,
      );
    }
    const identity = initialRosterPlayerIdentity(player);
    if (seenPlayerIdentities.has(identity)) {
      throw new SeasonKeeperSetupError(
        "keeper_player_conflict",
        `${player.playerName} is already kept by ${existingKeeperTeamName(season, player)}.`,
      );
    }
    seenPlayerIdentities.add(identity);
  }
};
