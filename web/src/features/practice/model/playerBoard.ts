import type { PracticePlayer } from "../api/playerCatalogSchema";

export type PlayerSort = "market" | "mine" | "rank" | "simulation";

export interface PlayerBoardFilters {
  readonly position: string;
  readonly search: string;
  readonly shortlistOnly: boolean;
  readonly sort: PlayerSort;
}

export interface RankedPracticePlayer {
  readonly player: PracticePlayer;
  readonly rank: number;
}

interface PlayerPersonalValue {
  readonly maxBid?: number | undefined;
  readonly playerName: string;
}

const normalized = (value: string): string => value.trim().toLocaleLowerCase();

export const playerKey = (playerName: string): string => normalized(playerName).replace(/\s+/gu, " ");

export const playerMarketValue = (player: PracticePlayer): number =>
  player.marketPrice ?? player.expectedPrice;

export const playerMyValue = (player: PracticePlayer): number =>
  player.myValue ?? player.leagueValue ?? player.expectedPrice;

export const playerSimulationValue = (player: PracticePlayer): number =>
  player.leagueValue ?? player.expectedPrice;

export const rankPlayers = (players: readonly PracticePlayer[]): readonly RankedPracticePlayer[] =>
  players.map((player, index) => ({
    player,
    rank: player.marketRank ?? player.leagueRank ?? index + 1,
  }));

export const rankPlayersWithPersonalValues = (
  players: readonly PracticePlayer[],
  values: readonly PlayerPersonalValue[],
): readonly RankedPracticePlayer[] => {
  const personalValues = new Map(values.flatMap(value => value.maxBid === undefined
    ? []
    : [[playerKey(value.playerName), value.maxBid]]));
  return rankPlayers(players.map(player => {
    const personalValue = personalValues.get(playerKey(player.name));
    return personalValue === undefined ? player : { ...player, myValue: personalValue };
  }));
};

export const playerSortFrom = (value: string): PlayerSort => {
  if (value === "mine") return "mine";
  if (value === "rank") return "rank";
  if (value === "simulation") return "simulation";
  return "market";
};

const sortablePlayerRank = ({ player, rank }: RankedPracticePlayer): number =>
  player.marketRank ?? player.leagueRank ?? rank;

const matchesSearch = (player: PracticePlayer, search: string): boolean => {
  const query = normalized(search);
  if (query.length === 0) return true;
  return [player.name, player.position, player.teamAbbreviation ?? ""]
    .some(value => normalized(value).includes(query));
};

export const filterAndSortPlayers = (
  players: readonly RankedPracticePlayer[],
  filters: PlayerBoardFilters,
  shortlistedPlayerKeys: ReadonlySet<string>,
): readonly RankedPracticePlayer[] => [...players]
  .filter(({ player }) => player.isKeeper !== true)
  .filter(({ player }) => filters.position === "ALL" || player.position === filters.position)
  .filter(({ player }) => !filters.shortlistOnly || shortlistedPlayerKeys.has(playerKey(player.name)))
  .filter(({ player }) => matchesSearch(player, filters.search))
  .sort((left, right) => {
    if (filters.sort === "rank") {
      return sortablePlayerRank(left) - sortablePlayerRank(right)
        || left.player.name.localeCompare(right.player.name);
    }
    const leftValue = filters.sort === "mine"
      ? playerMyValue(left.player)
      : filters.sort === "simulation"
        ? playerSimulationValue(left.player)
        : playerMarketValue(left.player);
    const rightValue = filters.sort === "mine"
      ? playerMyValue(right.player)
      : filters.sort === "simulation"
        ? playerSimulationValue(right.player)
        : playerMarketValue(right.player);
    return rightValue - leftValue
      || sortablePlayerRank(left) - sortablePlayerRank(right)
      || left.player.name.localeCompare(right.player.name);
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
