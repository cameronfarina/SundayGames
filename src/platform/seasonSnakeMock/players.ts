import { canonicalPlayerIdentityKey } from "../../data/normalizePlayerName.js";
import type { LiveDraftRoomSetup } from "../liveDraftRoomSetups/contracts.js";
import type { SnakeDraftPlayer } from "../snakeDraftEngine/config.js";

export const snakePlayersFor = (
  setup: LiveDraftRoomSetup,
): readonly SnakeDraftPlayer[] => setup.playerCatalog.map((player, index) => ({
  id: canonicalPlayerIdentityKey(player.name),
  name: player.name,
  position: player.position,
  rank: index + 1,
  adp: index + 1,
  leagueExpectedPick: index + 1,
  ...(player.teamAbbreviation === undefined
    ? {}
    : { teamAbbreviation: player.teamAbbreviation }),
  ...(player.byeWeek === undefined ? {} : { byeWeek: player.byeWeek }),
  ...(player.week1Projection === undefined
    ? {}
    : { week1Projection: player.week1Projection }),
}));
