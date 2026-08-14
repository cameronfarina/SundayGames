import { keepers } from "../../../config/keepers.js";
import type { LeagueSeason } from "../leagueSeason.js";
import type { LiveDraftRoomInitialRosterPlayer } from "../liveDraftRooms.js";

const initialRosterPlayerFor = (
  season: LeagueSeason,
  keeper: (typeof keepers)[number],
): LiveDraftRoomInitialRosterPlayer | undefined => {
  const team = season.teams.find(candidate => candidate.ownerDisplayName === keeper.owner);
  return team === undefined
    ? undefined
    : {
        teamId: team.id,
        playerName: keeper.player,
        position: keeper.position,
        price: keeper.newCost,
        source: "keeper",
      };
};

export const currentLeagueInitialRostersFor = (
  season: LeagueSeason,
): readonly LiveDraftRoomInitialRosterPlayer[] =>
  keepers.flatMap(keeper => {
    const player = initialRosterPlayerFor(season, keeper);
    return player === undefined ? [] : [player];
  });
