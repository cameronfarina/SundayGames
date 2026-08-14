import type { LeagueSeason } from "../leagueSeason.js";
import type {
  LiveDraftRoomInitialRosterPlayer,
  LiveDraftRoomPlayerCatalogEntry,
} from "../liveDraftRooms.js";
import type { SeasonKeeperCommandPreview } from "./contracts.js";
import { SeasonKeeperSetupError } from "./errors.js";
import { teamRosterFitsConfiguredSlots } from "./teamRosterFitsConfiguredSlots.js";
import { validateAuctionKeepers } from "./validateAuctionKeepers.js";

const validatePositionMaximums = (
  season: LeagueSeason,
  teamName: string,
  teamPlayers: readonly LiveDraftRoomInitialRosterPlayer[],
): void => {
  const counts = new Map<LiveDraftRoomPlayerCatalogEntry["position"], number>();
  for (const player of teamPlayers) {
    const count = (counts.get(player.position) ?? 0) + 1;
    counts.set(player.position, count);
    const maximum = season.settings.roster.rosterMaximums[player.position];
    if (Number.isInteger(maximum) && count <= maximum) continue;
    throw new SeasonKeeperSetupError(
      "keeper_position_limit",
      `${teamName} cannot have more than ${maximum} ${player.position} keeper${maximum === 1 ? "" : "s"}.`,
    );
  }
};

export const validateTeamKeepers = (
  season: LeagueSeason,
  initialRosters: readonly LiveDraftRoomInitialRosterPlayer[],
  preview: SeasonKeeperCommandPreview,
): void => {
  for (const team of season.teams) {
    const teamPlayers = initialRosters.filter(player => player.teamId === team.id);
    if (teamPlayers.length > season.settings.roster.rosterSize) {
      const count = season.settings.roster.rosterSize;
      throw new SeasonKeeperSetupError(
        "keeper_roster_full",
        `${team.displayName} cannot have more than ${count} keeper${count === 1 ? "" : "s"}.`,
      );
    }
    validatePositionMaximums(season, team.displayName, teamPlayers);
    if (!teamRosterFitsConfiguredSlots(season, teamPlayers)) {
      const addedPlayerName = team.id === preview.team.id
        ? preview.player.name
        : teamPlayers.at(-1)?.playerName;
      throw new SeasonKeeperSetupError(
        "keeper_position_limit",
        `${team.displayName} has no configured roster slot for ${addedPlayerName ?? "this keeper"}.`,
      );
    }
    if (season.settings.draftFormat === "auction") {
      validateAuctionKeepers({
        settings: season.settings,
        teamName: team.displayName,
        teamPlayers,
        preview,
      });
    }
  }
};
