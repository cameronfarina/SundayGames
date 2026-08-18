import type { SnakeBoardPick, SnakeBoardPlayer, SnakeTeam } from "../api/snakeStateSchemas.js";
import { type PositionFilter, matchesPositionFilter } from "./auctionViewModel.js";

export const filterSnakePlayers = (
  players: readonly SnakeBoardPlayer[],
  search: string,
  filter: PositionFilter,
): readonly SnakeBoardPlayer[] => {
  const term = search.trim().toLocaleLowerCase();
  return players.filter(player => {
    if (!player.available || !matchesPositionFilter(player.position, filter)) return false;
    if (term.length === 0) return true;
    return [player.name, player.position, player.teamAbbreviation ?? ""]
      .some(value => value.toLocaleLowerCase().includes(term));
  });
};

export const snakeTeamCanRoster = (team: SnakeTeam | undefined, position: string): boolean =>
  team?.slots.some(slot => slot.playerId === undefined && slot.eligiblePositions.includes(position))
  ?? false;

export interface SnakeRound {
  readonly round: number;
  readonly picks: readonly SnakeBoardPick[];
}

export const snakeRounds = (picks: readonly SnakeBoardPick[]): readonly SnakeRound[] => {
  const byRound = new Map<number, SnakeBoardPick[]>();
  for (const pick of picks) {
    byRound.set(pick.round, [...(byRound.get(pick.round) ?? []), pick]);
  }
  return [...byRound.entries()]
    .sort(([left], [right]) => left - right)
    .map(([round, roundPicks]) => ({
      round,
      picks: [...roundPicks].sort((left, right) => left.pickInRound - right.pickInRound),
    }));
};

/** "2.03" reads the way managers say it out loud, unlike a bare overall number. */
export const pickLabel = (pick: SnakeBoardPick): string =>
  `${String(pick.round)}.${String(pick.pickInRound).padStart(2, "0")}`;

export const playerNamesById = (
  players: readonly SnakeBoardPlayer[],
): ReadonlyMap<string, string> =>
  new Map(players.map(player => [player.id, player.name]));
