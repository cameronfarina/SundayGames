import type { PracticePlayer } from "../api/playerCatalogSchema";

export type PlayerSort = "market" | "mine" | "rank";

export interface PlayerBoardFilters {
  readonly position: string;
  readonly search: string;
  readonly shortlistOnly: boolean;
  readonly sort: PlayerSort;
}

const normalized = (value: string): string => value.trim().toLocaleLowerCase();

export const playerKey = (playerName: string): string => normalized(playerName).replace(/\s+/gu, " ");

export const playerMarketValue = (player: PracticePlayer): number =>
  player.marketPrice ?? player.expectedPrice;

export const playerMyValue = (player: PracticePlayer): number =>
  player.myValue ?? player.leagueValue ?? player.expectedPrice;

const playerRank = (player: PracticePlayer): number =>
  player.marketRank ?? player.leagueRank ?? Number.POSITIVE_INFINITY;

const matchesSearch = (player: PracticePlayer, search: string): boolean => {
  const query = normalized(search);
  if (query.length === 0) return true;
  return [player.name, player.position, player.teamAbbreviation ?? ""]
    .some(value => normalized(value).includes(query));
};

export const filterAndSortPlayers = (
  players: readonly PracticePlayer[],
  filters: PlayerBoardFilters,
  shortlistedPlayerKeys: ReadonlySet<string>,
): readonly PracticePlayer[] => [...players]
  .filter(player => filters.position === "ALL" || player.position === filters.position)
  .filter(player => !filters.shortlistOnly || shortlistedPlayerKeys.has(playerKey(player.name)))
  .filter(player => matchesSearch(player, filters.search))
  .sort((left, right) => {
    if (filters.sort === "rank") return playerRank(left) - playerRank(right) || left.name.localeCompare(right.name);
    const leftValue = filters.sort === "mine" ? playerMyValue(left) : playerMarketValue(left);
    const rightValue = filters.sort === "mine" ? playerMyValue(right) : playerMarketValue(right);
    return rightValue - leftValue || playerRank(left) - playerRank(right) || left.name.localeCompare(right.name);
  });

export type PositionTone = "aqua" | "blue" | "gold" | "green" | "neutral" | "pink" | "purple";

export const positionTone = (position: string): PositionTone => {
  if (position === "QB") return "gold";
  if (position === "RB") return "blue";
  if (position === "WR") return "purple";
  if (position === "TE") return "pink";
  if (position === "FLEX") return "green";
  if (position === "DST") return "aqua";
  return "neutral";
};
