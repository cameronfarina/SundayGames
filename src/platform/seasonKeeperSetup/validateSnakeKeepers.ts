import type { LeagueSeason } from "../leagueSeason.js";
import type { LiveDraftRoomInitialRosterPlayer } from "../liveDraftRooms.js";
import { SeasonKeeperSetupError } from "./errors.js";
import { existingKeeperTeamName } from "./identity.js";

export const validateSnakeKeepers = (
  season: LeagueSeason,
  initialRosters: readonly LiveDraftRoomInitialRosterPlayer[],
): void => {
  if (season.settings.draftFormat !== "snake") return;
  const keeperPickKeys = new Set<string>();
  for (const player of initialRosters.filter(candidate => candidate.source === "keeper")) {
    const round = player.keeperRound;
    if (typeof round !== "number" || !Number.isInteger(round) || round <= 0 || round > season.settings.snake.rounds) {
      throw new SeasonKeeperSetupError(
        "keeper_snake_round_invalid",
        `${player.playerName} must use a keeper round between 1 and ${season.settings.snake.rounds}.`,
      );
    }
    const pickKey = `${player.teamId}:${round}`;
    if (keeperPickKeys.has(pickKey)) {
      throw new SeasonKeeperSetupError(
        "keeper_snake_pick_conflict",
        `${existingKeeperTeamName(season, player)} already has a keeper assigned to round ${round}.`,
      );
    }
    keeperPickKeys.add(pickKey);
  }
};
