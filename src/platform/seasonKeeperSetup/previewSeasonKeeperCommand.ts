import { parseKeeperCommand } from "../keeperCommandImport.js";
import type {
  PreviewSeasonKeeperCommandInput,
  SeasonKeeperCommandResult,
} from "./contracts.js";
import { playerIdFor } from "./identity.js";

export const previewSeasonKeeperCommand = ({
  season,
  playerCatalog,
  command,
}: PreviewSeasonKeeperCommandInput): SeasonKeeperCommandResult => {
  const result = parseKeeperCommand({
    command,
    draftType: season.settings.draftFormat === "snake" ? "snake" : "auction",
    ...(season.settings.draftFormat === "snake"
      ? { snakeRoundCount: season.settings.snake.rounds }
      : { auctionMinimumBidDollars: season.settings.auction.minimumBidDollars }),
    teams: season.teams.map(team => ({
      teamId: team.id,
      teamName: team.displayName,
      managerNames: [team.ownerDisplayName, ...(team.managerDisplayNames ?? [])],
      aliases: [team.ownerId, team.abbreviation ?? ""].filter(Boolean),
    })),
    players: playerCatalog.map(player => ({
      playerId: playerIdFor(player),
      name: player.name,
    })),
  });
  if (result.kind === "error") return result;

  const player = playerCatalog.find(candidate => playerIdFor(candidate) === result.player.id);
  if (player === undefined) {
    return {
      kind: "error",
      error: {
        code: "unknown_player",
        message: `No player matched "${result.player.name}".`,
        mention: result.player.name,
      },
    };
  }

  return {
    ...result,
    player: {
      ...result.player,
      position: player.position,
      expectedPrice: player.expectedPrice,
    },
  };
};
