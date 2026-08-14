import type {
  KeeperCommandPlayerCatalogEntry,
  KeeperCommandTeamCatalogEntry,
  ParseKeeperCommandInput,
} from "../src/platform/keeperCommandImport.js";

export const ownerTeam: KeeperCommandTeamCatalogEntry = {
  teamId: "team-owner01",
  teamName: "Sunday Beaters",
  managerNames: ["Jamie Owner01"],
};

export const dartPlayer: KeeperCommandPlayerCatalogEntry = {
  playerId: "player-dart",
  name: "Jaxson Dart",
};

export const snakeCommandInput = (
  command: string,
  teams: readonly KeeperCommandTeamCatalogEntry[] = [ownerTeam],
  players: readonly KeeperCommandPlayerCatalogEntry[] = [dartPlayer],
): ParseKeeperCommandInput => ({
  command,
  draftType: "snake",
  teams,
  players,
});

export const auctionCommandInput = (
  command: string,
  teams: readonly KeeperCommandTeamCatalogEntry[] = [ownerTeam],
  players: readonly KeeperCommandPlayerCatalogEntry[] = [dartPlayer],
): ParseKeeperCommandInput => ({
  command,
  draftType: "auction",
  teams,
  players,
});
