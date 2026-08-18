import type { AuctionPlayer, AuctionTeam } from "../api/auctionBoardSchemas.js";

export type PositionFilter = "ALL" | "QB" | "RB" | "WR" | "TE" | "FLEX" | "DST" | "K";

export const positionFilters: readonly PositionFilter[] = [
  "ALL",
  "QB",
  "RB",
  "WR",
  "TE",
  "FLEX",
  "DST",
  "K",
];

export const matchesPositionFilter = (position: string, filter: PositionFilter): boolean => {
  if (filter === "ALL") return true;
  if (filter === "FLEX") return ["RB", "WR", "TE"].includes(position);
  return position === filter;
};

export const filterAuctionPlayers = (
  players: readonly AuctionPlayer[],
  search: string,
  filter: PositionFilter,
): readonly AuctionPlayer[] => {
  const term = search.trim().toLocaleLowerCase();
  return players.filter(player => {
    if (!player.available || !matchesPositionFilter(player.position, filter)) return false;
    if (term.length === 0) return true;
    return [player.name, player.position, player.teamAbbreviation ?? ""]
      .some(value => value.toLocaleLowerCase().includes(term));
  });
};

export const teamCanRoster = (team: AuctionTeam | undefined, position: string): boolean =>
  team !== undefined
  && team.rosterSlotsRemaining > 0
  && team.slots.some(slot => slot.playerId === undefined && slot.eligiblePositions.includes(position));

export const auctionProgress = (teams: readonly AuctionTeam[]) => ({
  completed: teams.reduce((total, team) => total + team.roster.length, 0),
  total: teams.reduce(
    (total, team) => total + team.roster.length + team.rosterSlotsRemaining,
    0,
  ),
});

export const positionAccent = (position: string): string => {
  switch (position) {
    case "QB": return "position--qb";
    case "RB": return "position--rb";
    case "WR": return "position--wr";
    case "TE": return "position--te";
    case "FLEX": return "position--flex";
    case "DST": return "position--dst";
    case "K": return "position--k";
    default: return "position--other";
  }
};
