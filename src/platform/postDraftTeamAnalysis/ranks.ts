import { round } from "./numbers.js";

export const ranksFor = <Team extends { teamId: string }>(
  teams: readonly Team[],
  valueFor: (team: Team) => number,
): ReadonlyMap<string, number> => {
  const sortedTeams = [...teams]
    .sort((left, right) => valueFor(right) - valueFor(left) || left.teamId.localeCompare(right.teamId));
  const ranks = new Map<string, number>();
  let previousValue: number | undefined;
  let previousRank = 0;
  sortedTeams.forEach((team, index) => {
    const value = valueFor(team);
    const rank = previousValue === value ? previousRank : index + 1;
    ranks.set(team.teamId, rank);
    previousValue = value;
    previousRank = rank;
  });
  return ranks;
};

export const normalizedScoresFor = <Team extends { teamId: string }>(
  teams: readonly Team[],
  valueFor: (team: Team) => number,
): ReadonlyMap<string, number> => {
  const values = teams.map(valueFor);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  return new Map(teams.map(team => [
    team.teamId,
    maximum === minimum ? 100 : round(((valueFor(team) - minimum) / (maximum - minimum)) * 100),
  ]));
};
